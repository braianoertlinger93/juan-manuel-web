'use strict';

const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ---------------------------------------------------------------
// Cliente de Supabase con la SERVICE ROLE KEY.
// Se usa ÚNICAMENTE en el servidor (nunca se expone al frontend).
// ---------------------------------------------------------------
function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// ---------------------------------------------------------------
// Sanitización básica: quita HTML y limita la longitud.
// ---------------------------------------------------------------
function sanitize(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  const stripped = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, maxLength);
}

// ---------------------------------------------------------------
// Límites contra envíos repetidos / spam (en memoria).
// ---------------------------------------------------------------
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const RATE_MAX_PER_IP = 4;             // máx. 4 mensajes por IP cada 10 min
const requestsByIp = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = requestsByIp.get(ip);
  if (!entry || now - entry.first > RATE_WINDOW_MS) {
    requestsByIp.set(ip, { first: now, count: 1 });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_MAX_PER_IP) return true;
  requestsByIp.set(ip, entry);
  return false;
}

// ---------------------------------------------------------------
// Validación del formulario de contacto.
// ---------------------------------------------------------------
function validateContact(body) {
  const data = {
    name: sanitize(body.name, 120),
    contact: sanitize(body.contact, 180),
    reason: sanitize(body.reason, 120),
    message: sanitize(body.message, 2000)
  };

  if (data.name.length < 2) return { error: 'Ingresá tu nombre.' };
  if (!/^[a-zA-ZÀ-ÿÁÉÍÓÚÜÑñü\s.'-]+$/.test(data.name)) {
    return { error: 'El nombre contiene caracteres no válidos.' };
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact);
  const isPhone = /^[+\d][\d\s().-]{5,20}$/.test(data.contact);
  if (!isEmail && !isPhone) {
    return { error: 'Ingresá un teléfono o un correo electrónico válido.' };
  }

  if (data.message.length < 10) {
    return { error: 'El mensaje debe tener al menos 10 caracteres.' };
  }
  return { data };
}

// ---------------------------------------------------------------
// Ruta: salud / estado.
// ---------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'psicologo-adicciones' });
});

// ---------------------------------------------------------------
// Ruta: envío del formulario de contacto.
// Inserta en Supabase usando la service role (los mensajes quedan
// en la tabla contact_messages y se ven desde el panel admin).
// ---------------------------------------------------------------
app.post('/api/contact', express.json({ limit: '20kb' }), async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    if (rateLimited(ip)) {
      return res.status(429).json({ error: 'Se superó el límite de envíos. Intentalo más tarde.' });
    }

    const result = validateContact(req.body || {});
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const admin = getAdminClient();
    if (!admin) {
      // Sin Supabase configurado, simulamos éxito para no romper el sitio
      // localmente. En producción esto no debería ocurrir.
      console.warn('[contact] Supabase no configurado: mensaje no persistido.');
      return res.json({ ok: true, note: 'demo' });
    }

    const { error } = await admin.from('contact_messages').insert({
      name: result.data.name,
      contact: result.data.contact,
      reason: result.data.reason,
      message: result.data.message,
      status: 'new'
    });

    if (error) {
      console.error('[contact] error al insertar:', error.message);
      return res.status(500).json({ error: 'No se pudo enviar el mensaje. Intentalo más tarde.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[contact] error inesperado:', err.message);
    return res.status(500).json({ error: 'No se pudo enviar el mensaje. Intentalo más tarde.' });
  }
});

// ---------------------------------------------------------------
// Config inyectada al frontend (URL + anon key públicas).
// Nunca incluye la service role key.
// ---------------------------------------------------------------
function injectConfig(html) {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  };
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  return html.replace('/*CONFIG*/ null', json);
}

function serveWithConfig(file) {
  return (_req, res) => {
    res.sendFile(file, { root: PUBLIC_DIR }, (err) => {
      if (err) {
        return res.status(404).send('No encontrado');
      }
    });
  };
}

// Inyección de configuración en las páginas principales
const fs = require('fs');

// ---------------------------------------------------------------
// Portada: sirve la carpeta "fotos" y detecta automáticamente la
// primera imagen de "fotos/perfil" como fotografía principal.
// ---------------------------------------------------------------
app.use('/fotos', express.static(path.join(__dirname, '..', 'fotos')));

app.get('/api/perfil', (_req, res) => {
  const dir = path.join(__dirname, '..', 'fotos', 'perfil');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(404).json({ error: 'no-profile-photo' });
    const img = (files || []).find((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f));
    if (!img) return res.status(404).json({ error: 'no-profile-photo' });
    res.json({ url: '/fotos/perfil/' + encodeURIComponent(img) });
  });
});

// ---------------------------------------------------------------
// Galería de charlas: detecta automáticamente todas las imágenes
// de "fotos/charlas" y las expone para armar la grilla.
// ---------------------------------------------------------------
app.get('/api/charlas', (_req, res) => {
  const dir = path.join(__dirname, '..', 'fotos', 'charlas');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(404).json({ error: 'no-charlas-photos' });
    const photos = (files || [])
      .filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }))
      .map((f) => ({ url: '/fotos/charlas/' + encodeURIComponent(f), name: f }));
    if (!photos.length) return res.status(404).json({ error: 'no-charlas-photos' });
    res.json({ photos });
  });
});

// ---------------------------------------------------------------
// Galería de testimonios: detecta automáticamente todas las
// imágenes de "fotos/testimonios" y las expone para armar la grilla.
// ---------------------------------------------------------------
app.get('/api/testimonios', (_req, res) => {
  const dir = path.join(__dirname, '..', 'fotos', 'testimonios');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(404).json({ error: 'no-testimonios-photos' });
    const photos = (files || [])
      .filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }))
      .map((f) => ({ url: '/fotos/testimonios/' + encodeURIComponent(f), name: f }));
    if (!photos.length) return res.status(404).json({ error: 'no-testimonios-photos' });
    res.json({ photos });
  });
});

function readWithConfig(file, res, next) {
  const abs = path.join(PUBLIC_DIR, file);
  fs.readFile(abs, 'utf8', (err, html) => {
    if (err) return next();
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(injectConfig(html));
  });
}

app.get('/', (req, res, next) => readWithConfig('index.html', res, next));
app.get('/index.html', (req, res, next) => readWithConfig('index.html', res, next));
app.get('/admin', (req, res, next) => readWithConfig('admin/index.html', res, next));
app.get('/admin/', (req, res, next) => readWithConfig('admin/index.html', res, next));
app.get('/admin/index.html', (req, res, next) => readWithConfig('admin/index.html', res, next));

// Archivos estáticos (css, js, assets, robots, sitemap, favicon)
app.use(
  express.static(PUBLIC_DIR, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
  })
);

// Ruta por defecto: si no coincide con nada, se sirve la portada.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  next();
});

app.get('*', serveWithConfig('index.html'));

// ---------------------------------------------------------------
// Manejo de errores genérico (mensajes que no revelan información).
// ---------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[server] error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

module.exports = app;
