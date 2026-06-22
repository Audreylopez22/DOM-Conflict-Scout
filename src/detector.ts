import DEFAULT_SIGNATURES from './signatures.json' with { type: 'json' };

/**
 * Mapa de firmas: cada clave es una categoría (ej. 'ADBLOCKER') y su valor
 * es la lista de palabras clave que identifican a esa categoría de extensión.
 *
 * @typedef {Object.<string, string[]>} ExtensionSignatures
 */
export type ExtensionSignatures = Record<string, string[]>;

/**
 * @typedef {object} DetectionResult
 * @property {string} source - La categoría de la extensión detectada (ej. 'ADBLOCKER').
 * @property {string | null} matchedKeyword - La palabra clave específica que causó la detección.
 * @property {HTMLElement} element - El elemento del DOM que fue inyectado.
 */

/**
 * @typedef {object} DomConflictScoutOptions
 * @property {(detection: DetectionResult) => void} [onDetection] - Callback que se ejecuta cada vez que se detecta una inyección.
 * @property {boolean} [debug=false] - Si es true, habilita los logs en la consola.
 * @property {ExtensionSignatures} [customSignatures] - Firmas extra del usuario. Se FUSIONAN con las integradas: las categorías nuevas se añaden y, en las que ya existen, las palabras clave se suman sin duplicar.
 * @property {ExtensionSignatures} [signatures] - Reemplazo TOTAL de las firmas integradas. Si se define, las firmas por defecto se ignoran y solo se usan estas. Tiene prioridad sobre `customSignatures`.
 */
export interface DomConflictScoutOptions {
  onDetection?: (detection: {
    source: string;
    matchedKeyword: string | null;
    element: HTMLElement;
  }) => void;
  debug?: boolean;
  customSignatures?: ExtensionSignatures;
  signatures?: ExtensionSignatures;
}


/**
 * DomConflictScout se encarga de monitorear el DOM para detectar
 * inyecciones de elementos por parte de extensiones de navegador.
 */
export class DomConflictScout {
  private options: DomConflictScoutOptions;
  private observer: MutationObserver | null = null;
  private signatures: ExtensionSignatures;
  private processedElements = new WeakSet<HTMLElement>();

  /**
   * Crea una instancia de DomConflictScout.
   * @param {DomConflictScoutOptions} options - Opciones de configuración para el auditor.
   */
  constructor(options: DomConflictScoutOptions = {}) {
    this.options = options;

    // Punto de partida: las firmas que pase el usuario en `signatures` reemplazan
    // por completo a las integradas; si no, partimos de las firmas por defecto.
    const base = options.signatures ?? (DEFAULT_SIGNATURES as ExtensionSignatures);

    // Clonamos para no mutar nunca el objeto importado (que es compartido).
    this.signatures = {};
    for (const [category, keywords] of Object.entries(base)) {
      this.signatures[category] = [...keywords];
    }

    // `customSignatures` se fusiona encima del conjunto base.
    if (options.customSignatures) {
      for (const [category, keywords] of Object.entries(options.customSignatures)) {
        this.addSignature(category, keywords);
      }
    }
  }

  /**
   * Añade palabras clave a una categoría. Si la categoría no existe, se crea.
   * Las palabras duplicadas (sin distinguir mayúsculas) se ignoran.
   * @param {string} category - Nombre de la categoría (ej. 'ADBLOCKER').
   * @param {string[]} keywords - Palabras clave a añadir.
   */
  public addSignature(category: string, keywords: string[]) {
    const existing = this.signatures[category] ?? [];
    const seen = new Set(existing.map(k => k.toLowerCase()));
    for (const keyword of keywords) {
      if (!seen.has(keyword.toLowerCase())) {
        existing.push(keyword);
        seen.add(keyword.toLowerCase());
      }
    }
    this.signatures[category] = existing;
  }

