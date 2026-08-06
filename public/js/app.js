'use strict';

/* =====================================================================
   SITIO: Lic. Juan Manuel Álvarez Basabe — Consumos Problemáticos y Adicciones
   JS del lado del cliente:
   - Navegación SPA (portada fija, secciones que cambian sin scroll)
   - Carga de contenido desde Supabase (con contenido provisorio de respaldo)
   - Lightbox de imágenes y reproductor de videos
   ===================================================================== */

(function () {
  // ------------------------------------------------------------------
  // CONTENIDO PROVISORIO DE RESPALDO (se usa si Supabase no está
  // configurado o si la carga falla). Se reemplaza desde el panel admin.
  // ------------------------------------------------------------------
  const DEFAULTS = {
    hero: {
      name: 'Lic. Juan Manuel Álvarez Basabe',
      title: 'Licenciado en Psicología',
      specialty: 'Consumos Problemáticos y Adicciones',
      phrase:
        'No tenés que atravesar este proceso en soledad. Encontrá un espacio de escucha profesional para comenzar un camino de cambio.',
      photo_url: '/assets/img/hero-portrait.svg',
      badge_1: 'Licenciado en Psicología',
      badge_2: 'Consumos Problemáticos y Adicciones'
    },
    about: {
      photo_url: '/assets/img/about-portrait.svg',
      name: 'Lic. Juan Manuel Apellido',
      matricula: 'Matrícula N.° 000000 (provincial, provisional)',
      formation:
        'Aquí se completa la formación académica: título de grado, posgrados, cursos de especialización. Contenido provisorio de ejemplo.',
      experience:
        'Experiencia en el acompañamiento de personas con consumo problemático y sus familias. Contenido provisorio.',
      specialization:
        'Especializado en el abordaje de adicciones y consumos problemáticos, con enfoque en la recuperación integral y el rol de la familia.',
      presentation:
        'Mi nombre es Lic. Juan Manuel Apellido y trabajo hace más de X años acompañando a personas que atraviesan situaciones de consumo. Creo en un espacio de escucha respetuoso, sin juicios, donde cada persona pueda encontrar su propio camino de cambio.',
      philosophy:
        'La recuperación es posible. Mi filosofía de trabajo se basa en el vínculo terapéutico, la confianza y un acompañamiento cercano, con herramientas profesionales y un enfoque humano.'
    },
    contact: {
      name: 'Lic. Juan Manuel Álvarez Basabe',
      whatsapp: '5492474443614',
      whatsapp_display: '+54 9 2474 443614',
      email: 'contacto@ejemplo.com',
      linkedin: 'https://www.linkedin.com/in/juan-manuel-alvarez-basabe-701919238',
      facebook: 'https://www.facebook.com/share/1Eoafbv3hv/',
      location: 'Atención en Pergamino, Colón y otras localidades de la región.\n\nConsultá disponibilidad por WhatsApp.',
      schedule_message:
        'Hola Juan Manuel. Estuve visitando tu página web y me gustaría recibir información sobre una consulta.'
    },
    specialties: [
      { title: 'Adicciones', description: 'Abordaje integral de las adicciones con un enfoque profesional, humano y libre de juicios.', icon: 'path' },
      { title: 'Consumo problemático', description: 'Acompañamiento en el reconocimiento y manejo del consumo problemático de sustancias.', icon: 'leaf' },
      { title: 'Orientación y acompañamiento familiar', description: 'Espacio de escucha y contención para familias que acompañan a una persona en recuperación.', icon: 'home' },
      { title: 'Prevención de recaídas', description: 'Herramientas concretas para sostener la recuperación y prevenir situaciones de recaída.', icon: 'shield' },
      { title: 'Procesos de recuperación', description: 'Acompañamiento a lo largo de todo el proceso de recuperación, respetando el ritmo de cada persona.', icon: 'steps' },
      { title: 'Acompañamiento psicológico', description: 'Espacio de consulta individual para atravesar momentos difíciles con apoyo profesional.', icon: 'hands' }
    ],
    videos: [
      {
        title: 'Entrevista en Canal 2 (2/5): el consumo problemático de un familiar',
        description: 'La adicción como problemática familiar y social. Entrevista del Lic. Juan Manuel Alvarez Basabe.',
        thumbnail_url: '/fotos/videos/video-1.jpg',
        youtube_url: 'https://www.facebook.com/reel/747535472926657/',
        facebook_url: 'https://www.facebook.com/share/v/199qQazoZj/'
      },
      {
        title: 'Dejar de estar dominado por la adicción',
        description: 'Una persona puede dejar de estar dominada por la adicción, recuperar su libertad y sostener años de recuperación. La dependencia física desaparece, el cuerpo se estabiliza y la persona puede reconstruir su vida.',
        thumbnail_url: '/fotos/videos/video-2.jpg',
        youtube_url: 'https://www.facebook.com/reel/1241534447992954/',
        facebook_url: 'https://www.facebook.com/share/r/1BxMME3h7p/'
      },
      {
        title: 'El acompañamiento familiar es clave',
        description: 'El amor contiene, los límites ordenan y la comunicación conecta. Tres pilares para acompañar, sostener y ayudar en cualquier proceso.',
        thumbnail_url: '/fotos/videos/video-3.jpg',
        youtube_url: 'https://www.facebook.com/reel/1474005807856438/',
        facebook_url: 'https://www.facebook.com/share/r/1EDv3GtChY/'
      }
    ]
  };

  // ------------------------------------------------------------------
  // WHATSAPP: números separados por función (NO mezclar).
  // - professional_whatsapp: consultas, turnos y contacto de Juan Manuel.
  // - developer_whatsapp: firma de diseño y desarrollo web (Braian).
  // ------------------------------------------------------------------
  const professional_whatsapp = '5492474443614';
  const developer_whatsapp = '5492477680988';

  // ------------------------------------------------------------------
  // ELEMENTOS DEL DOM
  // ------------------------------------------------------------------
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const main = $('#main-content');
  const sections = $$('.section');
  const navItems = $$('.nav-item');
  const sidebar = $('#sidebar');
  const backdrop = $('#sidebar-backdrop');
  const menuToggle = $('#menu-toggle');
  const lightbox = $('#lightbox');
  const videoModal = $('#video-modal');
  const videoIframe = $('#video-iframe');
  const toastEl = $('#toast');
  let toastTimer = null;

  // ------------------------------------------------------------------
  // CLIENTE DE SUPABASE (si está disponible y configurado)
  // ------------------------------------------------------------------
  const cfg = window.SUPABASE_CONFIG || null;
  const supabase =
    cfg && cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        })
      : null;

  let remoteSettings = {};

  // ------------------------------------------------------------------
  // NAVEGACIÓN SPA (portada fija, sin scroll)
  // ------------------------------------------------------------------
  function goto(id) {
    const target = document.getElementById('section-' + id);
    if (!target) return;

    sections.forEach((s) => s.classList.remove('active'));
    target.classList.add('active');
    target.scrollTop = 0;

    navItems.forEach((b) => b.classList.toggle('active', b.dataset.goto === id));
    closeMenu();

    if (id !== 'cover') {
      try { history.replaceState(null, '', '#' + id); } catch (e) { /* noop */ }
    } else {
      try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* noop */ }
    }

    if (main) main.focus({ preventScroll: true });
    document.title = buildTitle(id);
  }

  function buildTitle(id) {
    const base = (remoteSettings.hero && remoteSettings.hero.name) || DEFAULTS.hero.name;
    const titles = {
      cover: base + ' — Consumos Problemáticos y Adicciones',
      about: 'Sobre mí — ' + base,
      specialties: 'Especialidades — ' + base,
      events: 'Charlas y Conferencias — ' + base,
      testimonials: 'Testimonios — ' + base,
      videos: 'Videos — ' + base,
      contact: 'Contacto — ' + base
    };
    return titles[id] || titles.cover;
  }

  function openSectionFromHash() {
    const id = window.location.hash.replace('#', '');
    if (id && document.getElementById('section-' + id)) {
      goto(id);
    } else {
      goto('cover');
    }
  }

  // ------------------------------------------------------------------
  // MENÚ MÓVIL
  // ------------------------------------------------------------------
  function openMenu() {
    sidebar.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('show'));
    menuToggle.setAttribute('aria-label', 'Cerrar menú');
  }
  function closeMenu() {
    sidebar.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
    backdrop.classList.remove('show');
    setTimeout(() => { backdrop.hidden = true; }, 320);
  }

  menuToggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeMenu() : openMenu();
  });
  backdrop.addEventListener('click', closeMenu);

  // ------------------------------------------------------------------
  // AVISOS (toast)
  // ------------------------------------------------------------------
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastEl.hidden = true; }, 320);
    }, 3800);
  }

  // ------------------------------------------------------------------
  // WHATSAPP
  // ------------------------------------------------------------------
  function waMessage() {
    const c = remoteSettings.contact || DEFAULTS.contact;
    const text = c.schedule_message || DEFAULTS.contact.schedule_message;
    return 'https://wa.me/' + (c.whatsapp || professional_whatsapp) + '?text=' + encodeURIComponent(text);
  }
  function refreshContactLinks() {
    const c = remoteSettings.contact || DEFAULTS.contact;
    $$('[data-whatsapp-link]').forEach((a) => a.setAttribute('href', waMessage()));
    $$('[data-mail-link]').forEach((a) => {
      a.setAttribute('href', c.email ? 'mailto:' + c.email : '#');
    });
  }

  // ------------------------------------------------------------------
  // FOTO PRINCIPAL DE LA PORTADA
  // Detecta automáticamente la primera imagen de la carpeta /fotos/perfil
  // y la usa como fotografía principal de la portada.
  // ------------------------------------------------------------------
  async function applyProfilePhoto() {
    const imgs = ['cover-portrait', 'about-portrait']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!imgs.length) return;
    try {
      const res = await fetch('/api/perfil');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.url) imgs.forEach((img) => (img.src = data.url));
    } catch (err) {
      console.warn('[sitio] No se pudo detectar la foto de perfil:', err.message);
    }
  }

  // ------------------------------------------------------------------
  // APLICAR TEXTO DE CAMPOS (data-field)
  // ------------------------------------------------------------------
  function applyFields(source, rootKey) {
    $$('[data-field]').forEach((el) => {
      const parts = el.dataset.field.split('.');
      if (parts[0] !== rootKey) return;
      const value = parts.slice(1).reduce((o, k) => (o ? o[k] : undefined), source);
      if (value === undefined) return;
      if (el.tagName === 'IMG') {
        el.src = value;
        el.alt = 'Fotografía del profesional';
      } else if (el.dataset.attr) {
        el.setAttribute(el.dataset.attr, value);
      } else {
        el.textContent = value;
      }
    });
  }

  // ------------------------------------------------------------------
  // RENDER: ESPECIALIDADES
  // ------------------------------------------------------------------
  const ICONS = {
    path: '<path d="M12 3v10M8 21l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    leaf: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14Zm0 0c2-5 5-8 8-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    steps: '<path d="M4 20h16M6 16h8v4M10 12h4v4M14 8h4v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    hands: '<path d="M8 13V5a2 2 0 0 1 4 0v6m0-6V4a2 2 0 0 1 4 0v6m0-5a2 2 0 0 1 4 0v7c0 4-3 8-8 8s-8-4-8-8v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  function iconSvg(name) {
    const inner = ICONS[name] || ICONS.leaf;
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' + inner + '</svg>';
  }

  function refreshSpecialtyReadMore(card) {
    const desc = card.querySelector('.card-desc');
    const more = card.querySelector('.card-more');
    if (!desc || !more) return;
    more.hidden = !(desc.scrollHeight > desc.clientHeight + 1);
  }

  function renderSpecialties(list) {
    const host = $('#specialties-list');
    host.innerHTML = '';
    list.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML =
        '<div class="card-icon">' + iconSvg(item.icon) + '</div>' +
        '<h3 class="card-title">' + escapeHtml(item.title) + '</h3>' +
        '<p class="card-desc">' + escapeHtml(item.description) + '</p>' +
        '<button class="card-more" type="button" aria-expanded="false" hidden>Leer más</button>';
      host.appendChild(card);
      refreshSpecialtyReadMore(card);
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.card-more')) return;
        const expanded = card.classList.toggle('expanded');
        const more = card.querySelector('.card-more');
        more.textContent = expanded ? 'Leer menos' : 'Leer más';
        more.setAttribute('aria-expanded', String(expanded));
      });
    });
  }

  // Re-evalúa "Leer más" cuando terminan de cargar las tipografías,
  // para que el corte se calcule con la tipografía definitiva.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      $$('#specialties-list .card').forEach(refreshSpecialtyReadMore);
    });
  }

  // ------------------------------------------------------------------
  // RENDER: CHARLAS Y CONFERENCIAS (galería + lightbox)
  // ------------------------------------------------------------------
  const lightboxState = { items: [], index: 0 };

  function openLightbox(items, index) {
    lightboxState.items = items;
    lightboxState.index = index;
    renderLightbox();
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('open'));
    lightbox.setAttribute('aria-hidden', 'false');
    $('.lightbox-close', lightbox).focus();
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    setTimeout(() => { lightbox.hidden = true; }, 300);
    document.body.style.overflow = '';
  }
  function renderLightbox() {
    const { items, index } = lightboxState;
    if (!items.length) return;
    const img = $('.lightbox-img', lightbox);
    img.classList.add('is-switching');
    const reveal = () => img.classList.remove('is-switching');
    img.addEventListener('load', reveal, { once: true });
    img.addEventListener('error', reveal, { once: true });
    setTimeout(reveal, 700);
    img.src = items[index].image_url;
    img.alt = items[index].alt || '';
    $('.lightbox-caption', lightbox).textContent = items[index].alt || '';
    $('.lightbox-count', lightbox).textContent = (index + 1) + ' / ' + items.length;
    const prev = $('.lightbox-prev', lightbox);
    const next = $('.lightbox-next', lightbox);
    prev.style.visibility = items.length > 1 ? 'visible' : 'hidden';
    next.style.visibility = items.length > 1 ? 'visible' : 'hidden';
  }
  function stepLightbox(dir) {
    const total = lightboxState.items.length;
    lightboxState.index = (lightboxState.index + dir + total) % total;
    renderLightbox();
  }

  $('.lightbox-close', lightbox).addEventListener('click', closeLightbox);
  $('.lightbox-prev', lightbox).addEventListener('click', () => stepLightbox(-1));
  $('.lightbox-next', lightbox).addEventListener('click', () => stepLightbox(1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  async function loadCharlas() {
    const host = $('#events-list');
    try {
      const res = await fetch('/api/charlas');
      if (!res.ok) throw new Error('no-charlas-photos');
      const data = await res.json();
      const photos = data.photos || [];
      if (!photos.length) throw new Error('no-charlas-photos');
      host.innerHTML = '';
      const items = photos.map((p, i) => ({
        image_url: p.url,
        alt: 'Fotografía ' + (i + 1) + ' de charla y conferencia'
      }));
      const frag = document.createDocumentFragment();
      items.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'charla-card';
        btn.setAttribute('aria-label', 'Ampliar ' + item.alt);
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);
        btn.addEventListener('click', () => openLightbox(items, i));
        frag.appendChild(btn);
      });
      host.appendChild(frag);
    } catch (err) {
      console.warn('[sitio] No se pudo cargar la galería de charlas:', err.message);
      host.innerHTML = '<p class="loading-hint">La galería se actualizará próximamente.</p>';
    }
  }

  // ------------------------------------------------------------------
  // RENDER: TESTIMONIOS (galería de fotos reales + lightbox)
  // ------------------------------------------------------------------
  async function loadTestimonios() {
    const host = $('#testimonials-list');
    try {
      const res = await fetch('/api/testimonios');
      if (!res.ok) throw new Error('no-testimonios-photos');
      const data = await res.json();
      const photos = data.photos || [];
      if (!photos.length) throw new Error('no-testimonios-photos');
      host.innerHTML = '';
      const items = photos.map((p, i) => ({
        image_url: p.url,
        alt: 'Testimonio ' + (i + 1)
      }));
      const frag = document.createDocumentFragment();
      items.forEach((item, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'testimonio-card';
        btn.setAttribute('aria-label', 'Ampliar ' + item.alt);
        const img = document.createElement('img');
        img.src = item.image_url;
        img.alt = item.alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);
        btn.addEventListener('click', () => openLightbox(items, i));
        frag.appendChild(btn);
      });
      host.appendChild(frag);
    } catch (err) {
      console.warn('[sitio] No se pudo cargar la galería de testimonios:', err.message);
      host.innerHTML = '<p class="loading-hint">Próximamente compartiremos más experiencias.</p>';
    }
  }

  // ------------------------------------------------------------------
  // RENDER: VIDEOS
  // ------------------------------------------------------------------
  function getYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  function openVideo(youtubeUrl) {
    const id = getYouTubeId(youtubeUrl);
    let src = null;
    if (id) {
      src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    } else if (youtubeUrl && /facebook\.com/i.test(youtubeUrl)) {
      src = 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(youtubeUrl) + '&show_text=false';
    }
    if (!src) {
      toast('Este video estará disponible próximamente.');
      return;
    }
    videoIframe.src = src;
    videoModal.hidden = false;
    requestAnimationFrame(() => videoModal.classList.add('open'));
    $('.lightbox-close', videoModal).focus();
    document.body.style.overflow = 'hidden';
  }
  function closeVideo() {
    videoModal.classList.remove('open');
    setTimeout(() => {
      videoModal.hidden = true;
      videoIframe.src = '';
    }, 300);
    document.body.style.overflow = '';
  }
  $('.lightbox-close', videoModal).addEventListener('click', closeVideo);
  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) closeVideo();
  });

  function renderVideos(list) {
    const host = $('#videos-list');
    host.innerHTML = '';
    if (!list.length) {
      host.innerHTML = '<p class="loading-hint">Próximamente nuevos videos.</p>';
      return;
    }
    list.forEach((v) => {
      const card = document.createElement('article');
      card.className = 'video-card';
      const fbUrl = v.facebook_url || v.youtube_url || '';
      card.innerHTML =
        '<button class="video-thumb" type="button" aria-label="Reproducir video: ' + escapeAttr(v.title) + '">' +
          '<img src="' + escapeAttr(v.thumbnail_url || '/assets/img/video-1.svg') + '" alt="Miniatura de ' + escapeAttr(v.title) + '" loading="lazy" />' +
          '<span class="video-play"><span class="video-play-icon"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span>' +
        '</button>' +
        '<div class="video-body">' +
          '<h3 class="video-title">' + escapeHtml(v.title) + '</h3>' +
          '<p class="video-desc">' + escapeHtml(v.description) + '</p>' +
          (fbUrl
            ? '<div class="video-actions"><a class="video-fb-btn" href="' + escapeAttr(fbUrl) + '" target="_blank" rel="noopener">' +
                '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 9H16l.5-3h-3V4.5c0-.9.3-1.5 1.7-1.5h1.4V.2C16.3.2 15.3 0 14.2 0 11.7 0 10 1.5 10 4.3V6H7v3h3v9h3.5V9z"/></svg>' +
                'Ver video en Facebook</a></div>'
            : '') +
        '</div>';
      $('.video-thumb', card).addEventListener('click', () => openVideo(v.youtube_url || v.facebook_url || ''));
      host.appendChild(card);
    });
  }

  // ------------------------------------------------------------------
  // UTILIDADES
  // ------------------------------------------------------------------
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // ------------------------------------------------------------------
  // CARGA DE CONTENIDO (Supabase con respaldo provisorio)
  // ------------------------------------------------------------------
  async function loadData() {
    applyFields(DEFAULTS.hero, 'hero');
    applyFields(DEFAULTS.about, 'about');
    applyFields(DEFAULTS.contact, 'contact');
    renderSpecialties(DEFAULTS.specialties);
    loadCharlas();
    loadTestimonios();
    renderVideos(DEFAULTS.videos);
    refreshContactLinks();

    if (!supabase) {
      console.warn('[sitio] Supabase no configurado. Se muestra contenido provisorio.');
      return;
    }

    try {
      const [settingsRes, specRes] = await Promise.all([
        supabase.from('settings').select('key,value'),
        supabase.from('specialties').select('*').eq('published', true).order('sort_order', { ascending: true })
      ]);

      if (settingsRes.error) throw settingsRes.error;
      const settings = {};
      settingsRes.data.forEach((row) => { settings[row.key] = row.value; });
      remoteSettings = settings;

      applyFields(settings.hero || DEFAULTS.hero, 'hero');
      applyFields(settings.about || DEFAULTS.about, 'about');
      applyFields(settings.contact || DEFAULTS.contact, 'contact');
      refreshContactLinks();

      if (!specRes.error && specRes.data && specRes.data.length) renderSpecialties(specRes.data);
    } catch (err) {
      console.warn('[sitio] No se pudo cargar el contenido desde Supabase:', err.message);
    }
  }

  // ------------------------------------------------------------------
  // PIE DE PÁGINA
  // Se agrega al final de cada sección (menos la portada).
  // ------------------------------------------------------------------
  function injectFooter() {
    const creditHref =
      'https://wa.me/' + developer_whatsapp + '?text=' +
      encodeURIComponent(
        'Hola Braian. Estuve viendo la página de Juan Manuel y me gustaría consultar por el desarrollo de una página web.'
      );
    $$('.section-inner').forEach((inner) => {
      if (inner.closest('.section-cover')) return;
      const footer = document.createElement('footer');
      footer.className = 'site-footer';
      footer.innerHTML =
        '<p>© 2026 Lic. Juan Manuel Álvarez Basabe.</p>' +
        '<p class="site-footer-credit"><a href="' + creditHref + '" target="_blank" rel="noopener">Diseño y desarrollo web · Braian Oertlinger</a></p>';
      inner.appendChild(footer);
    });
  }

  // ------------------------------------------------------------------
  // TECLADO Y EVENTOS GLOBALES
  // ------------------------------------------------------------------
  function trapFocus(e, container) {
    const focusables = Array.from(container.querySelectorAll('button, [href], iframe')).filter((el) => !el.hidden);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!lightbox.hidden) closeLightbox();
      else if (!videoModal.hidden) closeVideo();
      else closeMenu();
    }
    if (e.key === 'Tab') {
      if (!lightbox.hidden) trapFocus(e, lightbox);
      else if (!videoModal.hidden) trapFocus(e, videoModal);
    }
    if (e.key === 'ArrowLeft' && !lightbox.hidden) stepLightbox(-1);
    if (e.key === 'ArrowRight' && !lightbox.hidden) stepLightbox(1);
  });

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-goto]');
    if (trigger && trigger.dataset.goto) goto(trigger.dataset.goto);
  });
  window.addEventListener('hashchange', openSectionFromHash);

  // ------------------------------------------------------------------
  // INICIO
  // ------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    injectFooter();
    loadData().then(() => {
      openSectionFromHash();
    });
    refreshContactLinks();
    applyProfilePhoto();
  });
})();
