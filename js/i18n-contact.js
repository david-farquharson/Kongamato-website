/* ==========================================================
   i18n-contact.js — standalone language + UI wiring for contact.html
   (contact.html has no WebGL scene, so it does not load the main i18n.js /
   app.js. This is a self-contained, trimmed version.)
   ========================================================== */

const CONTACT_ES = {
  ui: {
    menu:'Menú', rights:'Todos los derechos reservados', home:'Inicio',
    contactReach:'Contáctanos', contactEmail:'Correo', contactPhone:'Teléfono',
    contactAddress:'Dirección', contactFindUs:'Encuéntranos',
    contactLargerMap:'Ver mapa más grande'
  },
  intro:'Kongamato tiene su sede en el distrito empresarial de aviación de Wichita, Kansas, la Capital Aérea del Mundo. Contáctanos por teléfono o correo, o encuéntranos en el mapa de abajo.',
  title:'Contacto'
};   // ES: single line
const CONTACT_EN = {
  ui: {
    menu:'Menu', rights:'All Rights Reserved', home:'Home',
    contactReach:'Reach us', contactEmail:'Email', contactPhone:'Phone',
    contactAddress:'Address', contactFindUs:'Find us',
    contactLargerMap:'View larger map'
  },
  intro:'Kongamato is based in the aviation business district of Wichita, Kansas — the Air Capital of the World. Reach us by phone or email, or find us on the map below.',
  title:'Contact Us'
};

function detectLang(){
  const saved = localStorage.getItem('lang');
  if (saved === 'en' || saved === 'es') return saved;
  const langs = navigator.languages || [navigator.language || 'en'];
  if (langs.some(l => (l || '').toLowerCase().startsWith('es'))) return 'es';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/^(Europe\/Madrid|Atlantic\/Canary|America\/(Mexico|Bogota|Lima|Santiago|Argentina|Caracas|Guatemala|Costa_Rica|Panama|El_Salvador|Tegucigalpa|Managua|Havana|Santo_Domingo|La_Paz|Asuncion|Montevideo|Guayaquil))/.test(tz)) return 'es';
  } catch (_) {}
  return 'en';
}

function applyLanguage(lang){
  const L = (lang === 'es') ? 'es' : 'en';
  const D = (L === 'es') ? CONTACT_ES : CONTACT_EN;
  localStorage.setItem('lang', L);
  document.documentElement.lang = L;

  document.querySelectorAll('.lang a[data-lang]').forEach(a =>
    a.classList.toggle('active', a.dataset.lang === L));

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (D.ui[key] != null) el.textContent = D.ui[key];
  });

  const intro = document.querySelector('.os-intro p');
  if (intro) intro.textContent = D.intro;
  const title = document.getElementById('contact-title');
  if (title) title.innerHTML = D.title;
}

document.querySelectorAll('.lang a[data-lang]').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); applyLanguage(a.dataset.lang); });
});

/* burger / menu toggle */
const burger = document.querySelector('.burger');
const label  = document.querySelector('.top-right .label');
if (burger) burger.onclick = () => document.body.classList.toggle('menu-open');
if (label)  label.onclick  = () => document.body.classList.toggle('menu-open');
addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('menu-open'); });

applyLanguage(detectLang());