  /**
   * Elimina firmas. Si se pasan `keywords`, quita solo esas palabras de la
   * categoría; si se omiten, elimina la categoría completa.
   * @param {string} category - Nombre de la categoría.
   * @param {string[]} [keywords] - Palabras clave concretas a quitar (opcional).
   */
  public removeSignature(category: string, keywords?: string[]) {
    if (!this.signatures[category]) return;

    if (!keywords) {
      delete this.signatures[category];
      return;
    }

    const toRemove = new Set(keywords.map(k => k.toLowerCase()));
    this.signatures[category] = this.signatures[category].filter(
      k => !toRemove.has(k.toLowerCase())
    );
  }

  /**
   * Devuelve una copia de las firmas activas en esta instancia.
   * @returns {ExtensionSignatures}
   */
  public getSignatures(): ExtensionSignatures {
    const copy: ExtensionSignatures = {};
    for (const [category, keywords] of Object.entries(this.signatures)) {
      copy[category] = [...keywords];
    }
    return copy;
  }

  /**
   * Inicia el monitoreo del DOM de forma asíncrona.
   */
  public async start() {
    if (this.options.debug) {
      console.log('🚀 DomConflictScout: Vigilant activated');
    }

    // 1. Iniciamos el observador PRIMERO para no perder nada que ocurra durante el escaneo inicial
    this.setupMutationObserver();

    // 2. Lanzamos el escaneo inicial asíncrono y por trozos (chunks)
    await this.runFullScan();
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

  private setupMutationObserver() {
    if (this.observer) this.observer.disconnect();
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
  }

  private async runFullScan() {
    if (this.options.debug) console.log('🔍 [DETECTOR] Starting optimized full scan...');
    const allElements = Array.from(document.body.querySelectorAll('*'));
    const chunkSize = 200; // Procesar en bloques para no bloquear el hilo principal
    
    for (let i = 0; i < allElements.length; i += chunkSize) {
      const chunk = allElements.slice(i, i + chunkSize);
      chunk.forEach(el => this.registerInjection(el as HTMLElement));
      // Dejar que el navegador respire
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  private registerInjection(element: HTMLElement) {
    if (this.shouldIgnoreElement(element) || this.processedElements.has(element)) {
      return;
    }

    this.processedElements.add(element);
    const detection = this.identifySource(element);

    if (detection.source !== 'UNKNOWN_EXTENSION') {
      if (this.options.onDetection) {
        this.options.onDetection({
          source: detection.source,
          matchedKeyword: detection.matchedKeyword,
          element
        });
      }
      if (this.options.debug) {
        console.warn(`🚨 [DETECTOR] ${detection.source} detected`, { 
          element, 
          keyword: detection.matchedKeyword 
        });
      }
    }
  }

  private identifySource(element: HTMLElement) {
    // Manejo seguro de className para elementos SVG
    const className = typeof element.className === 'string' 
      ? element.className 
      : (element.getAttribute('class') || '');

    const id = element.id || '';
    const basicInfo = (id + ' ' + className).toLowerCase();

    const attrInfo = Array.from(element.attributes)
      .map(attr => `${attr.name}="${attr.value}"`)
      .join(' ')
      .toLowerCase();

    // Identidad del PROPIO elemento: ID, clases y atributos (la etiqueta de
    // apertura). Deliberadamente NO se usa outerHTML: incluiría el HTML de los
    // descendientes (contagiando la firma a los contenedores padres) y el texto
    // visible de la página (provocando falsos positivos por contenido legítimo).
    const fullIdentity = `${basicInfo} ${attrInfo}`;

    for (const [name, keywords] of Object.entries(this.signatures)) {
      const matchedKeyword = keywords.find(keyword => 
        fullIdentity.includes(keyword.toLowerCase())
      );
      if (matchedKeyword) return { source: name, matchedKeyword };
    }

    return { source: 'UNKNOWN_EXTENSION', matchedKeyword: null };
  }

  private shouldIgnoreElement(element: HTMLElement): boolean {
    return (
      element.tagName === 'SCRIPT' ||
      element.tagName === 'STYLE' ||
      element.tagName === 'META' ||
      element.tagName === 'LINK' ||
      element.tagName === 'HEAD' ||
      element.hasAttribute('data-v-app') ||
      !!element.closest('[data-v-app]') ||
      // Filtros para evitar falsos positivos de CMS/WordPress
      element.classList.contains('screen-reader-text') ||
      element.classList.contains('skip-link')
    );
  }
}
