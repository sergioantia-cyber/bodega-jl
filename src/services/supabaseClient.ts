import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CustomerOrder, OrderStatus, StoreProfile, Product } from '../types';
import { storeService } from './storeService';
import { sortProducts } from './productData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Verificar si las credenciales son válidas y no un placeholder
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('tu-proyecto')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

if (isSupabaseConfigured) {
  console.log('✅ Supabase conectado en tiempo real:', supabaseUrl);
} else {
  console.info('ℹ️ Modo Local Offline activo: Supabase no configurado o credenciales pendientes.');
}

/**
 * Servicio de sincronización en la nube para pedidos (Multi-Tienda)
 */
export const cloudOrderService = {
  async pushOrder(order: CustomerOrder, storeSlug?: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const slug = storeSlug || storeService.getActiveSlug();
      const remoteId = order.id.startsWith(`${slug}___`) ? order.id : `${slug}___${order.id}`;

      const { error } = await supabase.from('orders').upsert({
        id: remoteId,
        order_number: order.orderNumber,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        address: order.address,
        gps_location: order.gpsLocation,
        reference_notes: order.referenceNotes ? `[${slug}] ${order.referenceNotes}` : `[${slug}]`,
        items: order.items,
        total: order.total,
        payment_method: order.paymentMethod,
        status: order.status,
        created_at: order.createdAt
      });

      if (error) {
        console.warn('Error al enviar pedido a Supabase:', error.message);
        return false;
      }

      // Difusión en canal específico de la tienda
      const channel = supabase.channel(`orders_sync_${slug}`);
      channel.send({
        type: 'broadcast',
        event: 'NEW_ORDER',
        payload: { storeSlug: slug, order }
      });

      return true;
    } catch (err) {
      console.warn('Excepción al sincronizar pedido en Supabase:', err);
      return false;
    }
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, storeSlug?: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const slug = storeSlug || storeService.getActiveSlug();
      const remoteId = orderId.startsWith(`${slug}___`) ? orderId : `${slug}___${orderId}`;

      const { error } = await supabase
        .from('orders')
        .update({ status })
        .or(`id.eq.${remoteId},id.eq.${orderId}`);

      if (error) {
        console.warn('Error al actualizar estado en Supabase:', error.message);
        return false;
      }

      const channel = supabase.channel(`orders_sync_${slug}`);
      channel.send({
        type: 'broadcast',
        event: 'ORDER_STATUS_CHANGED',
        payload: { storeSlug: slug, orderId, status }
      });

      return true;
    } catch (err) {
      console.warn('Excepción al actualizar estado en Supabase:', err);
      return false;
    }
  },

  async fetchRecentOrders(storeSlug?: string): Promise<CustomerOrder[] | null> {
    if (!supabase) return null;
    try {
      const slug = storeSlug || storeService.getActiveSlug();
      let { data, error } = await supabase
        .from('orders')
        .select('*')
        .like('id', `${slug}___%`)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fallback para bodega-jl (pedidos heredados sin prefijo)
      if ((!data || data.length === 0) && slug === 'bodega-jl') {
        const fallback = await supabase
          .from('orders')
          .select('*')
          .not('id', 'like', '%___%')
          .order('created_at', { ascending: false })
          .limit(50);
        data = fallback.data;
      }

      if (error || !data) return null;

      return data.map((row: any) => {
        const cleanId = row.id.startsWith(`${slug}___`) ? row.id.replace(`${slug}___`, '') : row.id;
        let cleanNotes = row.reference_notes || undefined;
        if (cleanNotes && cleanNotes.startsWith(`[${slug}]`)) {
          cleanNotes = cleanNotes.replace(`[${slug}]`, '').trim() || undefined;
        }

        return {
          id: cleanId,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          address: row.address,
          gpsLocation: row.gps_location,
          referenceNotes: cleanNotes,
          items: row.items,
          total: Number(row.total),
          paymentMethod: row.payment_method,
          status: row.status,
          createdAt: row.created_at
        };
      });
    } catch (err) {
      console.warn('Excepción al consultar pedidos de Supabase:', err);
      return null;
    }
  },

  subscribeToOrders(onNewOrUpdatedOrder: (order: CustomerOrder) => void, storeSlug?: string): (() => void) | null {
    if (!supabase) return null;
    const slug = storeSlug || storeService.getActiveSlug();

    const channel = supabase
      .channel(`orders_sync_${slug}`)
      .on('broadcast', { event: 'NEW_ORDER' }, ({ payload }) => {
        if (payload?.order) {
          onNewOrUpdatedOrder(payload.order as CustomerOrder);
        }
      })
      .on('broadcast', { event: 'ORDER_STATUS_CHANGED' }, ({ payload }) => {
        if (payload?.orderId && payload?.status) {
          // Disparado por cambio de estado
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const row = payload.new as any;
          if (row && row.id) {
            const matchesSlug = row.id.startsWith(`${slug}___`) || (slug === 'bodega-jl' && !row.id.includes('___'));
            if (matchesSlug) {
              const cleanId = row.id.startsWith(`${slug}___`) ? row.id.replace(`${slug}___`, '') : row.id;
              let cleanNotes = row.reference_notes || undefined;
              if (cleanNotes && cleanNotes.startsWith(`[${slug}]`)) {
                cleanNotes = cleanNotes.replace(`[${slug}]`, '').trim() || undefined;
              }

              const formatted: CustomerOrder = {
                id: cleanId,
                orderNumber: row.order_number,
                customerName: row.customer_name,
                customerPhone: row.customer_phone,
                address: row.address,
                gpsLocation: row.gps_location,
                referenceNotes: cleanNotes,
                items: row.items,
                total: Number(row.total),
                paymentMethod: row.payment_method,
                status: row.status,
                createdAt: row.created_at
              };
              onNewOrUpdatedOrder(formatted);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};

/**
 * Servicio de sincronización en tiempo real para perfil y métodos de pago de la tienda (Multi-Tienda)
 */
export const cloudStoreService = {
  async pushStoreProfile(profile: StoreProfile): Promise<boolean> {
    if (!supabase) return false;
    try {
      const slug = profile.slug || storeService.getActiveSlug();

      // 1. Guardar en la base de datos de Supabase bajo el ID del slug
      await supabase.from('store_profiles').upsert({
        id: slug,
        name: profile.name,
        slogan: profile.slogan,
        icon_emoji: profile.iconEmoji,
        currency_symbol: profile.currencySymbol,
        whatsapp_number: profile.whatsappNumber,
        phone_display: profile.phoneDisplay,
        address: profile.address,
        schedule: profile.schedule,
        delivery_fee: profile.deliveryFee,
        catalog_url: profile.catalogUrl,
        pedigochos_phone: profile.pedigochosPhone,
        theme: profile.theme,
        payments: profile.payments,
        updated_at: new Date().toISOString()
      });

      // 2. Difusión inmediata tanto en canal particular de la tienda como general
      const channel = supabase.channel(`store_profile_sync_${slug}`);
      channel.send({
        type: 'broadcast',
        event: 'STORE_PROFILE_UPDATED',
        payload: { ...profile, slug }
      });

      const genericChannel = supabase.channel('store_profile_sync');
      genericChannel.send({
        type: 'broadcast',
        event: 'STORE_PROFILE_UPDATED',
        payload: { ...profile, slug }
      });

      return true;
    } catch (err) {
      console.warn('Error al sincronizar perfil en la nube:', err);
      return false;
    }
  },

  async fetchStoreProfile(slug?: string): Promise<StoreProfile | null> {
    if (!supabase) return null;
    try {
      const targetId = slug || storeService.getActiveSlug();
      // 1. Buscar coincidencia exacta por ID de tienda
      const { data } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      let row = data;

      // 2. Si no existe y el slug es distinto a bodega-jl, probar fallback
      if (!row && targetId !== 'bodega-jl') {
        const { data: fallbackData } = await supabase
          .from('store_profiles')
          .select('*')
          .eq('id', 'bodega-jl')
          .maybeSingle();
        row = fallbackData;
      }

      if (!row) return null;

      return {
        slug: row.id,
        name: row.name,
        slogan: row.slogan,
        iconEmoji: row.icon_emoji,
        currencySymbol: row.currency_symbol,
        whatsappNumber: row.whatsapp_number,
        phoneDisplay: row.phone_display || row.whatsapp_number,
        address: row.address,
        schedule: row.schedule,
        deliveryFee: Number(row.delivery_fee) || 2.00,
        catalogUrl: row.catalog_url,
        pedigochosPhone: row.pedigochos_phone || '573227949751',
        theme: row.theme,
        payments: row.payments
      };
    } catch {
      return null;
    }
  },

  subscribeToStoreProfile(onProfileUpdated: (profile: StoreProfile) => void, storeSlug?: string): (() => void) | null {
    if (!supabase) return null;
    const slug = storeSlug || storeService.getActiveSlug();

    const channel = supabase
      .channel(`store_profile_sync_${slug}`)
      .on('broadcast', { event: 'STORE_PROFILE_UPDATED' }, ({ payload }) => {
        if (payload && payload.payments) {
          const payloadSlug = payload.slug || slug;
          if (payloadSlug === slug) {
            onProfileUpdated(payload as StoreProfile);
          }
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_profiles' },
        (payload) => {
          const row = payload.new as any;
          if (row && row.payments && (row.id === slug || (!row.id && slug === 'bodega-jl'))) {
            onProfileUpdated({
              slug: row.id || slug,
              name: row.name,
              slogan: row.slogan,
              iconEmoji: row.icon_emoji,
              currencySymbol: row.currency_symbol,
              whatsappNumber: row.whatsapp_number,
              phoneDisplay: row.phone_display || row.whatsapp_number,
              address: row.address,
              schedule: row.schedule,
              deliveryFee: Number(row.delivery_fee) || 2.00,
              catalogUrl: row.catalog_url,
              pedigochosPhone: row.pedigochos_phone || '573227949751',
              theme: row.theme,
              payments: row.payments
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};

/**
 * Servicio de sincronización en tiempo real para catálogo de productos e inventario (Multi-Tienda)
 */
export const cloudProductService = {
  async pushProducts(products: Product[], storeSlug?: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const slug = storeSlug || storeService.getActiveSlug();

      // 1. Guardar en base de datos con clave compuesta aislada por tienda
      const rows = products.map(p => {
        const compositeId = p.id.startsWith(`${slug}___`) ? p.id : `${slug}___${p.id}`;
        return {
          id: compositeId,
          barcode: p.barcode || null,
          name: p.name,
          category: p.category,
          price: p.price,
          original_price: p.originalPrice || null,
          unit: p.unit || 'Unidad',
          image: p.image || null,
          tag: p.tag || null,
          in_stock: p.inStock,
          stock: p.stock,
          min_stock: p.minStock || 3
        };
      });

      await supabase.from('products').upsert(rows);

      // 2. Difusión inmediata a todos los clientes conectados a este catálogo (orden estable)
      const sorted = sortProducts(products);
      const channel = supabase.channel(`products_sync_${slug}`);
      channel.send({
        type: 'broadcast',
        event: 'PRODUCTS_UPDATED',
        payload: { storeSlug: slug, products: sorted }
      });

      return true;
    } catch (err) {
      console.warn('Error al subir productos a la nube:', err);
      return false;
    }
  },

  async deleteProduct(productId: string, storeSlug?: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const slug = storeSlug || storeService.getActiveSlug();
      const compositeId = productId.startsWith(`${slug}___`) ? productId : `${slug}___${productId}`;

      const { error } = await supabase
        .from('products')
        .delete()
        .or(`id.eq.${compositeId},id.eq.${productId}`);

      if (error) {
        console.warn('Error al eliminar producto en Supabase:', error.message);
        return false;
      }

      const fresh = await this.fetchProducts(slug) || [];
      const channel = supabase.channel(`products_sync_${slug}`);
      channel.send({
        type: 'broadcast',
        event: 'PRODUCTS_UPDATED',
        payload: { storeSlug: slug, products: fresh }
      });
      return true;
    } catch (err) {
      console.warn('Excepción al eliminar producto en Supabase:', err);
      return false;
    }
  },

  async fetchProducts(storeSlug?: string): Promise<Product[] | null> {
    if (!supabase) return null;
    try {
      const slug = storeSlug || storeService.getActiveSlug();

      // Consultar productos pertenecientes a esta tienda con ordenamiento estable
      let { data, error } = await supabase
        .from('products')
        .select('*')
        .like('id', `${slug}___%`)
        .order('id', { ascending: true });

      // Fallback para bodega-jl si aún tiene productos sin prefijo
      if ((!data || data.length === 0) && slug === 'bodega-jl') {
        const fallback = await supabase
          .from('products')
          .select('*')
          .not('id', 'like', '%___%')
          .order('id', { ascending: true });
        data = fallback.data;
      }

      if (error || !data || data.length === 0) return null;

      const mapped = data.map((r: any) => {
        const cleanId = r.id.startsWith(`${slug}___`) ? r.id.replace(`${slug}___`, '') : r.id;
        return {
          id: cleanId,
          barcode: r.barcode || undefined,
          name: r.name,
          category: r.category,
          price: Number(r.price),
          originalPrice: r.original_price ? Number(r.original_price) : undefined,
          unit: r.unit || 'Unidad',
          image: r.image || undefined,
          tag: r.tag || undefined,
          inStock: r.in_stock,
          stock: Number(r.stock) || 0,
          minStock: Number(r.min_stock) || 3
        };
      });

      return sortProducts(mapped);
    } catch {
      return null;
    }
  },

  subscribeToProducts(onProductsUpdated: (products: Product[]) => void, storeSlug?: string): (() => void) | null {
    if (!supabase) return null;
    const slug = storeSlug || storeService.getActiveSlug();

    const channel = supabase
      .channel(`products_sync_${slug}`)
      .on('broadcast', { event: 'PRODUCTS_UPDATED' }, ({ payload }) => {
        if (payload?.products && Array.isArray(payload.products)) {
          onProductsUpdated(payload.products as Product[]);
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async () => {
          const fresh = await cloudProductService.fetchProducts(slug);
          if (fresh) onProductsUpdated(fresh);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};


