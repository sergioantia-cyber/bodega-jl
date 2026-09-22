import { CartItem, Product, Customer, Sale, DailyClosingReport, StoreProfile, UserRole } from '../types';
import { INITIAL_PRODUCTS } from './productData';
import { INITIAL_CUSTOMERS } from './customerData';
import { BODEGA_CONFIG } from '../config/bodegaConfig';
import { storeService } from './storeService';
import { cloudStoreService, cloudProductService } from './supabaseClient';

const CART_STORAGE_KEY = 'bogad_cart_data';
const THEME_STORAGE_KEY = 'bogad_theme';
const PRODUCTS_STORAGE_KEY = 'bogad_products_data';
const CUSTOMERS_STORAGE_KEY = 'bogad_customers_data';
const SALES_STORAGE_KEY = 'bogad_sales_data';
const FAVORITES_STORAGE_KEY = 'bogad_favorite_products';
const CLOSINGS_STORAGE_KEY = 'bogad_daily_closings';
const DEBT_TEMPLATE_STORAGE_KEY = 'bogad_debt_template';

function getScopedKey(baseKey: string, customSlug?: string): string {
  const target = customSlug || storeService.getActiveSlug();
  return `${baseKey}_${target}`;
}

const DEFAULT_DEBT_TEMPLATE = `👋 Hola {nombre}, te saluda cordialmente {bodega}.
Te escribimos con aprecio para recordarte tu saldo pendiente de *${'{deuda}'}*.
Puedes cancelarlo con efectivo o mediante Yape/Plin al *{celular}*.
¡Muchas gracias por tu preferencia y que tengas un excelente día! 🏪✨`;

