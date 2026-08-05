-- =====================================================================
--  SITIO: Lic. Juan Manuel Álvarez Basabe — Consumos Problemáticos y Adicciones
--  Esquema completo para Supabase (PostgreSQL).
--
--  CÓMO USAR:
--  1. Crear un proyecto en supabase.com
--  2. Abrir el "SQL Editor" y pegar TODO este archivo, o ejecutarlo con:
--     supabase db push
--  3. Crear el usuario administrador de autenticación (ver final del archivo).
--
--  ORDEN DE CREACIÓN (importante):
--    a) extensiones
--    b) TABLAS (incluida "admins", que la función is_admin consulta)
--    c) funciones (is_admin, set_updated_at)
--    d) triggers
--    e) políticas RLS
--    f) storage
--    g) contenido provisional (seed)
--
--  El script es RE-EJECUTABLE: usa create table if not exists,
--  create or replace function, drop trigger if exists y
--  drop policy if exists, para no romper si ya hay objetos creados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABLAS (todas primero: las funciones y políticas las referencian)
-- ---------------------------------------------------------------------

-- Configuración general / perfil del profesional.
-- Cada fila es una clave con un JSON dentro (textos, fotos, contacto).
create table if not exists public.settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Administradores del panel (user_id = id de Supabase Auth).
-- Se crea ANTES de la función public.is_admin(), que la consulta.
create table if not exists public.admins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  unique (user_id)
);

