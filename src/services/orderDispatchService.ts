import { CustomerOrder, GPSLocation, OrderStatus } from '../types';
import { cloudOrderService } from './supabaseClient';
import { notificationService } from './notificationService';
import { storageService } from './storageService';
import { storeService } from './storeService';
import { BODEGA_CONFIG } from '../config/bodegaConfig';

const ORDERS_STORAGE_KEY = 'bogad_customer_orders';
const MY_ORDERS_STORAGE_KEY = 'bogad_my_local_orders';

function getScopedKey(baseKey: string, customSlug?: string): string {
  const target = customSlug || storeService.getActiveSlug();
  return `${baseKey}_${target}`;
}

export const orderDispatchService = {
  // Obtener pedidos personales realizados exclusivamente en este dispositivo (Modo Cliente)
  getMyOrders(customSlug?: string): CustomerOrder[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(MY_ORDERS_STORAGE_KEY, slug));
      if (scopedData) return JSON.parse(scopedData);
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(MY_ORDERS_STORAGE_KEY);
        if (legacyData) return JSON.parse(legacyData);
      }
      return [];
    } catch {
      return [];
    }
  },

  // Guardar pedidos personales de este dispositivo
  saveMyOrders(orders: CustomerOrder[], customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      localStorage.setItem(getScopedKey(MY_ORDERS_STORAGE_KEY, slug), JSON.stringify(orders));
      if (slug === 'bodega-jl') {
        localStorage.setItem(MY_ORDERS_STORAGE_KEY, JSON.stringify(orders));
      }
    } catch {
      // Ignorar
    }
  },

  // Obtener todos los pedidos recibidos por la tienda (Solo Dueño)
  getOrders(customSlug?: string): CustomerOrder[] {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      const scopedData = localStorage.getItem(getScopedKey(ORDERS_STORAGE_KEY, slug));
      if (scopedData) return JSON.parse(scopedData);
      if (slug === 'bodega-jl') {
        const legacyData = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (legacyData) return JSON.parse(legacyData);
      }
      return [];
    } catch {
      return [];
    }
  },

  // Guardar lista general de la tienda
  saveOrders(orders: CustomerOrder[], customSlug?: string): void {
    try {
      const slug = customSlug || storeService.getActiveSlug();
      localStorage.setItem(getScopedKey(ORDERS_STORAGE_KEY, slug), JSON.stringify(orders));
      if (slug === 'bodega-jl') {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
      }
    } catch {
      // Ignorar errores de cuota
    }
  },

  // Crear nuevo pedido (Enviado por el Cliente)
  createOrder(order: Omit<CustomerOrder, 'id' | 'orderNumber' | 'createdAt' | 'status'>, customSlug?: string): CustomerOrder {
    const slug = customSlug || storeService.getActiveSlug();
    const orders = this.getOrders(slug);
    const newOrder: CustomerOrder = {
      ...order,
      id: `ord-${Date.now()}`,
      orderNumber: `#BOG-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'pending',
      deliveryType: order.deliveryType || 'delivery',
      subtotal: order.subtotal ?? order.total,
      deliveryFee: order.deliveryFee ?? 0,
      paymentReceipt: order.paymentReceipt,
      createdAt: new Date().toISOString()
    };

    // 1. Guardar en el historial personal de compras de este dispositivo
    const myOrders = this.getMyOrders(slug);
    this.saveMyOrders([newOrder, ...myOrders], slug);

    // 2. Guardar en los pedidos entrantes del dueño
    const updated = [newOrder, ...orders];
    this.saveOrders(updated, slug);

    // 3. Sincronizar con Supabase en la nube con aislamiento de tienda
    cloudOrderService.pushOrder(newOrder, slug).catch(() => {});

    // 4. Emitir en vivo al canal Broadcast para sincronización local
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const storeChannel = new BroadcastChannel(`bogad_orders_channel_${slug}`);
        storeChannel.postMessage({ type: 'NEW_ORDER', slug, order: newOrder });
        storeChannel.close();

        const globalChannel = new BroadcastChannel('bogad_orders_channel');
        globalChannel.postMessage({ type: 'NEW_ORDER', slug, order: newOrder });
        globalChannel.close();
      } catch {
        // Ignorar
      }
    }

    return newOrder;
  },

  updateOrderStatus(orderId: string, newStatus: OrderStatus, customSlug?: string): CustomerOrder[] {
    const slug = customSlug || storeService.getActiveSlug();
    const orders = this.getOrders(slug);
    const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    this.saveOrders(updated, slug);

    // Actualizar también en el historial personal si está en este dispositivo
    const myOrders = this.getMyOrders(slug);
    if (myOrders.some(o => o.id === orderId)) {
      const updatedMyOrders = myOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      this.saveMyOrders(updatedMyOrders, slug);
    }

    // 1. Actualizar en Supabase
    cloudOrderService.updateOrderStatus(orderId, newStatus, slug).catch(() => {});

    // 2. Emitir localmente
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const storeChannel = new BroadcastChannel(`bogad_orders_channel_${slug}`);
        storeChannel.postMessage({ type: 'ORDER_STATUS_CHANGED', slug, orderId, newStatus });
        storeChannel.close();

        const globalChannel = new BroadcastChannel('bogad_orders_channel');
        globalChannel.postMessage({ type: 'ORDER_STATUS_CHANGED', slug, orderId, newStatus });
        globalChannel.close();
      } catch {
        // Ignorar
      }
    }

    return updated;
  },

  // Suscribirse a cambios en tiempo real (Local Broadcast + Supabase Cloud)
  subscribe(onMessage: (data: { type: string; order?: CustomerOrder; orderId?: string; newStatus?: OrderStatus }) => void, customSlug?: string): () => void {
    const slug = customSlug || storeService.getActiveSlug();

    // Inicializar canal de notificaciones nativas de Android
    notificationService.init();

    // Listener local (BroadcastChannel)
    const listener = (event: MessageEvent) => {
      if (event.data?.slug && event.data.slug !== slug) {
        return; // Mensaje de otra tienda
      }
      if (event.data?.type === 'NEW_ORDER' && event.data.order) {
        notificationService.notifyNewOrder(event.data.order);
      }
      onMessage(event.data);
    };

    let storeBc: BroadcastChannel | null = null;
    let globalBc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        storeBc = new BroadcastChannel(`bogad_orders_channel_${slug}`);
        storeBc.addEventListener('message', listener);

        globalBc = new BroadcastChannel('bogad_orders_channel');
        globalBc.addEventListener('message', listener);
      } catch {
        // Ignorar
      }
    }

    // Listener en la nube (Supabase Realtime)
    const unsubscribeCloud = cloudOrderService.subscribeToOrders((remoteOrder) => {
      const current = this.getOrders(slug);
      const exists = current.some(o => o.id === remoteOrder.id);
      if (!exists) {
        this.saveOrders([remoteOrder, ...current], slug);
        notificationService.notifyNewOrder(remoteOrder);
        onMessage({ type: 'NEW_ORDER', order: remoteOrder });
      } else {
        const updated = current.map(o => o.id === remoteOrder.id ? remoteOrder : o);
        this.saveOrders(updated, slug);
        onMessage({ type: 'ORDER_STATUS_CHANGED', orderId: remoteOrder.id, newStatus: remoteOrder.status });
      }
    }, slug);

    return () => {
      if (storeBc) {
        storeBc.removeEventListener('message', listener);
        storeBc.close();
      }
      if (globalBc) {
        globalBc.removeEventListener('message', listener);
        globalBc.close();
      }
      if (unsubscribeCloud) {
        unsubscribeCloud();
      }
    };
  },

  // Capturar coordenadas GPS del dispositivo
  async captureGPS(): Promise<GPSLocation> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('La geolocalización no es compatible con este dispositivo.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy);
          const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

          resolve({
            lat,
            lng,
            accuracy,
            mapsUrl,
            timestamp: pos.timestamp
          });
        },
        (error) => {
          let msg = 'No se pudo obtener la ubicación GPS.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Permiso de ubicación denegado. Por favor activa el GPS para poder enviar tu pedido.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'Señal GPS no disponible temporalmente. Intenta nuevamente.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'Tiempo de espera agotado al obtener el GPS.';
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  },

  // Formatear mensaje para WhatsApp con detección de medio (Delivery vs En Local)
  generateWhatsAppLink(order: CustomerOrder, customPhone?: string): string {
    const profile = storageService.getStoreProfile();
    const phoneToUse = customPhone || profile.whatsappNumber || BODEGA_CONFIG.whatsappNumber;
    const cleanPhone = phoneToUse.replace(/[^0-9]/g, '');
    const currency = profile.currencySymbol || '$';

    const isLocal = order.deliveryType === 'local';
    const subtotal = order.subtotal ?? order.total;
    const deliveryFee = order.deliveryFee ?? 0;

    const itemsList = order.items
      .map(i => `• ${i.quantity}x ${i.product.name} (${currency}${(i.product.price * i.quantity).toFixed(2)})`)
      .join('\n');

    let paymentText = 'Efectivo';
    if (order.paymentMethod === 'nequi') {
      paymentText = '🟣 Nequi Colombia (Transferencia)';
    } else if (order.paymentMethod === 'bancolombia') {
      paymentText = '🟡 Bancolombia (Cuenta)';
    } else if (order.paymentMethod === 'bdv') {
      paymentText = '🔴 Pago Móvil Banco de Venezuela (0102)';
    } else if (order.paymentMethod === 'banesco') {
      paymentText = '🟢 Pago Móvil Banesco (0134)';
    } else if (order.paymentMethod === 'bnc') {
      paymentText = '🔵 Pago Móvil BNC (0191)';
    } else if (order.paymentMethod === 'cash') {
      paymentText = '💵 Efectivo (Contra entrega)';
    } else {
      paymentText = String(order.paymentMethod).toUpperCase();
    }

    let text = '';
    if (isLocal) {
      text = `🏪 *NUEVO PEDIDO EN LOCAL - ${profile.name.toUpperCase()} (${order.orderNumber})*
🟢 *MODALIDAD: RETIRO EN TIENDA / EN LOCAL*
👤 *Cliente:* ${order.customerName}
📞 *Teléfono:* ${order.customerPhone}

📍 *LUGAR DE ENTREGA:*
El cliente pasará directamente a retirar su pedido al local.
${order.referenceNotes ? `ℹ️ *Nota del cliente:* ${order.referenceNotes}\n` : ''}
🛒 *DETALLE DE PRODUCTOS:*
${itemsList}

💰 *TOTAL A PAGAR: ${currency}${order.total.toFixed(2)}* (Sin costo de delivery)
💳 *Método de Pago:* ${paymentText}
🧾 *Comprobante de Pago:* ${order.paymentReceipt ? 'Adjuntado en la orden 📸' : 'Pendiente / En Efectivo'}

¡Por favor tener el pedido preparado en mostrador! 🏪🛍️`;
    } else {
      text = `🛵 *NUEVO PEDIDO DELIVERY - ${profile.name.toUpperCase()} (${order.orderNumber})*
🔵 *MODALIDAD: ENTREGA A DOMICILIO (DELIVERY)*
👤 *Cliente:* ${order.customerName}
📞 *Teléfono:* ${order.customerPhone}

📍 *DIRECCIÓN DE ENTREGA:*
${order.address}
${order.referenceNotes ? `ℹ️ *Ref:* ${order.referenceNotes}\n` : ''}
🗺️ *UBICACIÓN GPS EXACTA (Google Maps):*
${order.gpsLocation?.mapsUrl || 'Sin GPS'}

🛒 *DETALLE DEL PEDIDO:*
${itemsList}

💵 *PRECIO SOLO PRODUCTOS:* ${currency}${subtotal.toFixed(2)}
🛵 *COSTO DE DELIVERY:* ${currency}${deliveryFee.toFixed(2)}
💰 *TOTAL A PAGAR (CON DELIVERY): ${currency}${order.total.toFixed(2)}*
💳 *Método de Pago:* ${paymentText}
🧾 *Comprobante de Pago:* ${order.paymentReceipt ? 'Adjuntado en la orden 📸' : 'Pendiente / En Efectivo'}

¡Por favor confirmar recepción y preparar despacho! 🛵💨`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  },

  // Formatear mensaje para la app o central de repartidores PEDIGOCHOS (Número fijo e inmodificable: +573227949751)
  generatePedigochosWhatsAppLink(order: CustomerOrder): string {
    const profile = storageService.getStoreProfile();
    const cleanPhone = '573227949751'; // Número fijo oficial de Pedigochos
    const currency = profile.currencySymbol || '$';

    const subtotal = order.subtotal ?? order.total;
    const deliveryFee = order.deliveryFee ?? 0;

    const itemsList = order.items
      .map(i => `• ${i.quantity}x ${i.product.name} (${currency}${(i.product.price * i.quantity).toFixed(2)})`)
      .join('\n');

    let paymentText = 'Efectivo';
    if (order.paymentMethod === 'nequi') {
      paymentText = 'Nequi (Transferido previamente)';
    } else if (order.paymentMethod === 'bancolombia') {
      paymentText = 'Bancolombia (Transferido previamente)';
    } else if (order.paymentMethod === 'bdv' || order.paymentMethod === 'banesco' || order.paymentMethod === 'bnc') {
      paymentText = 'Pago Móvil (Transferido previamente)';
    } else if (order.paymentMethod === 'cash') {
      paymentText = '💵 EFECTIVO (Cobrar en puerta al cliente)';
    } else {
      paymentText = String(order.paymentMethod).toUpperCase();
    }

    const text = `🛵 *SOLICITUD DE DOMICILIO - PEDIGOCHOS* 🛵
━━━━━━━━━━━━━━━━━━━━━━
🏪 *TIENDA ORIGEN:* ${profile.name}
📍 *Recoger en local:* ${profile.address}
📞 *Teléfono Tienda:* ${profile.phoneDisplay || profile.whatsappNumber}
🔖 *Orden:* ${order.orderNumber}

👤 *DATOS DEL CLIENTE:*
• *Nombre:* ${order.customerName}
• *Teléfono:* ${order.customerPhone}
• *Dirección de entrega:* ${order.address}
${order.referenceNotes ? `• *Referencia:* ${order.referenceNotes}\n` : ''}
🗺️ *UBICACIÓN GPS CLIENTE (Google Maps):*
${order.gpsLocation?.mapsUrl || 'Sin enlace GPS'}

📦 *DETALLE DE PRODUCTOS:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━━━
💵 *PRECIO SOLO PRODUCTOS:* ${currency}${subtotal.toFixed(2)}
🛵 *COSTO DELIVERY:* ${currency}${deliveryFee.toFixed(2)}
💰 *PRECIO TOTAL A COBRAR (CON DELIVERY): ${currency}${order.total.toFixed(2)}*
💳 *FORMA DE PAGO:* ${paymentText}
🧾 *COMPROBANTE:* ${order.paymentReceipt ? 'Verificado por la tienda (Adjuntado) ✅' : 'Cobrar en entrega'}
━━━━━━━━━━━━━━━━━━━━━━
¡Por favor asignar motorizado para despacho inmediato! 🛵💨`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }
};
