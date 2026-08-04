/* ==========================================================
   i18n.js — bilingual (EN / ES) layer
   · Auto-detects the visitor's language from the browser locale
     (navigator.languages) and, as a hint, the timezone. Spanish-speaking
     visitors default to Spanish; everyone else gets English.
   · EN is the source text already in the page / scenes.js.
   · ES translations live in the I18N.es dictionary below.
   · A manual choice (clicking EN / ES) is remembered in localStorage
     and always wins over auto-detection.

   NOTE ON "country" detection: true geo-IP country lookup requires a
   server or a third-party API. In a static site the reliable signal is
   the browser's own language setting, which is what users actually read
   in. We combine navigator.languages with the timezone as a fallback so
   a Spanish-region machine still defaults to Spanish even if the UI
   language list is odd. See detectLang().
   ========================================================== */

/* ---------------- Spanish dictionary ---------------- */
const I18N = {
  es: {
    ui: {
      menu:  'Menú',
      rights:'Todos los derechos reservados',
      scrollCue:'Desplázate para descubrir',
      contactUs:'Contacto',
      contactTitle:'Contacto',        // used to rebuild the hero <h1>
      contactIntro:'Kongamato tiene su sede en el distrito empresarial de aviación de Wichita, Kansas, la Capital Aérea del Mundo. Contáctanos por teléfono o correo, o encuéntranos en el mapa de abajo.',
      contactReach:'Contáctanos',
      contactEmail:'Correo',
      contactPhone:'Teléfono',
      contactAddress:'Dirección',
      contactFindUs:'Encuéntranos',
      contactLargerMap:'Ver mapa más grande'
    },
    // per-scene title + body (keyed by scene id in scenes.js)
    scenes: {
      what_we_do: {
        title:'Qué Hacemos',
        body:'Kongamato avanza hacia una capacidad integral: una aeronave diseñada, construida y pilotada bajo un mismo techo, con las herramientas y la cadena de formación que hacen que esto sea repetible. Las etapas siguientes describen el alcance completo hacia el que trabajamos.<br><b>Diseño: </b>Dimensionamiento conceptual, aerodinámica, estructuras, sistemas y aviónica, apoyados en nuestras propias herramientas de simulación. Aquí es donde ya opera Design Studio: diagramas de restricción, polares de resistencia, envolventes de carga y CFD, funcionando hoy.<br><b>Construcción: </b>Utillaje, fabricación de piezas de material compuesto, ensamblaje e integración de sistemas. Traer la fabricación del fuselaje a casa es lo que cierra el ciclo entre un cambio de diseño y un artículo que vuela.<br><b>Educación e Investigación: </b>Investigación y desarrollo, ensayos en vuelo y en tierra, y mentoría STEM. Tratamos la formación como trabajo esencial, no como divulgación.'
      },
      design_studio: {
        title:'Estudio de Diseño',
        body:'Funciona sin conexión desde un único archivo HTML. Sin bibliotecas, sin proceso de compilación, sin red: ábrelo y funciona. Aircraft Design Studio es un banco de trabajo de diseño conceptual en el navegador para aeronaves y drones, con nueve pestañas de análisis enlazadas que cubren los cálculos de dimensionamiento que los ingenieros aeroespaciales usan de verdad: diagramas de restricción, polares de resistencia, envolventes V-n, cálculo de peso y centro de gravedad, y derivadas de estabilidad. Todas las pestañas comparten un mismo estado de diseño, de modo que cambiar el peso bruto se propaga a la geometría, las prestaciones y la envolvente estructural a la vez. La novena pestaña es un túnel de viento CFD Lattice-Boltzmann en vivo: sube cualquier STL u OBJ y voxeliza la malla sobre una retícula D3Q19, resuelve flujo viscoso transitorio en la GPU y devuelve sustentación y resistencia por intercambio de momento junto con una solución completa de atmósfera ISA.'
      },
      open_source: {
        title:'Código Abierto',
        body:'Todo lo que construye Kongamato se publica bajo Apache 2.0: las herramientas, la aviónica, los datos del fuselaje. A continuación se muestra el estado actual del código, con qué lo hemos validado y dónde falla. Publicamos los límites junto a las capacidades porque una aviónica de la que dependen vidas debe poder ser auditada por cualquiera que quiera revisar el trabajo. Esta página es un documento vivo. Refleja lo que existe hoy, no lo que pretendemos construir.'
      },
      training: {
        title:'Formación y STEM',
        body:'La aviación tiene un problema de cantera: las herramientas que enseñan diseño real de aeronaves son caras, con licencia y limitadas a instituciones que pueden pagarlas. La nuestra funciona en un navegador, sin conexión y gratis.<b>Para estudiantes.</b> Design Studio pone los mismos cálculos de dimensionamiento usados en la práctica profesional; diagramas de restricción, polares de resistencia, envolventes V-n, derivadas de estabilidad, CFD; al alcance de cualquier estudiante de secundaria o universidad con un portátil. Sin licencia, sin instalación, sin laboratorio. Junto con la mentoría, ofrece a los estudiantes un camino desde el primer boceto hasta un diseño que puedan defender. <b>Para profesionales.</b> Formación estructurada en todo el ciclo diseño-construcción, desde el dimensionamiento conceptual hasta la fabricación en compuestos y la integración de sistemas, para ingenieros que entran en la aviación experimental y no tripulada. Todo lo que construimos se publica bajo Apache 2.0. Una aviónica de la que dependen vidas debe poder auditarla cualquiera que quiera revisar el trabajo; y las herramientas que enseñan deben estar disponibles para cualquiera que quiera aprender.'
      },
      avionics: {
        title:'Aviónica',
        body:'Kongamato está construyendo una plataforma de aviónica de código abierto y pila completa para la aviación experimental: una cabina de cristal, un HUD de gafas inteligentes de realidad aumentada y un piloto automático comandado por voz o texto en lenguaje natural. El conjunto de capacidades previsto incluye despegue y aterrizaje automáticos, desvío al aeropuerto más cercano, trabajo de circuito con conciencia del viento, y conciencia de tráfico y obstáculos; supervisado desde el panel o el HUD, y anulable por el Piloto al Mando en todo momento.'
      }
    },
    // full Open Source overlay (static HTML) — swapped wholesale
    overlay: `
  <div class="os-grid"></div>

  <header class="os-hero">
    <h1>Código<br>Abierto</h1>
    <div class="os-intro">
      <p>Todo lo que construye Kongamato se publica bajo Apache 2.0: las herramientas, la aviónica, los datos del fuselaje. A continuación se muestra el estado actual del código, con qué lo hemos validado y dónde falla. Publicamos los límites junto a las capacidades porque una aviónica de la que dependen vidas debe poder ser auditada por cualquiera que quiera revisar el trabajo.</p>
      <p>Esta página es un documento vivo. Refleja lo que existe hoy, no lo que pretendemos construir.</p>
    </div>
  </header>

  <section class="os-sec">
    <div class="os-kicker">Proyecto — Publicado</div>
    <h2>Aircraft Design Studio</h2>
    <p class="os-status">Estado: publicado y en funcionamiento.</p>
    <p>Un banco de trabajo de diseño conceptual en el navegador para aeronaves y drones. Nueve pestañas de análisis enlazadas que cubren los cálculos de dimensionamiento que los ingenieros aeroespaciales usan de verdad (diagramas de restricción, polares de resistencia, envolventes V-n, cálculo de peso y centro de gravedad, derivadas de estabilidad) además de un túnel de viento CFD Lattice-Boltzmann en vivo. Todas las pestañas comparten un mismo estado de diseño, de modo que cambiar el peso bruto se propaga a la geometría, las prestaciones y la envolvente estructural a la vez.</p>
    <p>Funciona sin conexión desde un único archivo HTML. Sin bibliotecas, sin proceso de compilación, sin red.</p>
    <p class="os-links">→ <a href="#">Repositorio</a> · <a href="#">Abrir la herramienta</a></p>

    <h3>Qué hace realmente el solucionador CFD</h3>
    <p>Una solución transitoria de Navier–Stokes, no una animación. Lattice Boltzmann D3Q19 sobre una retícula 128×64×64 con colisión BGK, ejecutándose como shaders de cómputo WebGPU donde estén disponibles y recurriendo automáticamente a un solucionador WebGL2 equivalente. Sube cualquier STL u OBJ y la malla se normaliza, se rota al ángulo de ataque solicitado y se voxeliza sobre la retícula. Las fuerzas provienen del intercambio de momento de Ladd sumado sobre cada enlace de frontera, la misma magnitud física que mide una balanza de túnel de viento.</p>

    <h3>Validación</h3>
    <table class="os-table">
      <thead><tr><th>Prueba</th><th>Solucionador</th><th>Publicado / teoría</th></tr></thead>
      <tbody>
        <tr><td>Cilindro C<sub>D</sub> (Re 200–8000)</td><td>0.78 – 1.15</td><td>1.0 – 1.3</td></tr>
        <tr><td>Desprendimiento de vórtices</td><td>calle de von Kármán, St ≈ 0.2</td><td>St ≈ 0.20</td></tr>
        <tr><td>C<sub>D</sub> aerodinámico vs romo</td><td>fuselaje ≪ cilindro</td><td>mismo orden</td></tr>
        <tr><td>Estabilidad numérica</td><td>0 celdas no finitas en todas las ejecuciones</td><td>—</td></tr>
      </tbody>
    </table>
    <p class="os-note">Heredado del solucionador 2D v1. Vuelve a ejecutarlas en tu propio hardware. Preferimos que lo verifiques a que confíes en nosotros.</p>

    <h3>Límites conocidos</h3>
    <div class="os-cards">
      <div class="os-card"><span class="os-num">1</span><p>Retícula cartesiana uniforme, aproximadamente 56 celdas a lo ancho del modelo. El flujo cerca de bordes de salida finos aparece escalonado aunque la superficie renderizada sea suave. La vista de superficie corrige la imagen, no la retícula.</p></div>
      <div class="os-card"><span class="os-num">2</span><p>Número de Reynolds efectivo limitado en torno a 2400 por la estabilidad de la retícula. Escala de MAV y drones pequeños.</p></div>
      <div class="os-card"><span class="os-num">3</span><p>Bajo Mach, incompresible. Sin ondas de choque; la interfaz avisa por encima de M ≥ 1.</p></div>
      <div class="os-card"><span class="os-num">4</span><p>Coeficientes normalizados por la longitud del modelo al cuadrado, ya que el área en planta es desconocida para una carga arbitraria. Datos comparativos, no de certificación.</p></div>
      <div class="os-card"><span class="os-num">5</span><p>La voxelización asume una malla razonablemente estanca. Las mallas abiertas pueden filtrar celdas interiores.</p></div>
    </div>

    <div class="os-kicker">Hoja de ruta</div>
    <p>Refinamiento de retícula multirresolución cerca de las paredes · funciones de pared para Re más alto · separación de resistencia de presión/viscosa · barrido automático de α que produce curvas de sustentación y polares de resistencia completas · exportación de resultados de vuelta a la pestaña de Aerodinámica.</p>
  </section>

  <section class="os-sec">
    <div class="os-kicker">Proyecto — Publicado</div>
    <h2>Mapamundi Hobo-Dyer Sur Arriba</h2>
    <p class="os-status">Estado: publicado y en funcionamiento.</p>
    <p>Un mapamundi interactivo a pantalla completa en la proyección equiárea Hobo-Dyer, girado con el sur arriba. Equiárea significa que los tamaños de los países son reales, sin la inflación de Mercator en las latitudes altas, y la orientación sur-arriba desmonta una convención visual que casi nadie examina. Los países se colorean según su lengua oficial dominante; al acercar aparecen ríos, cordilleras, capitales, ciudades y la red vial mundial por capas.</p>
    <p>En zoom profundo se convierte en una carta aeronáutica. Nueva York y Washington DC se renderizan como cartas seccionales VFR propias, con espacio aéreo FAA Clase B/C/D y de frontera incluyendo suelos y techos, aeropuertos dibujados a la orientación real de pista, y radioayudas VOR/NDB con frecuencias, todo generado a partir de datos GIS de espacio aéreo de la FAA y OurAirports mediante un script de Python en el repositorio, sin necesidad de clave API. Tokio, Israel, Ciudad del Cabo, Zúrich y Jamaica usan teselas de openAIP con una clave gratuita. El tráfico aéreo y marítimo en vivo se superpone encima.</p>
    <p>Cada tesela Web-Mercator se reproyecta tesela a tesela a Hobo-Dyer mediante transformación afín desde sus esquinas proyectadas, de modo que las fronteras del espacio aéreo y los aeropuertos caen en coordenadas reales. El texto de la carta se dibuja pre-rotado 180° para que se lea al derecho una vez que el mapa sur-arriba invierte la tesela.</p>
    <p class="os-note">No apto para navegación. Son derivados reproyectados, sur-arriba y renderizados por nosotros de datos publicados. Usa cartas oficiales vigentes para la planificación de vuelo.</p>
    <p class="os-links">→ <a href="#">Repositorio</a></p>

    <div class="os-kicker">Hoja de ruta</div>
    <p>Más metrópolis VFR renderizadas por nosotros, para eliminar la dependencia de la clave openAIP · capas de vectores de viento y corrientes · capa de curvas de nivel y relieve sombreado · densidad de población basada en ráster GHSL/WorldPop · backend de teselas para carreteras globales rápidas.</p>
  </section>

  <section class="os-sec">
    <div class="os-kicker">En desarrollo</div>
    <h2>Aún sin publicar</h2>
    <p>Estos repositorios se abren a medida que alcanzan un estado sobre el que merece la pena construir.</p>
    <p><b>Pila de aviónica.</b> Cabina de cristal, HUD de gafas inteligentes de RA y piloto automático comandado por voz o texto en lenguaje natural. Las capacidades previstas incluyen despegue y aterrizaje automáticos, desvío al aeropuerto más cercano, trabajo de circuito con conciencia del viento, y conciencia de tráfico y obstáculos. Supervisado desde el panel o el HUD. Anulable por el Piloto al Mando en todo momento.</p>
    <p><b>Fuselaje.</b> Datos y utillaje de estructuras de material compuesto, que se abren a medida que maduran los diseños.</p>
  </section>

  <section class="os-sec">
    <div class="os-kicker">Cómo contribuir</div>
    <h2>Lo más útil ahora mismo</h2>
    <div class="os-cards">
      <div class="os-card"><span class="os-num">1</span><p><b>Ejecuciones de validación en otro hardware.</b> Especialmente la ruta de reserva WebGL2. Necesitamos datos de máquinas sin WebGPU.</p></div>
      <div class="os-card"><span class="os-num">2</span><p><b>Casos de prueba con datos de referencia publicados.</b> Cualquier geometría con C<sub>L</sub>/C<sub>D</sub> publicados y fiables contra los que podamos contrastarnos.</p></div>
      <div class="os-card"><span class="os-num">3</span><p><b>Informes de errores,</b> en particular inestabilidad numérica o fallos de voxelización en mallas reales.</p></div>
      <div class="os-card"><span class="os-num">4</span><p><b>Más metrópolis VFR</b> para el mapa, renderizadas por ti a partir de datos públicos de espacio aéreo.</p></div>
      <div class="os-card"><span class="os-num">5</span><p><b>Trabajo de D3 y cartografía.</b> Superposiciones de vectores de viento, relieve del terreno, colocación de etiquetas.</p></div>
    </div>
    <p>Issues y pull requests en los repositorios anteriores. Si eres un apasionado de la aviación que programa, el mapa es lo más fácilmente contribuible que tenemos.</p>
  </section>

  <section class="os-sec os-why">
    <div class="os-kicker">Por qué abierto</div>
    <p class="os-quote">"Una aviónica de la que dependen vidas debe poder ser auditada por cualquiera que quiera revisar el trabajo, y las herramientas que enseñan deben estar disponibles para cualquiera que quiera aprender."</p>
  </section>`
  }
};

