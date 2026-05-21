/* ── ELEMENT REFS ─────────────────────────────────────────────── */
const nav       = document.getElementById('nav');
const heroZone  = document.getElementById('heroZone');
const heroFill  = document.getElementById('heroProgressFill');
const heroVideo = document.getElementById('heroVideo');
const svcZone   = document.getElementById('svcZone');
const svcVideo  = document.getElementById('svcVideo');
const svcFill   = document.getElementById('svcProgressFill');


/* ── MOBILE DETECTION ─────────────────────────────────────────── */
const isMobile = window.matchMedia('(max-width: 768px)').matches;

/* ── FEATURE DETECT: CSS Scroll-Driven Animations ─────────────── */
const hasCSSScrollAnim = CSS.supports('animation-timeline', 'scroll()');

/* ── SCROLL STATE ─────────────────────────────────────────────── */
let latestScrollY  = window.scrollY;
let rafQueued      = false;
let inScrollZone   = false;   /* true while user is in a sticky video zone */

window.addEventListener('scroll', () => { latestScrollY = window.scrollY; }, { passive: true });


/* ── CONTENT REVEAL ───────────────────────────────────────────── */
function revealBlock(container) {
  if (!container || container.classList.contains('revealed')) return;
  container.classList.add('revealed');
  container.querySelectorAll('.r').forEach((el, i) => {
    setTimeout(() => el.classList.add('on'), i * 150);
  });
}

function hideBlock(container) {
  if (!container || !container.classList.contains('revealed')) return;
  container.classList.remove('revealed');
  container.querySelectorAll('.r').forEach(el => el.classList.remove('on'));
}


/* ── SCROLL VIDEO FACTORY ─────────────────────────────────────── */
function createScrollVideo({ zone, video, fill, onComplete, onHide }) {
  let top = 0, scrollable = 1, completed = false;

  function cacheLayout() {
    top        = zone.getBoundingClientRect().top + window.scrollY;
    scrollable = zone.offsetHeight - window.innerHeight;
  }

  function update(sy) {
    const progress = Math.min(1, Math.max(0, sy - top) / scrollable);

    if (video.readyState >= 1 && video.duration > 0) {
      const target = progress * video.duration;
      if (Math.abs(video.currentTime - target) > 0.016) {
        video.currentTime = target;
      }
    }

    if (!hasCSSScrollAnim && fill) {
      fill.style.width = (progress * 100).toFixed(1) + '%';
    }

    if (progress >= 0.97 && !completed) {
      completed = true;
      onComplete && onComplete();
    } else if (progress < 0.93 && completed) {
      completed = false;
      onHide && onHide();
    }

    return progress;
  }

  function warmUp() {
    /* Trigger download immediately — don't wait for intersection */
    video.preload = 'auto';
    video.load();

    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        /* Short play forces the browser to decode and buffer frames */
        video.play()
          .then(() => { video.pause(); video.currentTime = 0; })
          .catch(() => {});
        obs.disconnect();
      }
    }, { rootMargin: '600px' });
    obs.observe(zone);

    video.addEventListener('progress', () => {
      if (!rafQueued) { rafQueued = true; requestAnimationFrame(tick); }
    });

    video.addEventListener('loadedmetadata', () => {
      cacheLayout();
      if (!rafQueued) { rafQueued = true; requestAnimationFrame(tick); }
    });

    video.addEventListener('canplay', () => {
      if (!rafQueued) { rafQueued = true; requestAnimationFrame(tick); }
    });
  }

  cacheLayout();
  return { cacheLayout, update, warmUp, getTop: () => top };
}


/* ── INSTANCES ────────────────────────────────────────────────── */
const heroReveal = document.querySelector('.hero-reveal');
const svcReveal  = document.querySelector('.svc-reveal');

const heroSV = createScrollVideo({
  zone: heroZone, video: heroVideo, fill: heroFill,
  onComplete: () => revealBlock(heroReveal),
  onHide:     () => hideBlock(heroReveal)
});
const svcSV = createScrollVideo({
  zone: svcZone, video: svcVideo, fill: svcFill,
  onComplete: () => revealBlock(svcReveal),
  onHide:     () => hideBlock(svcReveal)
});

if (!isMobile) {
  heroSV.warmUp();
  svcSV.warmUp();
} else {
  revealBlock(heroReveal);
  revealBlock(svcReveal);
}


/* ── RESIZE ───────────────────────────────────────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    heroSV.cacheLayout();
    svcSV.cacheLayout();
  }, 200);
}, { passive: true });


/* ── NAV STATE ────────────────────────────────────────────────── */
let navIsGlass = false;


/* ── MAIN TICK ────────────────────────────────────────────────── */
function tick() {
  rafQueued = false;
  const sy = latestScrollY;

  const wantsGlass = sy > 60;
  if (wantsGlass !== navIsGlass) {
    navIsGlass = wantsGlass;
    nav.classList.toggle('glass', wantsGlass);
  }

  if (!isMobile) {
    heroSV.update(sy);
    svcSV.update(sy);

    const heroTop = heroSV.getTop();
    const svcTop  = svcSV.getTop();
    inScrollZone  = (sy >= heroTop && sy <= heroTop + heroZone.offsetHeight) ||
                    (sy >= svcTop  && sy <= svcTop  + svcZone.offsetHeight);
  }

  /* Keep RAF running while inside a scroll-video zone for sub-frame precision */
  if (inScrollZone) { rafQueued = true; requestAnimationFrame(tick); }
}

window.addEventListener('scroll', () => {
  if (!rafQueued) { rafQueued = true; requestAnimationFrame(tick); }
}, { passive: true });

tick();


/* ── SMART ANCHOR SCROLL ──────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const id     = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();

    const heroZoneEnd = heroSV.getTop() + heroZone.offsetHeight - window.innerHeight;
    const targetTop   = target.getBoundingClientRect().top + window.scrollY - 80;

    if (targetTop > heroZoneEnd + window.innerHeight && window.scrollY < heroZoneEnd) {
      window.scrollTo({ top: heroZoneEnd, behavior: 'instant' });
      requestAnimationFrame(() => requestAnimationFrame(() =>
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
      ));
    } else {
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }

    document.querySelector('.nav-links').style.display = '';
  });
});


/* ── SCROLL REVEALS ───────────────────────────────────────────── */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); });
}, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });
document.querySelectorAll('.r').forEach(el => {
  if (!el.closest('.hero-reveal, .svc-reveal')) io.observe(el);
});


/* ── MOBILE VIDEO AUTOPLAY ────────────────────────────────────── */
if (isMobile) {
  heroVideo.setAttribute('autoplay', '');
  heroVideo.setAttribute('loop', '');
  heroVideo.muted = true;
  heroVideo.play().catch(() => {});

  svcVideo.setAttribute('autoplay', '');
  svcVideo.setAttribute('loop', '');
  svcVideo.muted = true;
  svcVideo.play().catch(() => {});
}


/* ── MOBILE BURGER ────────────────────────────────────────────── */
document.getElementById('burger').addEventListener('click', () => {
  const links = document.querySelector('.nav-links');
  const open  = links.style.display === 'flex';
  Object.assign(links.style, open ? { display: '' } : {
    display: 'flex', flexDirection: 'column',
    position: 'fixed', top: '72px', left: '0', right: '0',
    padding: '24px 32px 32px', gap: '24px',
    background: 'rgba(25,25,25,.97)',
    borderBottom: '1px solid rgba(255,255,255,.07)',
    zIndex: '199'
  });
});
