const EXTENSION_SIGNATURES = {
  ADBLOCKER: [
    'ads', 'ad-container', 'banner-ads', 'sponsor', 'carbon-ads',
    'ublock', 'adguard', 'adblock', 'pub_300x250', 'adv-container'
  ],

  TRANSLATOR: [
    'goog-gt-', 'translate', 'skiptranslate', 'translator',
    'deepl', 'tw-container', 'transover'
  ],

  GRAMMAR: [
    'grammarly', 'gr-', 'quillbot', 'languagetool', 'spellcheck'
  ],

  COUPONS: [
    'honey', 'coupon', 'shoptimate', 'joinhoney', 'capitalone', 
    'rakuten', 'fakespot', 'piggy'
  ],

  PASSWORD_MANAGERS: [
    'bitwarden', '1password', 'lastpass', 'lp-container', 
    'dashlane', 'keeper', 'passbolt'
  ],

  ACCESSIBILITY_DARK: [
    'darkreader', 'reader-mode', 'accessibility', 'high-contrast',
    'screen-reader', 'dyslexia'
  ],

  WEB3_WALLETS: [
    'metamask', 'phantom', 'coinbase-wallet', 'brave-wallet'
  ],

  DEV_TOOLS_OVERLAYS: [
    'loom-desktop', 'fireshot', 'colorzilla', 'hover-zoom', 'enlarger'
  ]
};

type DetectionResult = {
  source: string;
  matchedKeyword: string | null;
  matchedValue: string;
};

const identifySource = (
  element: HTMLElement
): DetectionResult => {

  // ID + clases
  const basicInfo = (
    element.id +
    ' ' +
    element.className
  ).toLowerCase();

  const attrInfo = Array.from(element.attributes)
    .map(attr => `${attr.name}="${attr.value}"`)
    .join(' ')
    .toLowerCase();

  const htmlSnippet = element.outerHTML
    .slice(0, 500)
    .toLowerCase();

  const fullIdentity = `
    ${basicInfo}
    ${attrInfo}
    ${htmlSnippet}
  `;

  for (const [name, keywords] of Object.entries(EXTENSION_SIGNATURES)) {

    const matchedKeyword = keywords.find(keyword =>
      fullIdentity.includes(keyword.toLowerCase())
    );

    if (matchedKeyword) {
      return {
        source: name,
        matchedKeyword,
        matchedValue: fullIdentity
      };
    }
  }

  return {
    source: 'UNKNOWN_EXTENSION',
    matchedKeyword: null,
    matchedValue: fullIdentity
  };
};


const auditState = {
  extensions: new Map<
    string,
    {
      count: number;
      examples: Set<string>;
      keywords: Set<string>;
    }
  >(),

  totalInjections: 0
};


const shouldIgnoreElement = (
  element: HTMLElement
): boolean => {

  return (
    element.tagName === 'SCRIPT' ||
    element.tagName === 'STYLE' ||
    element.tagName === 'META' ||
    element.tagName === 'LINK' ||
    element.tagName === 'HEAD' ||

    element.hasAttribute('data-v-app') ||
    !!element.closest('[data-v-app]') ||

    element.id === 'audit-dashboard' ||
    !!element.closest('#audit-dashboard') ||

    element.classList.contains('controls') ||
    !!element.closest('.controls')
  );
};

const registerInjection = (
  element: HTMLElement
) => {

  // Ignorar elementos técnicos
  if (shouldIgnoreElement(element)) {
    return;
  }

  const detection = identifySource(element);

  const source = detection.source;
  const matchedKeyword = detection.matchedKeyword;

  // Ignorar UNKNOWN para evitar ruido
  if (source === 'UNKNOWN_EXTENSION') {
    return;
  }

  const current =
    auditState.extensions.get(source) || {
      count: 0,
      examples: new Set<string>(),
      keywords: new Set<string>()
    };

  current.count++;

  // Guardar keyword encontrada
  if (matchedKeyword) {
    current.keywords.add(matchedKeyword);
  }

  // Guardar ejemplos
  if (current.examples.size < 5) {

    const example =
      `${element.tagName.toLowerCase()}` +
      `${element.id ? '#' + element.id : ''}` +
      `${element.className
        ? '.' + element.className.split(' ').join('.')
        : ''
      }`;

    current.examples.add(example);
  }

  auditState.extensions.set(source, current);

  auditState.totalInjections++;


  console.warn(
    `🚨 [DETECTOR] ${source} detected using signature "${matchedKeyword}"`,
    {
      element,
      matchedKeyword,
      tag: element.tagName,
      id: element.id,
      classes: element.className,
      html: element.outerHTML.slice(0, 300)
    }
  );

  scheduleUpdate();
};

let updateScheduled = false;

/**
 * Agrupa las actualizaciones de la interfaz para evitar bloqueos.
 * Usa requestAnimationFrame para sincronizarse con el refresco del monitor.
 */
const scheduleUpdate = () => {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    reportSummary();
    updateScheduled = false;
  });
};