/* English fallbacks for UI strings (source text). */
const EN_UI = {
  menu:'Menu', rights:'All Rights Reserved', scrollCue:'Scroll to discover',
  contactUs:'Contact Us', contactTitle:'Contact', contactReach:'Reach us',
  contactEmail:'Email', contactPhone:'Phone', contactAddress:'Address',
  contactFindUs:'Find us', contactLargerMap:'View larger map'
};

/* ---------------- detection ---------------- */
function detectLang(){
  // 1. explicit choice wins
  const saved = localStorage.getItem('lang');
  if (saved === 'en' || saved === 'es') return saved;

  // 2. browser languages (es, es-ES, es-MX, ...)
  const langs = navigator.languages || [navigator.language || 'en'];
  if (langs.some(l => (l || '').toLowerCase().startsWith('es'))) return 'es';

  // 3. timezone fallback — Spanish-speaking regions
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const esTz = /^(Europe\/Madrid|Atlantic\/Canary|America\/(Mexico|Bogota|Lima|Santiago|Argentina|Caracas|Guatemala|Costa_Rica|Panama|El_Salvador|Tegucigalpa|Managua|Havana|Santo_Domingo|La_Paz|Asuncion|Montevideo|Guayaquil))/;
    if (esTz.test(tz)) return 'es';
  } catch (_) {}

  return 'en';
}