export const storageService = {
  // --- CARRITO ---
  getCart(customSlug?: string): CartItem[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(CART_STORAGE_KEY, slug));
      if (scopedData) return JSON.parse(scopedData);
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(CART_STORAGE_KEY);
        if (legacyData) return JSON.parse(legacyData);
      }
      return [];
    } catch {
      return [];
    }
  },

  saveCart(items: CartItem[], customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      localStorage.setItem(getScopedKey(CART_STORAGE_KEY, slug), JSON.stringify(items));
      if (slug === 'bodega-jl') {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      // Storage error
    }
  },

  // --- PRODUCTOS Y CONTROL DE STOCK ---
  getProducts(customSlug?: string): Product[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(PRODUCTS_STORAGE_KEY, slug));
      if (scopedData) {
        return JSON.parse(scopedData);
      }
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (legacyData) {
          return JSON.parse(legacyData);
        }
      }
      this.saveProducts(INITIAL_PRODUCTS, slug);
      return INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  },

  saveProducts(products: Product[], customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      localStorage.setItem(getScopedKey(PRODUCTS_STORAGE_KEY, slug), JSON.stringify(products));
      if (slug === 'bodega-jl') {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      }

      // 1. Notificar en la misma ventana (catálogo del cliente)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bogad_products_updated', { detail: { slug, products } }));

        // 2. Notificar a otras pestañas/ventanas con BroadcastChannel
        if ('BroadcastChannel' in window) {
          try {
            const prodChannel = new BroadcastChannel(`bogad_products_channel_${slug}`);
            prodChannel.postMessage({ type: 'PRODUCTS_UPDATED', slug, products });
            prodChannel.close();

            const globalProdChannel = new BroadcastChannel('bogad_products_channel');
            globalProdChannel.postMessage({ type: 'PRODUCTS_UPDATED', slug, products });
            globalProdChannel.close();
          } catch {
            // Ignorar
          }
        }
      }

      // 3. Sincronizar en la nube con Supabase si está disponible
      cloudProductService.pushProducts(products, slug).catch(() => {});
    } catch {
      // Storage error
    }
  },

  addProduct(product: Product, customSlug?: string): Product[] {
    const current = this.getProducts(customSlug);
    const updated = [product, ...current];
    this.saveProducts(updated, customSlug);
    return updated;
  },

  updateProduct(updatedProduct: Product, customSlug?: string): Product[] {
    const current = this.getProducts(customSlug);
    const updated = current.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    this.saveProducts(updated, customSlug);
    return updated;
  },

  deleteProduct(productId: string, customSlug?: string): Product[] {
    const slug = customSlug || storeService.getActiveSlug();
    const current = this.getProducts(slug);
    const updated = current.filter(p => p.id !== productId);
    this.saveProducts(updated, slug);
    cloudProductService.deleteProduct(productId, slug).catch(() => {});
    return updated;
  },

  // Descontar stock tras una venta
  decrementStock(items: CartItem[], customSlug?: string): Product[] {
    const products = this.getProducts(customSlug);
    const updated = products.map((p) => {
      const soldItem = items.find((i) => i.product.id === p.id);
      if (soldItem) {
        const newStock = Math.max(0, p.stock - soldItem.quantity);
        return {
          ...p,
          stock: newStock,
          inStock: newStock > 0
        };
      }
      return p;
    });
    this.saveProducts(updated, customSlug);
    return updated;
  },

  // --- PRODUCTOS FAVORITOS DEL CLIENTE ---
  getFavorites(customSlug?: string): string[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(FAVORITES_STORAGE_KEY, slug));
      if (scopedData) return JSON.parse(scopedData);
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (legacyData) return JSON.parse(legacyData);
      }
      return [];
    } catch {
      return [];
    }
  },

  toggleFavorite(productId: string, customSlug?: string): string[] {
    const slug = customSlug || storeService.getActiveSlug();
    const current = this.getFavorites(slug);
    const exists = current.includes(productId);
    const updated = exists ? current.filter((id) => id !== productId) : [...current, productId];
    try {
      localStorage.setItem(getScopedKey(FAVORITES_STORAGE_KEY, slug), JSON.stringify(updated));
      if (slug === 'bodega-jl') {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // Ignore
    }
    return updated;
  },

  isFavorite(productId: string, customSlug?: string): boolean {
    return this.getFavorites(customSlug).includes(productId);
  },

  // --- CLIENTES Y FIADOS ---
  getCustomers(customSlug?: string): Customer[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(CUSTOMERS_STORAGE_KEY, slug));
      if (scopedData) {
        return JSON.parse(scopedData);
      }
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
        if (legacyData) {
          return JSON.parse(legacyData);
        }
      }
      this.saveCustomers(INITIAL_CUSTOMERS, slug);
      return INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  },

  saveCustomers(customers: Customer[], customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      localStorage.setItem(getScopedKey(CUSTOMERS_STORAGE_KEY, slug), JSON.stringify(customers));
      if (slug === 'bodega-jl') {
        localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
      }
    } catch {
      // Storage error
    }
  },

  updateCustomerDebt(customerId: string, amountChange: number, customSlug?: string): Customer[] {
    const slug = customSlug || storeService.getActiveSlug();
    const customers = this.getCustomers(slug);
    const today = new Date().toISOString().split('T')[0];
    const updated = customers.map((c) => {
      if (c.id === customerId) {
        return {
          ...c,
          debt: Math.round((c.debt + amountChange) * 100) / 100,
          lastPaymentDate: today
        };
      }
      return c;
    });
    this.saveCustomers(updated, slug);
    return updated;
  },

  addCustomer(customer: Customer, customSlug?: string): Customer[] {
    const slug = customSlug || storeService.getActiveSlug();
    const current = this.getCustomers(slug);
    const updated = [customer, ...current];
    this.saveCustomers(updated, slug);
    return updated;
  },

  // --- PLANTILLA DE COBRANZA AMABLE ---
  getDebtTemplate(customSlug?: string): string {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(DEBT_TEMPLATE_STORAGE_KEY, slug));
      if (scopedData) return scopedData;
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(DEBT_TEMPLATE_STORAGE_KEY);
        if (legacyData) return legacyData;
      }
      return DEFAULT_DEBT_TEMPLATE;
    } catch {
      return DEFAULT_DEBT_TEMPLATE;
    }
  },

  saveDebtTemplate(template: string, customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      localStorage.setItem(getScopedKey(DEBT_TEMPLATE_STORAGE_KEY, slug), template);
      if (slug === 'bodega-jl') {
        localStorage.setItem(DEBT_TEMPLATE_STORAGE_KEY, template);
      }
    } catch {
      // Ignore
    }
  },

  // --- HISTORIAL DE VENTAS ---
  getSales(customSlug?: string): Sale[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(SALES_STORAGE_KEY, slug));
      if (scopedData) return JSON.parse(scopedData);
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(SALES_STORAGE_KEY);
        if (legacyData) return JSON.parse(legacyData);
      }
      return [];
    } catch {
      return [];
    }
  },

  recordSale(sale: Sale, customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const sales = this.getSales(slug);
      const updated = [sale, ...sales.slice(0, 99)];
      localStorage.setItem(getScopedKey(SALES_STORAGE_KEY, slug), JSON.stringify(updated));
      if (slug === 'bodega-jl') {
        localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // Storage error
    }
  },

  // --- CIERRES DE CAJA DIARIOS (REPORTE Z) ---
  getDailyClosings(customSlug?: string): DailyClosingReport[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(CLOSINGS_STORAGE_KEY, slug));
      if (scopedData) return JSON.parse(scopedData);
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(CLOSINGS_STORAGE_KEY);
        if (legacyData) return JSON.parse(legacyData);
      }
      return [];
    } catch {
      return [];
    }
  },

  recordDailyClosing(closing: DailyClosingReport, customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const closings = this.getDailyClosings(slug);
      const updated = [closing, ...closings.slice(0, 29)];
      localStorage.setItem(getScopedKey(CLOSINGS_STORAGE_KEY, slug), JSON.stringify(updated));
      if (slug === 'bodega-jl') {
        localStorage.setItem(CLOSINGS_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // Storage error
    }
  },

  // --- TEMA ---
  getTheme(): 'light' | 'dark' {
    try {
      const theme = localStorage.getItem(THEME_STORAGE_KEY);
      if (theme === 'dark' || theme === 'light') return theme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  },

  saveTheme(theme: 'light' | 'dark'): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore
    }
  },

  // --- PERFIL Y TELÉFONO DE LA BODEGA (MARCA BLANCA / MULTI-TENANT) ---
  getStoreProfile(customSlug?: string): StoreProfile {
    try {
      const activeSlug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(`bogad_store_profile_${activeSlug}`);
      const legacyData = activeSlug === 'bodega-jl' ? localStorage.getItem('bogad_store_profile') : null;
      const rawData = scopedData || legacyData;

      if (rawData) {
        const parsed = JSON.parse(rawData);
        const name = parsed.name || (activeSlug === 'bodega-jl' ? BODEGA_CONFIG.name : activeSlug);
        const resolvedSlug = activeSlug;
        
        let resolvedCatalogUrl = parsed.catalogUrl;
        if (!resolvedCatalogUrl || resolvedCatalogUrl.includes('.onrender.com')) {
          resolvedCatalogUrl = storeService.getStoreShareUrl(resolvedSlug);
        }

        return {
          ...BODEGA_CONFIG,
          ...parsed,
          name,
          slug: resolvedSlug,
          catalogUrl: resolvedCatalogUrl,
          pedigochosPhone: parsed.pedigochosPhone?.trim() || BODEGA_CONFIG.pedigochosPhone || '573227949751',
          theme: { ...BODEGA_CONFIG.theme, ...(parsed.theme || {}) },
          payments: {
            ...BODEGA_CONFIG.payments,
            ...(parsed.payments || {}),
            colombia: {
              ...BODEGA_CONFIG.payments.colombia,
              ...(parsed.payments?.colombia || {})
            },
            venezuela: {
              ...BODEGA_CONFIG.payments.venezuela,
              ...(parsed.payments?.venezuela || {})
            }
          }
        };
      }

      return {
        ...BODEGA_CONFIG,
        name: activeSlug === 'bodega-jl' ? BODEGA_CONFIG.name : activeSlug,
        slug: activeSlug,
        catalogUrl: storeService.getStoreShareUrl(activeSlug)
      };
    } catch {
      return BODEGA_CONFIG;
    }
  },

  saveStoreProfile(profile: Partial<StoreProfile>, customSlug?: string): StoreProfile {
    try {
      const current = this.getStoreProfile(customSlug);

      // Recalcular slug a partir del nombre de la tienda o parámetro
      let newSlug = current.slug;
      if (profile.name && profile.name.trim()) {
        newSlug = storeService.cleanSlug(profile.name.trim());
      } else if (profile.slug && profile.slug.trim()) {
        newSlug = storeService.cleanSlug(profile.slug.trim());
      } else if (customSlug && customSlug.trim()) {
        newSlug = storeService.cleanSlug(customSlug.trim());
      }

      // Si la URL del catálogo está vacía o es un dominio de render, actualizar automáticamente con el nuevo nombre
      let finalCatalogUrl = profile.catalogUrl !== undefined ? profile.catalogUrl.trim() : current.catalogUrl;
      if (!finalCatalogUrl || finalCatalogUrl.includes('.onrender.com')) {
        finalCatalogUrl = storeService.getStoreShareUrl(newSlug);
      }

      const updated: StoreProfile = {
        ...current,
        ...profile,
        slug: newSlug,
        catalogUrl: finalCatalogUrl,
        theme: profile.theme ? { ...current.theme, ...profile.theme } : current.theme,
        payments: profile.payments ? {
          ...current.payments,
          ...profile.payments,
          colombia: {
            ...current.payments.colombia,
            ...(profile.payments.colombia || {})
          },
          venezuela: {
            ...current.payments.venezuela,
            ...(profile.payments.venezuela || {})
          }
        } : current.payments
      };

      // Guardar con prefijo de slug y en legacy si es bodega-jl
      localStorage.setItem(`bogad_store_profile_${newSlug}`, JSON.stringify(updated));
      if (newSlug === 'bodega-jl') {
        localStorage.setItem('bogad_store_profile', JSON.stringify(updated));
      }

      // 1. Notificar en la misma ventana/pestaña
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bogad_store_profile_updated', { detail: updated }));
      }

      // 2. Notificar a otras pestañas/ventanas abiertas mediante BroadcastChannel
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const profileChannel = new BroadcastChannel(`bogad_store_channel_${newSlug}`);
          profileChannel.postMessage({ type: 'STORE_PROFILE_UPDATED', slug: newSlug, profile: updated });
          profileChannel.close();

          const globalChannel = new BroadcastChannel('bogad_store_channel');
          globalChannel.postMessage({ type: 'STORE_PROFILE_UPDATED', slug: newSlug, profile: updated });
          globalChannel.close();
        } catch {
          // Ignorar
        }
      }

      // 3. Sincronizar en la nube con Supabase Realtime para clientes remotos
      cloudStoreService.pushStoreProfile(updated).catch(() => {});

      return updated;
    } catch {
      return BODEGA_CONFIG;
    }
  },

  // --- ROL DE USUARIO (DUEÑO / CLIENTE) ---
  getUserRole(): UserRole {
    return 'customer';
  },

  saveUserRole(_role: UserRole): void {
    // Modo seguro: Cada apertura de la app inicia siempre en catálogo oficial
  }
};
