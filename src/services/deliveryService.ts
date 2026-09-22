import { VehicleRideRequest, DeliveryChatMessage, DeliveryDailyFinance, RideStatus } from '../types';
import { supabase } from './supabaseClient';
import { soundService } from './soundService';

const STORAGE_RIDES_KEY = 'bogad_pedigochos_rides';
const STORAGE_GROUP_CHAT_KEY = 'bogad_pedigochos_group_chat';
const STORAGE_SESSION_KEY = 'bogad_delivery_session';

// Credenciales fijas exigidas
const VALID_USERNAME = 'yoxman';
const VALID_PASSWORD = '12345@';
const DRIVER_NAME = 'Yoxman'; // Inmutable
const DRIVER_ID = 'yoxman';

export const deliveryService = {
  // ==========================================
  // AUTENTICACIÓN DEL DOMICILIARIO (YOXMAN)
  // ==========================================

  login(username: string, password: string): { success: boolean; message?: string } {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanUser === VALID_USERNAME && cleanPass === VALID_PASSWORD) {
      const session = {
        id: DRIVER_ID,
        name: DRIVER_NAME,
        username: VALID_USERNAME,
        role: 'delivery',
        loggedInAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      } catch {
        // Storage fail
      }
      soundService.playSuccessChime();
      return { success: true };
    }

    soundService.playWarning();
    return {
      success: false,
      message: 'Usuario o contraseña incorrectos. Verifica las credenciales de domiciliario.'
    };
  },

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // Storage fail
    }
  },

  isAuthenticated(): boolean {
    try {
      const session = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!session) return false;
      const parsed = JSON.parse(session);
      return parsed.username === VALID_USERNAME && parsed.role === 'delivery';
    } catch {
      return false;
    }
  },

  getDriverProfile(): { id: string; name: string; isNameLocked: boolean } {
    return {
      id: DRIVER_ID,
      name: DRIVER_NAME,
      isNameLocked: true // Bloqueado, no se puede cambiar
    };
  },

  // ==========================================
  // GESTIÓN DE SERVICIOS / CARRERAS DE VEHÍCULO
  // ==========================================

  getRides(): VehicleRideRequest[] {
    try {
      const raw = localStorage.getItem(STORAGE_RIDES_KEY);
      if (!raw) return this.getInitialSampleRides();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  getRideById(id: string): VehicleRideRequest | null {
    const rides = this.getRides();
    return rides.find(r => r.id === id) || null;
  },

  saveRides(rides: VehicleRideRequest[], broadcast: boolean = true): void {
    try {
      localStorage.setItem(STORAGE_RIDES_KEY, JSON.stringify(rides));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bogad_delivery_ride_updated', { detail: rides }));
      }
      if (broadcast && supabase) {
        const channel = supabase.channel('pedigochos_delivery_network', {
          config: { broadcast: { self: true } }
        });
        channel.send({
          type: 'broadcast',
          event: 'RIDES_SYNC',
          payload: rides
        }).catch(() => {});
      }
    } catch {
      // Storage fail
    }
  },

  // Crear una nueva solicitud de vehículo (desde cliente o desde pedigochos)
  createRideRequest(data: {
    customerName: string;
    customerPhone: string;
    pickupAddress: string;
    dropoffAddress: string;
    price: number;
    km: number;
    notes?: string;
    paymentMethod: 'cash' | 'nequi' | 'transfer';
    storeSlug?: string;
  }): VehicleRideRequest {
    const newRide: VehicleRideRequest = {
      id: `ride-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: `#VIAJE-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: data.customerName.trim() || 'Cliente Pedigochos',
      customerPhone: data.customerPhone.trim() || 'Sin número',
      pickupAddress: data.pickupAddress.trim() || 'Lugar de recogida',
      dropoffAddress: data.dropoffAddress.trim() || 'Destino',
      price: Math.max(0, data.price),
      km: Math.max(0.1, Number(data.km.toFixed(1))),
      notes: data.notes?.trim() || '',
      paymentMethod: data.paymentMethod || 'cash',
      status: 'available',
      createdAt: new Date().toISOString(),
      storeSlug: data.storeSlug || 'bodega-jl'
    };

    const currentRides = this.getRides();
    const updated = [newRide, ...currentRides];
    this.saveRides(updated, true);

    // Publicar automáticamente en el Chat Grupal de Domiciliarios
    this.sendServiceCardToGroup(newRide);

    soundService.playSuccessChime();
    return newRide;
  },

  // Tomar el servicio (el domiciliario acepta la carrera)
  takeRide(rideId: string, driverId = DRIVER_ID, driverName = DRIVER_NAME): VehicleRideRequest | null {
    const rides = this.getRides();
    const ride = rides.find(r => r.id === rideId);
    if (!ride) return null;

    if (ride.status !== 'available') {
      return ride; // Ya fue tomado
    }

    const updatedRide: VehicleRideRequest = {
      ...ride,
      status: 'taken',
      driverId,
      driverName,
      takenAt: new Date().toISOString()
    };

    const updatedList = rides.map(r => r.id === rideId ? updatedRide : r);
    this.saveRides(updatedList, true);

    // Mensaje en el chat grupal avisando a todos los compañeros
    this.sendGroupMessage(
      `⚡ ${driverName} ha tomado el servicio ${ride.code} (Recoge en ${ride.pickupAddress} ➔ ${ride.dropoffAddress} por $${ride.price.toLocaleString()})`,
      'Central Pedigochos',
      'system'
    );

    // Notificar en el chat privado del servicio
    this.sendRideChatMessage(
      rideId,
      `Hola ${ride.customerName}, soy tu domiciliario ${driverName} de Pedigochos. Ya tomé tu servicio y voy en camino a recoger.`,
      driverName,
      'driver'
    );

    soundService.playSuccessChime();
    return updatedRide;
  },

  // Actualizar estado de la carrera
  updateRideStatus(rideId: string, status: RideStatus): VehicleRideRequest | null {
    const rides = this.getRides();
    const ride = rides.find(r => r.id === rideId);
    if (!ride) return null;

    const updatedRide: VehicleRideRequest = {
      ...ride,
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : ride.completedAt
    };

    const updatedList = rides.map(r => r.id === rideId ? updatedRide : r);
    this.saveRides(updatedList, true);

    // Notificación en chat de la carrera
    let statusText = '';
    if (status === 'arrived_pickup') statusText = '📍 He llegado al lugar de recogida.';
    else if (status === 'in_transit') statusText = '🛵 Paquete/pedido en mano. Voy en ruta hacia tu destino.';
    else if (status === 'completed') statusText = '✅ ¡Servicio entregado con éxito! Gracias por usar Pedigochos.';
    else if (status === 'cancelled') statusText = '❌ Servicio cancelado.';

    if (statusText) {
      this.sendRideChatMessage(rideId, statusText, DRIVER_NAME, 'driver');
    }

    soundService.playPop();
    return updatedRide;
  },

  // ==========================================
  // CHAT GRUPAL DE DOMICILIARIOS
  // ==========================================

  getGroupMessages(): DeliveryChatMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_GROUP_CHAT_KEY);
      if (!raw) return this.getInitialSampleGroupMessages();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveGroupMessages(messages: DeliveryChatMessage[], broadcast: boolean = true): void {
    try {
      localStorage.setItem(STORAGE_GROUP_CHAT_KEY, JSON.stringify(messages));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bogad_delivery_chat_updated', { detail: messages }));
      }
      if (broadcast && supabase) {
        const channel = supabase.channel('pedigochos_group_chat', {
          config: { broadcast: { self: true } }
        });
        channel.send({
          type: 'broadcast',
          event: 'CHAT_SYNC',
          payload: messages
        }).catch(() => {});
      }
    } catch {
      // Storage fail
    }
  },

  sendGroupMessage(
    text: string,
    senderName = DRIVER_NAME,
    senderRole: 'driver' | 'system' | 'pedigochos' = 'driver'
  ): DeliveryChatMessage {
    const newMessage: DeliveryChatMessage = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      senderId: senderRole === 'driver' ? DRIVER_ID : 'central',
      senderName,
      senderRole,
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    const current = this.getGroupMessages();
    const updated = [...current, newMessage];
    this.saveGroupMessages(updated, true);
    return newMessage;
  },

  sendServiceCardToGroup(ride: VehicleRideRequest): void {
    const serviceMessage: DeliveryChatMessage = {
      id: `card-${ride.id}`,
      senderId: 'pedigochos-system',
      senderName: 'Central Pedigochos 🛵',
      senderRole: 'system',
      text: `¡NUEVA SOLICITUD DE VEHÍCULO DISPONIBLE! ${ride.code}`,
      timestamp: new Date().toISOString(),
      isServiceCard: true,
      rideData: ride
    };

    const current = this.getGroupMessages();
    const updated = [...current, serviceMessage];
    this.saveGroupMessages(updated, true);
  },

  // ==========================================
  // CHAT PRIVADO DEL SERVICIO CON EL CLIENTE
  // ==========================================

  getRideChatMessages(rideId: string): DeliveryChatMessage[] {
    try {
      const raw = localStorage.getItem(`bogad_ride_chat_${rideId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  sendRideChatMessage(
    rideId: string,
    text: string,
    senderName = DRIVER_NAME,
    senderRole: 'driver' | 'customer' = 'driver'
  ): DeliveryChatMessage {
    const newMessage: DeliveryChatMessage = {
      id: `ride-msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      senderId: senderRole === 'driver' ? DRIVER_ID : 'customer',
      senderName,
      senderRole,
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    try {
      const current = this.getRideChatMessages(rideId);
      const updated = [...current, newMessage];
      localStorage.setItem(`bogad_ride_chat_${rideId}`, JSON.stringify(updated));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(`bogad_ride_chat_${rideId}_updated`, { detail: updated }));
      }

      if (supabase) {
        const channel = supabase.channel(`ride_chat_${rideId}`, {
          config: { broadcast: { self: true } }
        });
        channel.send({
          type: 'broadcast',
          event: 'RIDE_CHAT_MSG',
          payload: { rideId, message: newMessage }
        }).catch(() => {});
      }
    } catch {
      // Storage fail
    }

    return newMessage;
  },

  // ==========================================
  // MÉTRICAS FINANCIERAS Y REPORTES DEL DÍA
  // ==========================================

  getDailyFinances(targetDate?: string): DeliveryDailyFinance {
    const todayStr = targetDate || new Date().toISOString().split('T')[0];
    const rides = this.getRides();

    // Filtrar carreras completadas hoy
    const todayCompleted = rides.filter(r => {
      if (r.status !== 'completed') return false;
      const rideDate = (r.completedAt || r.createdAt).split('T')[0];
      return rideDate === todayStr;
    });

    let totalEarnings = 0;
    let cashCollected = 0;
    let digitalCollected = 0;

    todayCompleted.forEach(r => {
      totalEarnings += r.price;
      if (r.paymentMethod === 'cash') {
        cashCollected += r.price;
      } else {
        digitalCollected += r.price;
      }
    });

    return {
      date: todayStr,
      completedRidesCount: todayCompleted.length,
      totalEarnings,
      cashCollected,
      digitalCollected
    };
  },

  // ==========================================
  // SUSCRIPCIÓN EN TIEMPO REAL
  // ==========================================

  subscribe(onUpdate: () => void): () => void {
    const handleStorage = () => onUpdate();

    if (typeof window !== 'undefined') {
      window.addEventListener('bogad_delivery_ride_updated', handleStorage);
      window.addEventListener('bogad_delivery_chat_updated', handleStorage);
    }

    let channelRides: any = null;
    let channelChat: any = null;

    if (supabase) {
      try {
        channelRides = supabase
          .channel('pedigochos_delivery_network')
          .on('broadcast', { event: 'RIDES_SYNC' }, ({ payload }) => {
            if (payload && Array.isArray(payload)) {
              localStorage.setItem(STORAGE_RIDES_KEY, JSON.stringify(payload));
              onUpdate();
            }
          })
          .subscribe();

        channelChat = supabase
          .channel('pedigochos_group_chat')
          .on('broadcast', { event: 'CHAT_SYNC' }, ({ payload }) => {
            if (payload && Array.isArray(payload)) {
              localStorage.setItem(STORAGE_GROUP_CHAT_KEY, JSON.stringify(payload));
              onUpdate();
            }
          })
          .subscribe();
      } catch {
        // Ignorar
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('bogad_delivery_ride_updated', handleStorage);
        window.removeEventListener('bogad_delivery_chat_updated', handleStorage);
      }
      if (supabase) {
        if (channelRides) supabase.removeChannel(channelRides);
        if (channelChat) supabase.removeChannel(channelChat);
      }
    };
  },

  // ==========================================
  // DATOS MOCK DE INICIO SI ESTÁ VACÍO
  // ==========================================

  getInitialSampleRides(): VehicleRideRequest[] {
    const today = new Date().toISOString();
    const sample: VehicleRideRequest[] = [
      {
        id: 'ride-sample-1',
        code: '#VIAJE-7721',
        customerName: 'Carlos Mendivelso',
        customerPhone: '3124567890',
        pickupAddress: 'Aguas calientes calle 3 (Bodega JL)',
        dropoffAddress: 'Barrio Simón Bolívar, Manzana C Casa 14',
        price: 6000,
        km: 2.4,
        notes: 'Llevar 2 bolsas de mercado con cuidado.',
        paymentMethod: 'cash',
        status: 'available',
        createdAt: today,
        storeSlug: 'bodega-jl'
      },
      {
        id: 'ride-sample-2',
        code: '#VIAJE-8840',
        customerName: 'Luisa Fernanda Parra',
        customerPhone: '3209876543',
        pickupAddress: 'Farmacia San Jorge, Av. Principal #4-20',
        dropoffAddress: 'Conjunto Portal del Valle, Torre 2 Apto 402',
        price: 9000,
        km: 4.8,
        notes: 'Medicamentos urgentes. Pago por Nequi confirmado.',
        paymentMethod: 'nequi',
        status: 'available',
        createdAt: today,
        storeSlug: 'bodega-jl'
      }
    ];

    try {
      localStorage.setItem(STORAGE_RIDES_KEY, JSON.stringify(sample));
    } catch {
      // Storage fail
    }

    return sample;
  },

  getInitialSampleGroupMessages(): DeliveryChatMessage[] {
    const today = new Date().toISOString();
    return [
      {
        id: 'msg-init-1',
        senderId: 'central',
        senderName: 'Central Pedigochos 🛵',
        senderRole: 'system',
        text: '👋 Bienvenidos al Chat Grupal Oficial de Domiciliarios Pedigochos. Aquí recibirán las solicitudes de vehículos y pedidos en tiempo real.',
        timestamp: today
      },
      {
        id: 'card-ride-sample-1',
        senderId: 'pedigochos-system',
        senderName: 'Central Pedigochos 🛵',
        senderRole: 'system',
        text: '¡NUEVA SOLICITUD DE VEHÍCULO DISPONIBLE! #VIAJE-7721',
        timestamp: today,
        isServiceCard: true,
        rideData: {
          id: 'ride-sample-1',
          code: '#VIAJE-7721',
          customerName: 'Carlos Mendivelso',
          customerPhone: '3124567890',
          pickupAddress: 'Aguas calientes calle 3 (Bodega JL)',
          dropoffAddress: 'Barrio Simón Bolívar, Manzana C Casa 14',
          price: 6000,
          km: 2.4,
          notes: 'Llevar 2 bolsas de mercado con cuidado.',
          paymentMethod: 'cash',
          status: 'available',
          createdAt: today,
          storeSlug: 'bodega-jl'
        }
      }
    ];
  }
};