-- Especialidades (tarjetas de la sección "Especialidades").
create table if not exists public.specialties (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  icon        text not null default 'leaf',
  sort_order  integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Charlas y conferencias (eventos con fotos).
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  event_date  date,
  location    text not null default '',
  published   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Imágenes de cada evento (una o varias por publicación).
create table if not exists public.event_images (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  image_url   text not null,
  alt         text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Testimonios / experiencias (con autorización).
create table if not exists public.testimonials (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  message           text not null,
  testimonial_date  date,
  is_anonymous      boolean not null default false,
  published         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Videos educativos.
create table if not exists public.videos (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text not null default '',
  thumbnail_url  text not null default '',
  category       text not null default '',
  youtube_url    text not null default '',
  published      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Mensajes del formulario de contacto.
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text not null,
  reason      text not null default '',
  message     text not null,
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES (después de las tablas que referencian)
-- ---------------------------------------------------------------------

-- 2.1 ¿El usuario autenticado es administrador?
--     Se usa en las políticas RLS de todas las tablas.
--     Se crea DESPUÉS de public.admins para que su cuerpo sea válido.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where admins.user_id = auth.uid()
  );
$$;

-- 2.2 Actualizar "updated_at" automáticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------
drop trigger if exists trg_specialties_updated on public.specialties;
create trigger trg_specialties_updated
  before update on public.specialties
  for each row execute function public.set_updated_at();

drop trigger if exists trg_events_updated on public.events;
create trigger trg_events_updated
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_testimonials_updated on public.testimonials;
create trigger trg_testimonials_updated
  before update on public.testimonials
  for each row execute function public.set_updated_at();

drop trigger if exists trg_videos_updated on public.videos;
create trigger trg_videos_updated
  before update on public.videos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. POLÍTICAS RLS
--    Regla general:
--      - Cualquier persona (anon) PUEDE LEER el contenido público.
--      - Solamente el administrador autenticado puede escribir.
--      - Los mensajes de contacto SOLO los lee el administrador.
--    Cada policy se elimina antes de crearse (drop policy if exists).
-- ---------------------------------------------------------------------

-- 4.1 settings
alter table public.settings enable row level security;
drop policy if exists "settings public read" on public.settings;
create policy "settings public read" on public.settings for select using (true);
drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- 4.2 admins
alter table public.admins enable row level security;
drop policy if exists "admins admin read" on public.admins;
create policy "admins admin read" on public.admins for select using (public.is_admin());
drop policy if exists "admins admin write" on public.admins;
create policy "admins admin write" on public.admins for all using (public.is_admin()) with check (public.is_admin());

-- 4.3 specialties
alter table public.specialties enable row level security;
drop policy if exists "specialties public read" on public.specialties;
create policy "specialties public read" on public.specialties for select using (true);
drop policy if exists "specialties admin write" on public.specialties;
create policy "specialties admin write" on public.specialties for all using (public.is_admin()) with check (public.is_admin());

-- 4.4 events
alter table public.events enable row level security;
drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events for select using (true);
drop policy if exists "events admin write" on public.events;
create policy "events admin write" on public.events for all using (public.is_admin()) with check (public.is_admin());

-- 4.5 event_images
alter table public.event_images enable row level security;
drop policy if exists "event_images public read" on public.event_images;
create policy "event_images public read" on public.event_images for select using (true);
drop policy if exists "event_images admin write" on public.event_images;
create policy "event_images admin write" on public.event_images for all using (public.is_admin()) with check (public.is_admin());

-- 4.6 testimonials
alter table public.testimonials enable row level security;
drop policy if exists "testimonials public read" on public.testimonials;
create policy "testimonials public read" on public.testimonials for select using (true);
drop policy if exists "testimonials admin write" on public.testimonials;
create policy "testimonials admin write" on public.testimonials for all using (public.is_admin()) with check (public.is_admin());

-- 4.7 videos
alter table public.videos enable row level security;
drop policy if exists "videos public read" on public.videos;
create policy "videos public read" on public.videos for select using (true);
drop policy if exists "videos admin write" on public.videos;
create policy "videos admin write" on public.videos for all using (public.is_admin()) with check (public.is_admin());

-- 4.8 contact_messages
--    Lectura SOLO para administradores. La inserción se hace desde el
--    servidor (api/) con la service role key, que salta el RLS.
alter table public.contact_messages enable row level security;
drop policy if exists "messages admin read" on public.contact_messages;
create policy "messages admin read" on public.contact_messages for select using (public.is_admin());
drop policy if exists "messages admin write" on public.contact_messages;
create policy "messages admin write" on public.contact_messages for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. STORAGE (imágenes y miniaturas)
--    Bucket público "images": cualquiera lee, solo admin escribe.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('images', 'images', true, 10485760) -- 10 MB por archivo
on conflict (id) do nothing;

drop policy if exists "images public read" on storage.objects;
create policy "images public read"
  on storage.objects for select
  using (bucket_id = 'images');

drop policy if exists "images admin insert" on storage.objects;
create policy "images admin insert"
  on storage.objects for insert
  with check (bucket_id = 'images' and public.is_admin());

drop policy if exists "images admin update" on storage.objects;
create policy "images admin update"
  on storage.objects for update
  using (bucket_id = 'images' and public.is_admin());

drop policy if exists "images admin delete" on storage.objects;
create policy "images admin delete"
  on storage.objects for delete
  using (bucket_id = 'images' and public.is_admin());

-- ---------------------------------------------------------------------
-- 6. CONTENIDO PROVISIONAL (seed)
--    Todo es de ejemplo: se reemplaza desde el panel de administración.
--    Las fotos apuntan a placeholders alojados en este mismo repo.
-- ---------------------------------------------------------------------

-- 6.1 Configuración general / portada / sobre mí / contacto
insert into public.settings (key, value) values
('hero', '{
  "name": "Lic. Juan Manuel Álvarez Basabe",
  "last_name": "Apellido",
  "title": "Licenciado en Psicología",
  "specialty": "Consumos Problemáticos y Adicciones",
  "phrase": "No tenés que atravesar este proceso en soledad. Encontrá un espacio de escucha profesional para comenzar un camino de cambio.",
  "photo_url": "/assets/img/hero-portrait.svg",
  "badge_1": "Licenciado en Psicología",
  "badge_2": "Consumos Problemáticos y Adicciones"
}'::jsonb),

('about', '{
  "photo_url": "/assets/img/about-portrait.svg",
  "name": "Lic. Juan Manuel Apellido",
  "matricula": "Matrícula N.° 000000 (provincial, provisional)",
  "formation": "Aquí se completa la formación académica: título de grado, posgrados, cursos de especialización. Contenido provisorio de ejemplo.",
  "experience": "Experiencia en el acompañamiento de personas con consumo problemático y sus familias. Años de trabajo clínico, orientación y prevención de recaídas. Contenido provisorio.",
  "specialization": "Especializado en el abordaje de adicciones y consumos problemáticos, con enfoque en la recuperación integral y el rol de la familia.",
  "presentation": "Mi nombre es Lic. Juan Manuel Apellido y trabajo hace más de X años acompañando a personas que atraviesan situaciones de consumo. Creo en un espacio de escucha respetuoso, sin juicios, donde cada persona pueda encontrar su propio camino de cambio.",
  "philosophy": "La recuperación es posible. Mi filosofía de trabajo se basa en el vínculo terapéutico, la confianza y un acompañamiento cercano, con herramientas profesionales y un enfoque humano."
}'::jsonb),

('contact', '{
  "name": "Lic. Juan Manuel Apellido",
  "whatsapp": "5491123456789",
  "phone": "+54 11 1234-5678",
  "email": "contacto@ejemplo.com",
  "address": "Dirección provisoria, Ciudad (AR)",
  "hours": "Lunes a Viernes de 9 a 18 hs (provisorio)",
  "schedule_message": "Para solicitar un turno escribinos por WhatsApp o completá el formulario."
}'::jsonb)
on conflict (key) do nothing;

-- 6.2 Especialidades
insert into public.specialties (title, description, icon, sort_order)
select v.title, v.description, v.icon, v.sort_order
from (values
  ('Adicciones', 'Abordaje integral de las adicciones con un enfoque profesional, humano y libre de juicios.', 'path', 1),
  ('Consumo problemático', 'Acompañamiento en el reconocimiento y manejo del consumo problemático de sustancias.', 'leaf', 2),
  ('Orientación y acompañamiento familiar', 'Espacio de escucha y contención para familias que acompañan a una persona en recuperación.', 'home', 3),
  ('Prevención de recaídas', 'Herramientas concretas para sostener la recuperación y prevenir situaciones de recaída.', 'shield', 4),
  ('Procesos de recuperación', 'Acompañamiento a lo largo de todo el proceso de recuperación, respetando el ritmo de cada persona.', 'steps', 5),
  ('Acompañamiento psicológico', 'Espacio de consulta individual para atravesar momentos difíciles con apoyo profesional.', 'hands', 6)
) as v(title, description, icon, sort_order)
where not exists (select 1 from public.specialties);

-- 6.3 Charlas y conferencias (eventos) con imágenes
insert into public.events (title, description, event_date, location, sort_order)
select v.title, v.description, v.event_date, v.location, v.sort_order
from (values
  ('Charla: Adicciones y familia', 'Encuentro abierto sobre el papel de la familia frente al consumo. Contenido de ejemplo.', '2025-06-10'::date, 'Ciudad (AR)', 1),
  ('Conferencia: Prevención en la comunidad', 'Conferencia sobre estrategias de prevención y detección temprana. Contenido de ejemplo.', '2025-09-05'::date, 'Ciudad (AR)', 2),
  ('Taller: Consumo problemático en jóvenes', 'Taller con escuelas y referentes comunitarios. Contenido de ejemplo.', '2025-11-20'::date, 'Ciudad (AR)', 3),
  ('Reunión con profesionales de la salud', 'Encuentro de intercambio con equipos de salud sobre acompañamiento en adicciones. Contenido de ejemplo.', '2026-03-12'::date, 'Ciudad (AR)', 4)
) as v(title, description, event_date, location, sort_order)
where not exists (select 1 from public.events);

insert into public.event_images (event_id, image_url, alt, sort_order)
select e.id, '/assets/img/event-1.svg', 'Foto de ejemplo: charla sobre adicciones y familia', 1
from public.events e
where e.title = 'Charla: Adicciones y familia'
  and not exists (select 1 from public.event_images ei where ei.event_id = e.id);

insert into public.event_images (event_id, image_url, alt, sort_order)
select e.id, '/assets/img/event-2.svg', 'Foto de ejemplo: conferencia de prevención', 1
from public.events e
where e.title = 'Conferencia: Prevención en la comunidad'
  and not exists (select 1 from public.event_images ei where ei.event_id = e.id);

insert into public.event_images (event_id, image_url, alt, sort_order)
select e.id, '/assets/img/event-3.svg', 'Foto de ejemplo: taller sobre consumo problemático', 1
from public.events e
where e.title = 'Taller: Consumo problemático en jóvenes'
  and not exists (select 1 from public.event_images ei where ei.event_id = e.id);

insert into public.event_images (event_id, image_url, alt, sort_order)
select e.id, '/assets/img/event-4.svg', 'Foto de ejemplo: reunión con profesionales de la salud', 1
from public.events e
where e.title = 'Reunión con profesionales de la salud'
  and not exists (select 1 from public.event_images ei where ei.event_id = e.id);

-- 6.4 Testimonios
insert into public.testimonials (name, message, testimonial_date, is_anonymous, sort_order)
select v.name, v.message, v.testimonial_date, v.is_anonymous, v.sort_order
from (values
  ('M. G.', 'Encontré un espacio seguro donde pude hablar sin miedo a ser juzgada. El acompañamiento cambió mi forma de ver el proceso.', '2025-08-15'::date, false, 1),
  ('J. R.', 'Gracias por la escucha y la claridad en cada encuentro. Me sentí acompañado en los momentos más difíciles.', '2025-10-02'::date, false, 2),
  ('Anónimo', 'Llegué con muchas dudas y encontré un profesional que me ayudó a ordenar el camino. Estoy muy agradecido.', '2026-01-20'::date, true, 3)
) as v(name, message, testimonial_date, is_anonymous, sort_order)
where not exists (select 1 from public.testimonials);

-- 6.5 Videos
insert into public.videos (title, description, thumbnail_url, category, youtube_url, sort_order)
select v.title, v.description, v.thumbnail_url, v.category, v.youtube_url, v.sort_order
from (values
  ('¿Cómo reconocer una adicción?', 'Señales iniciales y cómo darse cuenta. Video educativo de ejemplo.', '/assets/img/video-1.svg', 'Prevención', '', 1),
  ('¿Cuándo pedir ayuda?', 'Claves para dar el primer paso y pedir acompañamiento profesional.', '/assets/img/video-2.svg', 'Prevención', '', 2),
  ('El papel de la familia en la recuperación', 'Cómo acompañar a un familiar sin dejar de cuidarse.', '/assets/img/video-3.svg', 'Familia', '', 3),
  ('Mitos sobre las adicciones', 'Desmontamos las creencias más comunes sobre el consumo.', '/assets/img/video-1.svg', 'Información', '', 4),
  ('¿Qué esperar de la primera consulta?', 'Qué pasa en una primera entrevista y cómo prepararse.', '/assets/img/video-2.svg', 'Información', '', 5)
) as v(title, description, thumbnail_url, category, youtube_url, sort_order)
where not exists (select 1 from public.videos);

-- =====================================================================
-- 7. CREAR EL ADMINISTRADOR (HACERLO DESPUÉS DE ESTE ARCHIVO)
-- =====================================================================
-- 1) En el dashboard de Supabase: Authentication -> Users -> Add user
--    Crear el correo y la contraseña del administrador.
-- 2) Copiar el UUID (id) del usuario recién creado.
-- 3) Ejecutar:
--
--    insert into public.admins (user_id, email)
--    values ('EL-UUID-DEL-USUARIO', 'correo-del-admin@ejemplo.com');
--
-- El panel de administración (/admin) quedará accesible para esa cuenta.
-- =====================================================================