/* ---------------- captured English source ---------------- */
let EN_OVERLAY = null;              // filled on first apply
function captureEnglish(){
  if (EN_OVERLAY === null){
    const ov = document.getElementById('osscroll');
    EN_OVERLAY = ov ? ov.innerHTML : '';
  }
}

/* Scene text for the active language (used by app.js). Falls back to the
   English source in SCENES when a translation is missing. */
let LANG = 'en';
window.sceneText = function(def){
  if (LANG === 'es'){
    const s = I18N.es.scenes[def.id];
    if (s) return { title: s.title, body: s.body };
  }
  return { title: def.title, body: def.body };
};

/* ---------------- apply ---------------- */
function applyLanguage(lang){
  LANG = (lang === 'es') ? 'es' : 'en';
  localStorage.setItem('lang', LANG);
  document.documentElement.lang = LANG;
  captureEnglish();

  // active state on the EN / ES switch
  document.querySelectorAll('.lang a[data-lang]').forEach(a => {
    a.classList.toggle('active', a.dataset.lang === LANG);
  });

  // simple UI strings marked with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = (LANG === 'es' ? I18N.es.ui[key] : EN_UI[key]) ?? el.textContent;
  });

  // "scroll to discover" cue text
  const cue = document.getElementById('cue-link');
  if (cue) cue.textContent = (LANG === 'es' ? I18N.es.ui.scrollCue : EN_UI.scrollCue);


  // Open Source overlay (static HTML) — swap the whole block
  const ov = document.getElementById('osscroll');
  if (ov) ov.innerHTML = (LANG === 'es') ? I18N.es.overlay : EN_OVERLAY;

  // Contact menu label (page #6) for the current language
  window.i18nContactLabel = (LANG === 'es') ? 'Contacto' : 'Contact';

  // re-render the live scene copy + menu labels (hooks provided by app.js)
  if (typeof window.rerenderCopy === 'function') window.rerenderCopy();
  if (typeof window.rerenderMenu === 'function') window.rerenderMenu();
}
window.applyLanguage = applyLanguage;

/* ---------------- wire the EN / ES links ---------------- */
document.querySelectorAll('.lang a[data-lang]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    applyLanguage(a.dataset.lang);
  });
});

/* boot: auto-detect and apply */
applyLanguage(detectLang());
