/**
 * SERVICIO MULTITIENDA (SAAS / MULTI-TENANT)
 * Permite que un solo despliegue web en Render / Vercel maneje
 * catálogos independientes mediante el parámetro ?tienda=slug en la URL.
 */

export const storeService = {
  /**
   * Obtiene el slug de la tienda a partir de la URL actual (?tienda=slug o ?store=slug o subdominio Render)
   */
  getStoreSlugFromUrl(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      // 1. Parámetro en query string: ?tienda=slug o ?store=slug
      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get('tienda') || urlParams.get('store');
      if (slug && slug.trim().length > 0) {
        return this.cleanSlug(slug.trim());
      }

      // 2. Subdominio en Render (ej: https://bodega-don-carlos.onrender.com)
      const hostname = window.location.hostname;
      if (hostname.endsWith('.onrender.com')) {
        const subdomain = hostname.replace('.onrender.com', '');
        if (subdomain && subdomain !== 'bogad' && subdomain !== 'www') {
          return this.cleanSlug(subdomain);
        }
      }
    } catch {
      // Ignorar error al parsear URL
    }
    return null;
  },

  /**
   * Obtiene el slug activo de la tienda actual.
   * Prioridad: 1. URL (?tienda=slug o subdominio) 2. Perfil guardado 3. Env/Config por defecto ('bodega-jl')
   */
  getActiveSlug(): string {
    const urlSlug = this.getStoreSlugFromUrl();
    if (urlSlug) return urlSlug;
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bogad_store_profile');
        if (saved) {
          const p = JSON.parse(saved);
          if (p.slug && typeof p.slug === 'string') {
            return this.cleanSlug(p.slug);
          }
        }
      }
    } catch {
      // Ignorar error al leer storage
    }
    return this.cleanSlug((import.meta.env.VITE_STORE_SLUG as string) || 'bodega-jl');
  },

  /**
   * Limpia un texto para convertirlo en un slug seguro para URLs
   * Ej: "Minimarket Doña María 2" -> "minimarket-dona-maria-2"
   */
  cleanSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9-]/g, '-')     // Reemplazar caracteres especiales por guión
      .replace(/-+/g, '-')             // Evitar guiones consecutivos
      .replace(/^-|-$/g, '');          // Quitar guiones al inicio y al final
  },

  /**
   * Genera el enlace público completo para compartir el catálogo de un negocio específico.
   * El dominio de Render siempre lleva el nombre de la tienda (ej: 'https://{nombre-tienda}.onrender.com')
   * @param slug Identificador o nombre de la tienda (ej: 'bodega-don-carlos')
   * @param customCatalogUrl URL base pública configurada por el dueño
   */
  getStoreShareUrl(slug: string, customCatalogUrl?: string): string {
    const cleanSlugStr = this.cleanSlug(slug || 'tienda');

    // 1. Si el dueño configuró una URL web pública personalizada válida
    if (customCatalogUrl && customCatalogUrl.trim().startsWith('http')) {
      const cleanUrl = customCatalogUrl.trim().replace(/\/+$/, '');
      // Si es un dominio onrender.com, vincularlo directamente al nombre de la tienda
      if (cleanUrl.includes('.onrender.com')) {
        return `https://${cleanSlugStr}.onrender.com`;
      }
      return `${cleanUrl}/?tienda=${cleanSlugStr}`;
    }

    // 2. Si estamos corriendo en un navegador con dominio web real (no localhost ni app local)
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      const isLocal = origin.includes('localhost') ||
                      origin.includes('127.0.0.1') ||
                      origin.includes('capacitor://') ||
                      origin.startsWith('file://');

      if (!isLocal) {
        if (origin.includes('.onrender.com')) {
          return `https://${cleanSlugStr}.onrender.com`;
        }
        const pathname = window.location.pathname.replace(/\/+$/, '');
        return `${origin}${pathname}/?tienda=${cleanSlugStr}`;
      }
    }

    // 3. Dominio de producción en Render con el nombre de la tienda
    return `https://${cleanSlugStr}.onrender.com`;
  }
};
