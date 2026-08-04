# Sitio web profesional — Lic. en Psicología · Especialista en Adicciones

Página web de una sola pantalla con portada fija, menú lateral, panel de
administración y base de datos en Supabase. Pensada para un profesional de la
salud mental: transmite calma, confianza, seriedad y cercanía.

> Todo el contenido actual es **provisional** (textos, fotos y datos de
> contacto de ejemplo). Se reemplaza desde el panel de administración sin
> tocar código.

---

## Tabla de contenidos

1. [Cómo funciona](#cómo-funciona)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Requisitos](#requisitos)
4. [Ejecución local](#ejecución-local)
5. [Configurar Supabase](#configurar-supabase)
6. [Panel de administración](#panel-de-administración)
7. [Despliegue en Vercel](#despliegue-en-vercel)
8. [Reemplazar imágenes, videos y textos](#reemplazar-imágenes-videos-y-textos)
9. [Seguridad](#seguridad)
10. [Preguntas frecuentes](#preguntas-frecuentes)

---

## Cómo funciona

- Al entrar se ve **solo la portada**, que ocupa toda la pantalla y nunca se
  desplaza.
- No hay scroll para navegar entre secciones: el menú lateral cambia de
  sección con una transición suave (SPA).
- El botón con el nombre del profesional (arriba en el menú) vuelve a la
  portada.
- Las secciones leen el contenido de Supabase. Si Supabase no está
  configurado, el sitio muestra contenido provisorio para no quedar en blanco.
- En celular el menú lateral se transforma en un menú desplegable.

---

## Estructura del proyecto

```
.
├── api/
│   ├── app.js              # App Express compartida (local y Vercel)
│   └── index.js            # Entrada serverless para Vercel
├── public/
│   ├── index.html          # Portada y secciones (SPA)
│   ├── css/styles.css      # Estilos del sitio público
│   ├── js/app.js           # Lógica del sitio público
│   ├── admin/              # Panel de administración
│   │   ├── index.html
│   │   ├── css/admin.css
│   │   └── js/admin.js
│   └── assets/
│       ├── img/            # Placeholders SVG (foto, charlas, videos, og)
│       └── icons/favicon.svg
├── sql/
│   └── schema.sql          # Esquema completo de Supabase (tablas, RLS, seed)
├── server.js               # Servidor local
├── vercel.json             # Configuración de despliegue
├── .env.example            # Modelo de variables de entorno
├── .gitignore
└── package.json
```

---

## Requisitos

- **Node.js** 18 o superior.
- Una cuenta gratuita en [supabase.com](https://supabase.com).
- Una cuenta en [vercel.com](https://vercel.com) (solo para publicar).

---

## Ejecución local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear el archivo `.env` copiando el modelo:

   ```bash
   cp .env.example .env     # Windows:  copy .env.example .env
   ```

3. Completar `.env` con los datos de tu proyecto Supabase (ver abajo).

4. Iniciar el servidor:

   ```bash
   npm start
   ```

5. Abrir:
   - Sitio: `http://localhost:3000`
   - Panel: `http://localhost:3000/admin`

> Sin Supabase configurado el sitio igual funciona con contenido provisorio,
> y el formulario de contacto responde de forma simulada.

---

## Configurar Supabase

### 1. Crear el proyecto

Crear un proyecto en supabase.com y anotar desde
**Settings → API**:

- `Project URL`
- `anon public` key
- `service_role` key

Pegarlos en `.env`:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...service_role...
```

### 2. Crear la base de datos

Abrir el **SQL Editor** de Supabase, pegar **todo** el contenido de
`sql/schema.sql` y ejecutarlo. Esto crea:

- Tablas: `settings`, `admins`, `specialties`, `events`, `event_images`,
  `testimonials`, `videos`, `contact_messages`.
- Políticas de seguridad **RLS**: el público solo lee; solo el admin escribe.
- Un bucket público `images` para subir fotos y miniaturas.
- Contenido provisorio de ejemplo (portada, especialidades, charlas,
  testimonios y videos).

### 3. Crear el usuario administrador

1. En Supabase: **Authentication → Users → Add user** y crear el correo y la
   contraseña del administrador.
2. Copiar el **UUID** del usuario creado.
3. En el SQL Editor ejecutar:

   ```sql
   insert into public.admins (user_id, email)
   values ('EL-UUID-DEL-USUARIO', 'correo-del-admin@ejemplo.com');
   ```

4. Ingresar en `http://localhost:3000/admin` con ese correo y contraseña.

---

## Panel de administración

Desde `/admin` se puede, sin conocimientos técnicos:

- **General**: foto de portada, nombre, título, especialidad, frase principal,
  datos breves, y toda la sección “Sobre mí” (matrícula, formación,
  experiencia, filosofía…).
- **Especialidades**: agregar, editar, ocultar y eliminar tarjetas.
- **Charlas y Conferencias**: publicaciones con título, descripción, fecha,
  ubicación y **varias fotos** por publicación.
- **Testimonios**: nombre o iniciales, mensaje, fecha y opción **anónimo**.
- **Videos**: título, descripción, categoría, miniatura y enlace de YouTube.
- **Contacto**: WhatsApp, teléfono, correo, dirección y horarios.
- **Mensajes**: los mensajes enviados desde el formulario, con opción de
  marcarlos como leídos.

El botón **Publicado/Publicada** permite ocultar contenido sin eliminarlo.

> Solo el administrador autenticado puede modificar contenido: lo garantizan
> las políticas RLS de Supabase, no solo la interfaz.

---

## Despliegue en Vercel

1. Subir el proyecto a GitHub.

2. En vercel.com: **Add New → Project**, importar el repositorio.

3. En **Settings → Environment Variables** agregar las mismas tres variables
   del `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

4. El proyecto ya incluye `vercel.json`; no hace falta framework. Desplegar.

5. Reemplazar en `public/sitemap.xml`, `public/robots.txt` y en el
   `<head>` de `public/index.html` el dominio de ejemplo
   (`tu-dominio-ejemplo.com`) por el dominio real.

---

## Reemplazar imágenes, videos y textos

Todo se reemplaza desde el panel de administración. Las imágenes subidas
quedan guardadas en el bucket `images` de Supabase.

| Elemento                     | Dónde se cambia            |
| ---------------------------- | -------------------------- |
| Foto principal de la portada | Panel → General → Portada  |
| Foto de “Sobre mí”           | Panel → General → Sobre mí |
| Fotos de charlas             | Panel → Charlas y Conferencias |
| Miniaturas de videos         | Panel → Videos             |
| Textos, título, frase        | Panel → General            |
| WhatsApp, teléfono, correo   | Panel → Contacto           |
| Especialidades, testimonios  | Panel → cada sección       |

Los archivos placeholder (`public/assets/img/*.svg`) se usan solo mientras no
haya fotos reales. Para reemplazar a mano (opcional), subir la imagen
definitiva y cambiar la URL en el panel.

**Videos definitivos:** en Panel → Videos, pegar el enlace de YouTube en
“Enlace de YouTube”. El sitio detecta el ID y lo reproduce en un reproductor
incorporado. Si no hay enlace, la tarjeta muestra “Disponible próximamente”.

---

## Seguridad

- La **service role key nunca llega al frontend**: se usa solo en `api/app.js`
  para guardar los mensajes del formulario.
- El frontend usa únicamente la `anon` key con **RLS** activado.
- El formulario de contacto valida y sanitiza los datos en el servidor y tiene
  un **límite de envíos** por IP (básico contra spam).
- Las rutas `/admin` no se indexan (`noindex`) y están protegidas por
  autenticación.
- Los mensajes de error no revelan información sensible.

---

## Preguntas frecuentes

**¿El sitio funciona sin Supabase?**
Sí: muestra contenido provisorio y el formulario responde en modo demo.

**¿Cómo creo más de un administrador?**
Insertando otra fila en `admins` con el UUID de otro usuario de
Authentication.

**¿Cómo cambio la paleta de colores?**
Todas las variables están al inicio de `public/css/styles.css` y
`public/admin/css/admin.css` (bloque `:root`).

**¿El contenido en celular se ve bien?**
Sí: el menú lateral se convierte en menú desplegable y las grillas se
acomodan a una columna.
