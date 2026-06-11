import EXTENSION_SIGNATURES from './signatures.json' with { type: 'json' };

/**
 * @typedef {object} DetectionResult
 * @property {string} source - La categoría de la extensión detectada (ej. 'ADBLOCKER').
 * @property {string | null} matchedKeyword - La palabra clave específica que causó la detección.
 * @property {string} matchedValue - El fragmento de HTML/atributos donde se encontró la coincidencia.
 * @property {HTMLElement} element - El elemento del DOM que fue inyectado.
 */

/**
 * @typedef {object} DomConflictScoutOptions
 * @property {(detection: DetectionResult) => void} [onDetection] - Callback que se ejecuta cada vez que se detecta una inyección.
 * @property {boolean} [debug=false] - Si es true, habilita los logs en la consola.
 */
export interface DomConflictScoutOptions {
  onDetection?: (detection: {
    source: string;
    matchedKeyword: string | null;
    element: HTMLElement;
  }) => void;
  debug?: boolean;
}


/**
 * DomConflictScout se encarga de monitorear el DOM para detectar
 * inyecciones de elementos por parte de extensiones de navegador.
 */
export class DomConflictScout {
  private options: DomConflictScoutOptions;
  private observer: MutationObserver | null = null;

  /**
   * Crea una instancia de DomConflictScout.
   * @param {DomConflictScoutOptions} options - Opciones de configuración para el auditor.
   */
  constructor(options: DomConflictScoutOptions = {}) {
    this.options = options;
  }

  /**
   * Inicia el monitoreo del DOM.
   */
  public start() {
    if (this.options.debug) {
      console.log('🚀 DomConflictScout: Vigilant activated');
    }
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.registerInjection(node as HTMLElement);
          }
        });
      });
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    
    // Escaneo inicial
    document.body.querySelectorAll('*').forEach(el => this.registerInjection(el as HTMLElement));
  }

  /**
   * Detiene el monitoreo del DOM.
   */
  public stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      if (this.options.debug) {
        console.log('🛑 DomConflictScout: Vigilant stopped.');
      }
    }
  }

  private registerInjection(element: HTMLElement) {
    if (this.shouldIgnoreElement(element)) return;

    const detection = this.identifySource(element);
    if (detection.source === 'UNKNOWN_EXTENSION') return;

    if (this.options.onDetection) {
      this.options.onDetection({ ...detection, element });
    }

    if (this.options.debug) {
      console.warn(`🚨 [DETECTOR] ${detection.source} detected`, {
        element,
        keyword: detection.matchedKeyword,
      });
    }
  }

  private identifySource(element: HTMLElement) {
    const fullIdentity = (
      element.id + ' ' + element.className
    ).toLowerCase();

    for (const [name, keywords] of Object.entries(EXTENSION_SIGNATURES)) {
      const matchedKeyword = keywords.find(keyword =>
        fullIdentity.includes(keyword.toLowerCase())
      );
      if (matchedKeyword) {
        return { source: name, matchedKeyword };
      }
    }
    return { source: 'UNKNOWN_EXTENSION', matchedKeyword: null };
  }

  private shouldIgnoreElement(element: HTMLElement): boolean {
    return (
      element.tagName === 'SCRIPT' ||
      element.tagName === 'STYLE' ||
      element.hasAttribute('data-v-app') ||
      !!element.closest('[data-v-app]')
    );
  }
}
