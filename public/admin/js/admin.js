'use strict';

/* =====================================================================
   PANEL DE ADMINISTRACIÓN
   - Autenticación con Supabase Auth (solo el administrador).
   - CRUD de especialidades, charlas, testimonios, videos.
   - Edición de portada, sobre mí y contacto.
   - Subida de imágenes al storage "images".
   - Lectura de mensajes del formulario de contacto.
   ===================================================================== */

(function () {
  const cfg = window.SUPABASE_CONFIG || null;
  const supabase =
    cfg && cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null;

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const toastEl = $('#admin-toast');
  let toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastEl.hidden = true; }, 320);
    }, 3200);
  }

  function dateInput(iso) {
    if (!iso) return '';
    return String(iso).slice(0, 10);
  }
  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { return iso; }
  }

  // ------------------------------------------------------------------
  // Estado global
  // ------------------------------------------------------------------
  let session = null;
  const settings = {};
  const eventUploads = new Map(); // eventId (or 'new') -> [ {url} ]

  // ------------------------------------------------------------------
  // Autenticación
  // ------------------------------------------------------------------
  function showLogin() {
    $('#login-view').hidden = false;
    $('#admin-view').hidden = true;
    $('#admin-password').value = '';
  }
  function showAdmin(s) {
    session = s;
    $('#login-view').hidden = true;
    $('#admin-view').hidden = false;
    $('#admin-user').textContent = s.user && s.user.email ? s.user.email : '';
    switchTab('general');
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#login-error');
    errEl.hidden = true;
    const email = $('#admin-email').value.trim();
    const password = $('#admin-password').value;

    if (!supabase) {
      errEl.textContent = 'Supabase no está configurado. Revisá la configuración en el archivo .env';
      errEl.hidden = false;
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (error) {
      errEl.textContent = 'Correo o contraseña incorrectos.';
      errEl.hidden = false;
    }
  });

  $('#logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // ------------------------------------------------------------------
  // Navegación entre pestañas
  // ------------------------------------------------------------------
  const TAB_LOADERS = {
    general: loadSettings,
    specialties: loadSpecialties,
    events: loadEvents,
    testimonials: loadTestimonials,
    videos: loadVideos,
    contact: loadSettings,
    messages: loadMessages
  };
  const TAB_TITLES = {
    general: 'General', specialties: 'Especialidades', events: 'Charlas y Conferencias',
    testimonials: 'Testimonios', videos: 'Videos', contact: 'Contacto', messages: 'Mensajes recibidos'
  };

  function switchTab(name) {
    $$('.admin-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.admin-tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
    $('#panel-title').textContent = TAB_TITLES[name] || name;
    if (TAB_LOADERS[name]) TAB_LOADERS[name]();
  }

  $$('.admin-nav-item').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ------------------------------------------------------------------
  // Settings (portada / sobre mí / contacto)
  // ------------------------------------------------------------------
  let currentHeroPhoto = '';
  let currentAboutPhoto = '';

  async function loadSettings() {
    if (!supabase) return;
    const { data, error } = await supabase.from('settings').select('key,value');
    if (error || !data) return;
    settings.hero = {};
    settings.about = {};
    settings.contact = {};
    data.forEach((row) => { settings[row.key] = row.value || {}; });

    const hero = settings.hero || {};
    const about = settings.about || {};
    const contact = settings.contact || {};

    $('#h-name').value = hero.name || '';
    $('#h-title').value = hero.title || '';
    $('#h-specialty').value = hero.specialty || '';
    $('#h-badge1').value = hero.badge_1 || '';
    $('#h-badge2').value = hero.badge_2 || '';
    $('#h-phrase').value = hero.phrase || '';
    currentHeroPhoto = hero.photo_url || '';
    renderPreview('#h-photo-preview', currentHeroPhoto);

    $('#a-name').value = about.name || '';
    $('#a-matricula').value = about.matricula || '';
    $('#a-presentation').value = about.presentation || '';
    $('#a-formation').value = about.formation || '';
    $('#a-experience').value = about.experience || '';
    $('#a-specialization').value = about.specialization || '';
    $('#a-philosophy').value = about.philosophy || '';
    currentAboutPhoto = about.photo_url || '';
    renderPreview('#a-photo-preview', currentAboutPhoto);

    $('#c-name').value = contact.name || '';
    $('#c-whatsapp').value = contact.whatsapp || '';
    $('#c-whatsapp-display').value = contact.whatsapp_display || '';
    $('#c-email').value = contact.email || '';
    $('#c-linkedin').value = contact.linkedin || '';
    $('#c-facebook').value = contact.facebook || '';
    $('#c-location').value = contact.location || '';
    $('#c-schedule-message').value = contact.schedule_message || '';
  }

  async function saveSettingsRow(key, value) {
    const { error } = await supabase.from('settings').upsert(
      { key, value },
      { onConflict: 'key' }
    );
    return error;
  }

  // ---------- Portada ----------
  $('#hero-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#hero-status');
    const value = {
      name: $('#h-name').value.trim(),
      title: $('#h-title').value.trim(),
      specialty: $('#h-specialty').value.trim(),
      badge_1: $('#h-badge1').value.trim(),
      badge_2: $('#h-badge2').value.trim(),
      phrase: $('#h-phrase').value.trim(),
      photo_url: currentHeroPhoto
    };
    status.textContent = 'Guardando…';
    const error = await saveSettingsRow('hero', value);
    if (error) {
      status.textContent = 'No se pudo guardar. ' + error.message;
      status.className = 'form-status error';
    } else {
      status.textContent = 'Portada guardada correctamente.';
      status.className = 'form-status success';
      toast('Portada guardada.');
    }
  });

  // ---------- Sobre mí ----------
  $('#about-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#about-status');
    const value = {
      name: $('#a-name').value.trim(),
      matricula: $('#a-matricula').value.trim(),
      presentation: $('#a-presentation').value.trim(),
      formation: $('#a-formation').value.trim(),
      experience: $('#a-experience').value.trim(),
      specialization: $('#a-specialization').value.trim(),
      philosophy: $('#a-philosophy').value.trim(),
      photo_url: currentAboutPhoto
    };
    status.textContent = 'Guardando…';
    const error = await saveSettingsRow('about', value);
    if (error) {
      status.textContent = 'No se pudo guardar. ' + error.message;
      status.className = 'form-status error';
    } else {
      status.textContent = 'Sección “Sobre mí” guardada.';
      status.className = 'form-status success';
      toast('Sobre mí guardado.');
    }
  });

  // ---------- Contacto ----------
  $('#contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#contact-status');
    const value = {
      name: $('#c-name').value.trim(),
      whatsapp: $('#c-whatsapp').value.trim().replace(/\D/g, ''),
      whatsapp_display: $('#c-whatsapp-display').value.trim(),
      email: $('#c-email').value.trim(),
      linkedin: $('#c-linkedin').value.trim(),
      facebook: $('#c-facebook').value.trim(),
      location: $('#c-location').value.trim(),
      schedule_message: $('#c-schedule-message').value.trim()
    };
    status.textContent = 'Guardando…';
    const error = await saveSettingsRow('contact', value);
    if (error) {
      status.textContent = 'No se pudo guardar. ' + error.message;
      status.className = 'form-status error';
    } else {
      status.textContent = 'Datos de contacto guardados.';
      status.className = 'form-status success';
      toast('Contacto guardado.');
    }
  });

  // ---------- Subida de imágenes ----------
  async function uploadImage(file, folder) {
    if (!file) throw new Error('Sin archivo');
    const ext = file.name.split('.').pop() || 'jpg';
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const path = (folder || 'general') + '/' + safe;
    const { error } = await supabase.storage.from('images').upload(path, file, {
      cacheControl: '3600', upsert: false
    });
    if (error) throw error;
    return supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
  }

  function renderPreview(sel, url) {
    const host = $(sel);
    if (!url) { host.innerHTML = ''; return; }
    host.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Vista previa" />';
  }

  // Foto portada
  $('#h-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      currentHeroPhoto = await uploadImage(file, 'hero');
      renderPreview('#h-photo-preview', currentHeroPhoto);
      toast('Foto de portada lista para guardarse.');
    } catch (err) {
      toast('Error al subir la foto: ' + err.message);
    }
  });

  // Foto sobre mí
  $('#a-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      currentAboutPhoto = await uploadImage(file, 'about');
      renderPreview('#a-photo-preview', currentAboutPhoto);
      toast('Foto lista para guardarse.');
    } catch (err) {
      toast('Error al subir la foto: ' + err.message);
    }
  });

  // ------------------------------------------------------------------
  // ESPECIALIDADES
  // ------------------------------------------------------------------
  let specialtiesCache = [];
  async function loadSpecialties() {
    const { data, error } = await supabase
      .from('specialties').select('*').order('sort_order', { ascending: true });
    if (error) { toast('Error al cargar: ' + error.message); return; }
    specialtiesCache = data || [];
    renderSpecialties();
  }

  const SPECIALTY_ICONS = ['path', 'leaf', 'home', 'shield', 'steps', 'hands'];

  function renderSpecialties() {
    const host = $('#specialties-editor');
    host.innerHTML = '';
    if (!specialtiesCache.length) {
      host.innerHTML = '<p class="empty-hint">Todavía no hay especialidades. Agregá una con el botón.</p>';
    }
    specialtiesCache.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML =
        '<div class="item-head"><span class="item-title">' + escapeHtml(item.title || 'Nueva especialidad') + '</span>' +
          '<div class="item-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-act="save">Guardar</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-act="delete">Eliminar</button>' +
          '</div></div>' +
        '<div class="form-grid">' +
          '<div class="form-field"><label>Título</label><input type="text" data-f="title" value="' + escapeHtml(item.title || '') + '" /></div>' +
          '<div class="form-field"><label>Ícono</label><select data-f="icon">' +
            SPECIALTY_ICONS.map((i) => '<option value="' + i + '"' + (item.icon === i ? ' selected' : '') + '>' + i + '</option>').join('') +
          '</select></div>' +
          '<div class="form-field form-field-full"><label>Descripción</label><textarea rows="3" data-f="description">' + escapeHtml(item.description || '') + '</textarea></div>' +
          '<div class="form-field"><label>Orden</label><input type="number" data-f="sort_order" value="' + (item.sort_order || 0) + '" /></div>' +
          '<div class="form-field"><div class="check-row"><input type="checkbox" id="spec-pub-' + item.id + '" data-f="published"' + (item.published !== false ? ' checked' : '') + ' /><label for="spec-pub-' + item.id + '">Publicada</label></div></div>' +
        '</div>';
      $('[data-act="save"]', card).addEventListener('click', () => saveSpecialty(card, item));
      $('[data-act="delete"]', card).addEventListener('click', () => deleteItem('specialties', item.id, '¿Eliminar esta especialidad?', loadSpecialties));
      host.appendChild(card);
    });
  }

  async function saveSpecialty(card, item) {
    const payload = readFields(card);
    payload.published = readCheck(card, 'published');
    const base = { title: payload.title, description: payload.description, icon: payload.icon, sort_order: Number(payload.sort_order) || 0, published: payload.published };
    if (item.id) base.id = item.id;
    const { error } = await supabase.from('specialties').upsert(base, { onConflict: 'id' });
    if (error) { toast('Error al guardar: ' + error.message); return; }
    toast('Especialidad guardada.');
    loadSpecialties();
  }

  $('#add-specialty').addEventListener('click', async () => {
    const { data, error } = await supabase.from('specialties').insert({
      title: 'Nueva especialidad',
      description: 'Descripción provisoria. Editá y guardá.',
      icon: 'leaf', sort_order: specialtiesCache.length + 1, published: true
    }).select();
    if (error) { toast('Error: ' + error.message); return; }
    toast('Especialidad creada. Completá los datos y guardá.');
    loadSpecialties();
  });

  // ------------------------------------------------------------------
  // CHARLAS Y CONFERENCIAS
  // ------------------------------------------------------------------
  let eventsCache = [];
  async function loadEvents() {
    const { data, error } = await supabase
      .from('events').select('*, event_images(id, image_url, alt, sort_order)').order('sort_order', { ascending: true });
    if (error) { toast('Error al cargar: ' + error.message); return; }
    eventsCache = data || [];
    renderEvents();
  }

  function renderEvents() {
    const host = $('#events-editor');
    host.innerHTML = '';
    if (!eventsCache.length) {
      host.innerHTML = '<p class="empty-hint">Todavía no hay actividades. Agregá una con el botón.</p>';
    }
    eventsCache.forEach((ev) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML =
        '<div class="item-head"><span class="item-title">' + escapeHtml(ev.title || 'Nueva actividad') + '</span>' +
          '<div class="item-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-act="save">Guardar</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-act="delete">Eliminar</button>' +
          '</div></div>' +
        '<div class="form-grid">' +
          '<div class="form-field"><label>Título</label><input type="text" data-f="title" value="' + escapeHtml(ev.title || '') + '" /></div>' +
          '<div class="form-field"><label>Fecha</label><input type="date" data-f="event_date" value="' + dateInput(ev.event_date) + '" /></div>' +
          '<div class="form-field"><label>Ubicación (opcional)</label><input type="text" data-f="location" value="' + escapeHtml(ev.location || '') + '" /></div>' +
          '<div class="form-field"><label>Orden</label><input type="number" data-f="sort_order" value="' + (ev.sort_order || 0) + '" /></div>' +
          '<div class="form-field form-field-full"><label>Descripción</label><textarea rows="3" data-f="description">' + escapeHtml(ev.description || '') + '</textarea></div>' +
          '<div class="form-field form-field-full"><label>Fotos (podés subir varias)</label><input type="file" data-f="files" accept="image/*" multiple /><div class="upload-preview" data-role="images"></div></div>' +
          '<div class="form-field"><div class="check-row"><input type="checkbox" id="ev-pub-' + ev.id + '" data-f="published"' + (ev.published !== false ? ' checked' : '') + ' /><label for="ev-pub-' + ev.id + '">Publicada</label></div></div>' +
        '</div>';
      const imgs = (ev.event_images || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const uploaded = eventUploads.get(ev.id) || [];
      renderEventImages($('[data-role="images"]', card), imgs, uploaded, ev.id);
      $('[data-f="files"]', card).addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        uploadEventFiles(ev.id, files, card);
      });
      $('[data-act="save"]', card).addEventListener('click', () => saveEvent(card, ev));
      $('[data-act="delete"]', card).addEventListener('click', () => deleteItem('events', ev.id, '¿Eliminar esta actividad?', loadEvents));
      host.appendChild(card);
    });
  }

  function renderEventImages(host, existing, uploaded, eventId) {
    host.innerHTML = '';
    existing.forEach((img) => {
      const row = document.createElement('span');
      row.className = 'thumb-row';
      row.innerHTML = '<img src="' + escapeHtml(img.image_url) + '" alt="" /><button class="thumb-remove" type="button" aria-label="Quitar">✕</button>';
      $('.thumb-remove', row).addEventListener('click', async () => {
        await supabase.from('event_images').delete().eq('id', img.id);
        toast('Imagen quitada.');
        loadEvents();
      });
      host.appendChild(row);
    });
    uploaded.forEach((url) => {
      const row = document.createElement('span');
      row.className = 'thumb-row';
      row.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Nueva" /><button class="thumb-remove" type="button" aria-label="Quitar">✕</button>';
      $('.thumb-remove', row).addEventListener('click', () => {
        eventUploads.set(eventId, (eventUploads.get(eventId) || []).filter((u) => u !== url));
        loadEvents();
      });
      host.appendChild(row);
    });
  }

  async function uploadEventFiles(eventId, files, card) {
    const list = eventUploads.get(eventId) || [];
    for (const file of files) {
      try {
        const url = await uploadImage(file, 'events');
        list.push(url);
      } catch (err) {
        toast('Error al subir una imagen: ' + err.message);
      }
    }
    eventUploads.set(eventId, list);
    const ev = eventsCache.find((e) => e.id === eventId);
    renderEventImages($('[data-role="images"]', card), ev ? ev.event_images || [] : [], list, eventId);
    toast('Imágenes listas para guardarse.');
  }

  async function saveEvent(card, ev) {
    const payload = readFields(card);
    payload.published = readCheck(card, 'published');
    const base = {
      title: payload.title, description: payload.description,
      event_date: payload.event_date || null, location: payload.location,
      sort_order: Number(payload.sort_order) || 0, published: payload.published
    };
    const { data, error } = await supabase.from('events').upsert(
      ev.id ? Object.assign({ id: ev.id }, base) : base, { onConflict: 'id' }
    ).select();
    if (error) { toast('Error al guardar: ' + error.message); return; }

    const eventId = ev.id || data[0].id;
    const newImages = eventUploads.get(ev.id || '') || [];
    if (newImages.length) {
      const rows = newImages.map((url, i) => ({
        event_id: eventId, image_url: url, alt: base.title, sort_order: 99 + i
      }));
      const { error: imgErr } = await supabase.from('event_images').insert(rows);
      if (imgErr) toast('Actividad guardada, pero hubo un error con las imágenes: ' + imgErr.message);
      eventUploads.delete(ev.id || '');
    }
    toast('Actividad guardada.');
    loadEvents();
  }

  $('#add-event').addEventListener('click', async () => {
    const { data, error } = await supabase.from('events').insert({
      title: 'Nueva actividad', description: 'Descripción provisoria.', location: '',
      published: true, sort_order: eventsCache.length + 1
    }).select();
    if (error) { toast('Error: ' + error.message); return; }
    toast('Actividad creada. Completá los datos y guardá.');
    loadEvents();
  });

  // ------------------------------------------------------------------
  // TESTIMONIOS
  // ------------------------------------------------------------------
  let testimonialsCache = [];
  async function loadTestimonials() {
    const { data, error } = await supabase
      .from('testimonials').select('*').order('sort_order', { ascending: true });
    if (error) { toast('Error al cargar: ' + error.message); return; }
    testimonialsCache = data || [];
    renderTestimonials();
  }

  function renderTestimonials() {
    const host = $('#testimonials-editor');
    host.innerHTML = '';
    if (!testimonialsCache.length) {
      host.innerHTML = '<p class="empty-hint">Todavía no hay testimonios.</p>';
    }
    testimonialsCache.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML =
        '<div class="item-head"><span class="item-title">' + escapeHtml(item.name || 'Nuevo testimonio') + '</span>' +
          '<div class="item-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-act="save">Guardar</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-act="delete">Eliminar</button>' +
          '</div></div>' +
        '<div class="form-grid">' +
          '<div class="form-field"><label>Nombre o iniciales</label><input type="text" data-f="name" value="' + escapeHtml(item.name || '') + '" /></div>' +
          '<div class="form-field"><label>Fecha (opcional)</label><input type="date" data-f="testimonial_date" value="' + dateInput(item.testimonial_date) + '" /></div>' +
          '<div class="form-field form-field-full"><label>Mensaje</label><textarea rows="3" data-f="message">' + escapeHtml(item.message || '') + '</textarea></div>' +
          '<div class="form-field"><label>Orden</label><input type="number" data-f="sort_order" value="' + (item.sort_order || 0) + '" /></div>' +
          '<div class="form-field"><div class="check-row"><input type="checkbox" id="anon-' + item.id + '" data-f="is_anonymous"' + (item.is_anonymous ? ' checked' : '') + ' /><label for="anon-' + item.id + '">Mostrar como anónimo</label></div></div>' +
          '<div class="form-field"><div class="check-row"><input type="checkbox" id="tes-pub-' + item.id + '" data-f="published"' + (item.published !== false ? ' checked' : '') + ' /><label for="tes-pub-' + item.id + '">Publicado</label></div></div>' +
        '</div>';
      $('[data-act="save"]', card).addEventListener('click', () => saveTestimonial(card, item));
      $('[data-act="delete"]', card).addEventListener('click', () => deleteItem('testimonials', item.id, '¿Eliminar este testimonio?', loadTestimonials));
      host.appendChild(card);
    });
  }

  async function saveTestimonial(card, item) {
    const payload = readFields(card);
    payload.published = readCheck(card, 'published');
    payload.is_anonymous = readCheck(card, 'is_anonymous');
    const base = {
      name: payload.name, message: payload.message,
      testimonial_date: payload.testimonial_date || null,
      sort_order: Number(payload.sort_order) || 0,
      published: payload.published, is_anonymous: payload.is_anonymous
    };
    if (item.id) base.id = item.id;
    const { error } = await supabase.from('testimonials').upsert(base, { onConflict: 'id' });
    if (error) { toast('Error al guardar: ' + error.message); return; }
    toast('Testimonio guardado.');
    loadTestimonials();
  }

  $('#add-testimonial').addEventListener('click', async () => {
    const { data, error } = await supabase.from('testimonials').insert({
      name: 'Nuevo testimonio', message: 'Mensaje provisorio.', published: true,
      is_anonymous: false, sort_order: testimonialsCache.length + 1
    }).select();
    if (error) { toast('Error: ' + error.message); return; }
    toast('Testimonio creado.');
    loadTestimonials();
  });

  // ------------------------------------------------------------------
  // VIDEOS
  // ------------------------------------------------------------------
  let videosCache = [];
  const videoThumbs = new Map(); // id -> url pendiente

  async function loadVideos() {
    const { data, error } = await supabase
      .from('videos').select('*').order('sort_order', { ascending: true });
    if (error) { toast('Error al cargar: ' + error.message); return; }
    videosCache = data || [];
    renderVideos();
  }

  function renderVideos() {
    const host = $('#videos-editor');
    host.innerHTML = '';
    if (!videosCache.length) {
      host.innerHTML = '<p class="empty-hint">Todavía no hay videos.</p>';
    }
    videosCache.forEach((item) => {
      const thumb = videoThumbs.get(item.id) || item.thumbnail_url || '';
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML =
        '<div class="item-head"><span class="item-title">' + escapeHtml(item.title || 'Nuevo video') + '</span>' +
          '<div class="item-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-act="save">Guardar</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-act="delete">Eliminar</button>' +
          '</div></div>' +
        '<div class="form-grid">' +
          '<div class="form-field"><label>Título</label><input type="text" data-f="title" value="' + escapeHtml(item.title || '') + '" /></div>' +
          '<div class="form-field"><label>Categoría</label><input type="text" data-f="category" value="' + escapeHtml(item.category || '') + '" placeholder="Prevención, Familia, Información…" /></div>' +
          '<div class="form-field form-field-full"><label>Descripción breve</label><textarea rows="2" data-f="description">' + escapeHtml(item.description || '') + '</textarea></div>' +
          '<div class="form-field form-field-full"><label>Enlace de YouTube (opcional)</label><input type="url" data-f="youtube_url" value="' + escapeHtml(item.youtube_url || '') + '" placeholder="https://www.youtube.com/watch?v=…" /></div>' +
          '<div class="form-field"><label>Miniatura</label><input type="file" data-f="file" accept="image/*" /><div class="upload-preview" data-role="thumb">' +
            (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="Miniatura" />' : '') + '</div></div>' +
          '<div class="form-field"><label>Orden</label><input type="number" data-f="sort_order" value="' + (item.sort_order || 0) + '" /></div>' +
          '<div class="form-field"><div class="check-row"><input type="checkbox" id="vid-pub-' + item.id + '" data-f="published"' + (item.published !== false ? ' checked' : '') + ' /><label for="vid-pub-' + item.id + '">Publicado</label></div></div>' +
        '</div>';
      $('[data-f="file"]', card).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const url = await uploadImage(file, 'videos');
          videoThumbs.set(item.id, url);
          $('[data-role="thumb"]', card).innerHTML = '<img src="' + escapeHtml(url) + '" alt="Miniatura" />';
          toast('Miniatura lista para guardarse.');
        } catch (err) {
          toast('Error al subir: ' + err.message);
        }
      });
      $('[data-act="save"]', card).addEventListener('click', () => saveVideo(card, item));
      $('[data-act="delete"]', card).addEventListener('click', () => deleteItem('videos', item.id, '¿Eliminar este video?', loadVideos));
      host.appendChild(card);
    });
  }

  async function saveVideo(card, item) {
    const payload = readFields(card);
    payload.published = readCheck(card, 'published');
    const thumb = videoThumbs.get(item.id);
    const base = {
      title: payload.title, description: payload.description,
      category: payload.category, youtube_url: payload.youtube_url,
      thumbnail_url: thumb || item.thumbnail_url || '',
      sort_order: Number(payload.sort_order) || 0, published: payload.published
    };
    if (item.id) base.id = item.id;
    const { error } = await supabase.from('videos').upsert(base, { onConflict: 'id' });
    if (error) { toast('Error al guardar: ' + error.message); return; }
    videoThumbs.delete(item.id);
    toast('Video guardado.');
    loadVideos();
  }

  $('#add-video').addEventListener('click', async () => {
    const { data, error } = await supabase.from('videos').insert({
      title: 'Nuevo video', description: 'Descripción provisoria.',
      category: '', youtube_url: '', thumbnail_url: '', published: true,
      sort_order: videosCache.length + 1
    }).select();
    if (error) { toast('Error: ' + error.message); return; }
    toast('Video creado.');
    loadVideos();
  });

  // ------------------------------------------------------------------
  // MENSAJES DE CONTACTO
  // ------------------------------------------------------------------
  async function loadMessages() {
    const { data, error } = await supabase
      .from('contact_messages').select('*').order('created_at', { ascending: false });
    if (error) { toast('Error al cargar: ' + error.message); return; }
    const list = data || [];
    const newCount = list.filter((m) => m.status === 'new').length;
    const badge = $('#msg-count');
    if (newCount > 0) { badge.textContent = newCount; badge.hidden = false; }
    else badge.hidden = true;

    const host = $('#messages-list');
    host.innerHTML = '';
    if (!list.length) {
      host.innerHTML = '<p class="empty-hint">Todavía no recibiste mensajes.</p>';
      return;
    }
    list.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'msg-card' + (m.status === 'read' ? ' read' : '');
      card.innerHTML =
        '<div class="msg-meta">' +
          '<span><strong>' + escapeHtml(m.name) + '</strong></span>' +
          '<span>' + escapeHtml(m.contact) + '</span>' +
          (m.reason ? '<span>Motivo: ' + escapeHtml(m.reason) + '</span>' : '') +
          '<span>' + escapeHtml(formatDate(m.created_at)) + '</span>' +
        '</div>' +
        '<p class="msg-text">' + escapeHtml(m.message) + '</p>' +
        '<div class="msg-actions">' +
          (m.status === 'new' ? '<button class="btn btn-ghost btn-sm" type="button" data-act="read">Marcar como leído</button>' : '') +
          '<button class="btn btn-danger btn-sm" type="button" data-act="delete">Eliminar</button>' +
        '</div>';
      if (m.status === 'new') {
        $('[data-act="read"]', card).addEventListener('click', async () => {
          await supabase.from('contact_messages').update({ status: 'read' }).eq('id', m.id);
          toast('Marcado como leído.');
          loadMessages();
        });
      }
      $('[data-act="delete"]', card).addEventListener('click', () => deleteItem('contact_messages', m.id, '¿Eliminar este mensaje?', loadMessages));
      host.appendChild(card);
    });
  }

  // ------------------------------------------------------------------
  // Helpers de CRUD
  // ------------------------------------------------------------------
  function readFields(card) {
    const out = {};
    $$('[data-f]', card).forEach((el) => {
      if (el.type === 'file') return;
      out[el.dataset.f] = el.value;
    });
    return out;
  }
  function readCheck(card, name) {
    const el = $('[data-f="' + name + '"]', card);
    return el ? el.checked : false;
  }
  async function deleteItem(table, id, confirmMsg, reload) {
    if (!window.confirm(confirmMsg)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { toast('No se pudo eliminar: ' + error.message); return; }
    toast('Eliminado.');
    reload();
  }

  // ------------------------------------------------------------------
  // Inicio
  // ------------------------------------------------------------------
  async function init() {
    if (!supabase) {
      showLogin();
      const errEl = $('#login-error');
      errEl.textContent = 'Supabase no está configurado. Completá SUPABASE_URL y SUPABASE_ANON_KEY en el archivo .env y reiniciá el servidor.';
      errEl.hidden = false;
      return;
    }
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s) showAdmin(s);
    else showLogin();

    supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) showAdmin(newSession);
      else showLogin();
    });
  }

  init();
})();