const reportSummary = () => {
  const serializableExtensions = Array.from(auditState.extensions.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    examples: Array.from(data.examples),
    keywords: Array.from(data.keywords)
  }));

  const payload = {
    action: 'UPDATE_STATS',
    totalInjections: auditState.totalInjections,
    extensionsCount: auditState.extensions.size,
    extensions: serializableExtensions
  };

  // Enviar a la extensión (solo si el popup está abierto)
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage(payload).catch(() => {
      // Ignorar errores si el popup está cerrado
    });
  }

  console.log(
    `📊 Audit: ${auditState.totalInjections} detections across ${auditState.extensions.size} extensions.`
  );
};

let observer: MutationObserver | null = null;
let stopTimerId: NodeJS.Timeout | null = null;
let sessionEndTime: number | null = null;
let pollingInterval: NodeJS.Timeout | null = null;
let nextScanTime: number | null = null;
let intervalDurationMs: number | null = null;

const runFullScan = () => {
  console.log('🔍 [DETECTOR] Starting scheduled full scan...');
  document.body.querySelectorAll('*').forEach(el => {
    registerInjection(el as HTMLElement);
  });
  reportSummary();
  if (intervalDurationMs) {
    nextScanTime = Date.now() + intervalDurationMs;
  }
};

const auditNode = (node: Node) => {
  if (node.nodeType === Node.ELEMENT_NODE) {
    registerInjection(node as HTMLElement);
  }
};

const setupVigilante = () => {
  console.clear();

  // Limpiar estado previo
  auditState.extensions.clear();
  auditState.totalInjections = 0;

  console.log('🚀 Watcher active. Observing DOM changes...');

  // Escaneo inicial del contenido ya existente
  document.body.querySelectorAll('*').forEach(el => auditNode(el));
  reportSummary();

  // Si ya existe un observador, lo desconectamos primero
  if (observer) {
    observer.disconnect();
  }

  // Limpiamos cualquier temporizador previo
  if (stopTimerId) {
    clearTimeout(stopTimerId);
    stopTimerId = null;
  }

  // Creamos el observador para detectar inyecciones en tiempo real
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(auditNode);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
};

const stopVigilante = (notifyPopup = false) => {
  // Detener observador en tiempo real
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log("🛑 Real-time observer stopped.");
  }
  
  // Detener escaneo periódico
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("🛑 Periodic scanner stopped.");
  }

  // Detener temporizador de sesión
  if (stopTimerId) {
    clearTimeout(stopTimerId);
    stopTimerId = null;
  }
  
  sessionEndTime = null;
  nextScanTime = null;
  intervalDurationMs = null;

  // Avisar al popup que la sesión terminó (especialmente si fue por temporizador)
  if (notifyPopup && typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ action: 'AUDIT_STOPPED' }).catch(() => {});
  }
  
  // Reportar el estado final
  reportSummary();
};


// Escuchar mensajes de la extensión (popup)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Antes de empezar cualquier modo, nos aseguramos de que todo esté limpio.
    if (request.action === 'START_AUDIT') {
      stopVigilante(); // Limpieza universal
      setupVigilante(); // Inicia el estado y hace un escaneo inicial

      // Modo Sesión Temporizada o Continua (Usa MutationObserver)
      if (request.durationMinutes) {
        if (request.durationMinutes > 0) {
          const durationMs = request.durationMinutes * 60 * 1000;
          sessionEndTime = Date.now() + durationMs;
          console.log(`⏱️ The audit session will end in ${request.durationMinutes} minutes.`);
          stopTimerId = setTimeout(() => {
            console.log("⏰ The session time has expired.");
            stopVigilante(true);
          }, durationMs);
        } else {
          sessionEndTime = null;
          console.log(`🛰️ Continuous monitoring started.`);
        }
        sendResponse({ status: 'started', endTime: sessionEndTime, mode: 'realtime' });
      
      // Modo Escáner Periódico (Usa setInterval)
      } else if (request.intervalMinutes) {
        if (observer) observer.disconnect(); // Nos aseguramos que el observer no corra en este modo
        observer = null;

        const intervalMs = request.intervalMinutes * 60 * 1000;
        intervalDurationMs = intervalMs;
        nextScanTime = Date.now() + intervalMs;
        console.log(`📡 Periodic scanner started. It will run every ${request.intervalMinutes} minutes.`);
        pollingInterval = setInterval(runFullScan, intervalMs);
        sendResponse({ status: 'started', interval: request.intervalMinutes, mode: 'periodic', nextScanTime });
      }
    } else if (request.action === 'STOP_AUDIT') {
      stopVigilante();
      sendResponse({ status: 'stopped' });
    } else if (request.action === 'GET_STATE') {
      const active = !!observer || !!pollingInterval;
      const mode = observer ? 'realtime' : (pollingInterval ? 'periodic' : null);
      const interval = intervalDurationMs ? intervalDurationMs / (60 * 1000) : null;
      sendResponse({ active, endTime: sessionEndTime, mode, interval, nextScanTime });
    }
    return true;
  });
}

(window as any).setupVigilante = setupVigilante;
(window as any).stopVigilante = stopVigilante;
