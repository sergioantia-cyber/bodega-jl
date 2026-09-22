import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DollarSign, Send, MapPin, Navigation, Phone, MessageSquare,
  Lock, LogOut, CheckCircle2, ExternalLink, Calendar, X, ChevronRight
} from 'lucide-react';
import { TactileCard } from './ui/TactileCard';
import { TactileButton } from './ui/TactileButton';
import { deliveryService } from '../services/deliveryService';
import { VehicleRideRequest, DeliveryChatMessage, DeliveryDailyFinance, RideStatus } from '../types';
import { soundService } from '../services/soundService';

interface DeliveryDashboardViewProps {
  onLogout: () => void;
  onOpenNewRideModal: () => void;
}

export const DeliveryDashboardView: React.FC<DeliveryDashboardViewProps> = ({
  onLogout,
  onOpenNewRideModal
}) => {
  const driver = deliveryService.getDriverProfile(); // { name: 'Yoxman', isNameLocked: true }
  const [activeTab, setActiveTab] = useState<'finance' | 'group_chat'>('group_chat');
  const [rides, setRides] = useState<VehicleRideRequest[]>(() => deliveryService.getRides());
  const [groupMessages, setGroupMessages] = useState<DeliveryChatMessage[]>(() => deliveryService.getGroupMessages());
  const [chatInput, setChatInput] = useState('');
  const [selectedRide, setSelectedRide] = useState<VehicleRideRequest | null>(null);
  const [rideChatInput, setRideChatInput] = useState('');
  const [rideMessages, setRideMessages] = useState<DeliveryChatMessage[]>([]);
  const [filterRides, setFilterRides] = useState<'all' | 'pending' | 'completed'>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const rideChatEndRef = useRef<HTMLDivElement>(null);

  // Sincronización en tiempo real
  useEffect(() => {
    const refreshData = () => {
      setRides(deliveryService.getRides());
      setGroupMessages(deliveryService.getGroupMessages());
    };

    const unsubscribe = deliveryService.subscribe(refreshData);
    return () => unsubscribe();
  }, []);

  // Actualizar mensajes del chat privado si hay un servicio seleccionado
  useEffect(() => {
    if (selectedRide) {
      setRideMessages(deliveryService.getRideChatMessages(selectedRide.id));

      const handleRideChat = () => {
        setRideMessages(deliveryService.getRideChatMessages(selectedRide.id));
      };

      window.addEventListener(`bogad_ride_chat_${selectedRide.id}_updated`, handleRideChat);
      return () => {
        window.removeEventListener(`bogad_ride_chat_${selectedRide.id}_updated`, handleRideChat);
      };
    }
  }, [selectedRide]);

  // Auto-scroll al final del chat grupal
  useEffect(() => {
    if (activeTab === 'group_chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupMessages, activeTab]);

  // Auto-scroll al final del chat del servicio
  useEffect(() => {
    if (selectedRide) {
      rideChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rideMessages, selectedRide]);

  // Finanzas del día calculadas dinámicamente
  const finances: DeliveryDailyFinance = useMemo(() => {
    return deliveryService.getDailyFinances();
  }, [rides]);

  // Carreras del día filtradas
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRides = useMemo(() => {
    return rides.filter(r => {
      const d = (r.createdAt || '').split('T')[0];
      return d === todayStr;
    });
  }, [rides, todayStr]);

  const displayedRides = useMemo(() => {
    if (filterRides === 'pending') {
      return todayRides.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
    }
    if (filterRides === 'completed') {
      return todayRides.filter(r => r.status === 'completed');
    }
    return todayRides;
  }, [todayRides, filterRides]);

  // Cantidad de servicios disponibles para tomar
  const availableRidesCount = useMemo(() => {
    return rides.filter(r => r.status === 'available').length;
  }, [rides]);

  // Enviar mensaje al Chat Grupal
  const handleSendGroupMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    deliveryService.sendGroupMessage(chatInput, driver.name, 'driver');
    setChatInput('');
    soundService.playPop();
  };

  // Enviar mensaje en Chat Privado con Cliente
  const handleSendRideMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rideChatInput.trim() || !selectedRide) return;

    deliveryService.sendRideChatMessage(selectedRide.id, rideChatInput, driver.name, 'driver');
    setRideChatInput('');
    soundService.playPop();
  };

  // Tomar un servicio desde el chat grupal o lista
  const handleTakeService = (ride: VehicleRideRequest) => {
    const updated = deliveryService.takeRide(ride.id, driver.id, driver.name);
    if (updated) {
      setRides(deliveryService.getRides());
      setSelectedRide(updated);
    }
  };

  // Cambiar estado del servicio
  const handleStatusChange = (status: RideStatus) => {
    if (!selectedRide) return;
    const updated = deliveryService.updateRideStatus(selectedRide.id, status);
    if (updated) {
      setSelectedRide(updated);
      setRides(deliveryService.getRides());
    }
  };

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-200">
      {/* Barra Superior del Domiciliario */}
      <TactileCard variant="yellow" className="p-4 border-2 border-slate-950 shadow-tactile">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-950 shadow-tactile flex items-center justify-center shrink-0">
              <span className="text-2xl">🛵</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-950 tracking-tight">
                  {driver.name}
                </h2>
                <div
                  title="Nombre fijo asignado en la cuenta registrada de Pedigochos"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 text-white text-[10px] font-black uppercase"
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span>Nombre Fijo</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-slate-950" />
                <span className="text-xs font-bold text-slate-800">
                  En Turno Activo • Red Pedigochos
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <TactileButton
              variant="lime"
              size="sm"
              onClick={onOpenNewRideModal}
              className="flex items-center gap-1 font-black text-xs"
            >
              <span>+ Solicitar Vehículo 🛵</span>
            </TactileButton>

            <TactileButton
              variant="coral"
              size="sm"
              onClick={onLogout}
              className="flex items-center gap-1 font-black text-xs"
            >
              <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Cerrar Turno</span>
            </TactileButton>
          </div>
        </div>

        {/* Selector de Pestañas Principales */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t-2 border-slate-950 mt-3">
          <button
            onClick={() => setActiveTab('group_chat')}
            className={`py-2 px-3 rounded-xl border-2 border-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'group_chat'
                ? 'bg-slate-950 text-white shadow-tactile'
                : 'bg-white text-slate-900 hover:bg-slate-100 shadow-tactile-sm'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Grupal</span>
            {availableRidesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-bogad-lime text-slate-950 text-[10px] font-black animate-bounce">
                {availableRidesCount} Disp.
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`py-2 px-3 rounded-xl border-2 border-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'finance'
                ? 'bg-slate-950 text-white shadow-tactile'
                : 'bg-white text-slate-900 hover:bg-slate-100 shadow-tactile-sm'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Domicilios del Día ({todayRides.length})</span>
          </button>
        </div>
      </TactileCard>

      {/* ============================================================== */}
      {/* PESTAÑA 1: CHAT GRUPAL DE DOMICILIARIOS CON TARJETAS CLICKEABLES */}
      {/* ============================================================== */}
      {activeTab === 'group_chat' && (
        <div className="space-y-3">
          {/* Banner de Estado en Vivo */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900 text-white rounded-xl border-2 border-slate-950 shadow-tactile-sm text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Canal Oficial de Domiciliarios Pedigochos</span>
            </div>
            <span className="text-[10px] text-amber-300 font-mono">EN VIVO</span>
          </div>

          {/* Caja del Chat Grupal */}
          <TactileCard variant="default" className="p-3 sm:p-4 border-2 border-slate-950 shadow-tactile space-y-3">
            <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 no-scrollbar">
              {groupMessages.map((msg) => {
                const isMe = msg.senderId === driver.id;

                // Tarjeta de Servicio Clickeable
                if (msg.isServiceCard && msg.rideData) {
                  const ride = rides.find(r => r.id === msg.rideData!.id) || msg.rideData;
                  const isAvailable = ride.status === 'available';
                  const isMine = ride.driverId === driver.id;

                  return (
                    <div
                      key={msg.id}
                      className="my-3 p-3.5 rounded-2xl border-3 border-slate-950 bg-amber-50 shadow-tactile space-y-2.5 animate-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-400 border border-slate-950 text-slate-950 uppercase tracking-wider">
                          🛵 Solicitud de Vehículo
                        </span>
                        <span className="text-xs font-mono font-black text-slate-900">
                          {ride.code}
                        </span>
                      </div>

                      {/* Detalles Clave Destacados: PRECIO, KM, RECOGIDA, DESTINO */}
                      <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border-2 border-slate-950 shadow-tactile-sm">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black text-slate-500 uppercase">
                            💰 Valor Carrera
                          </span>
                          <div className="text-lg font-black text-emerald-700 leading-none">
                            ${ride.price.toLocaleString()}
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">
                            {ride.paymentMethod === 'cash' ? '💵 Efectivo' : '📲 Digital / Nequi'}
                          </span>
                        </div>

                        <div className="space-y-0.5 text-right">
                          <span className="text-[10px] font-black text-slate-500 uppercase">
                            📏 Distancia
                          </span>
                          <div className="text-lg font-black text-blue-700 leading-none">
                            {ride.km} KM
                          </div>
                          <span className="text-[10px] font-bold text-slate-600">
                            Estimada
                          </span>
                        </div>
                      </div>

                      {/* Puntos de Recogida y Destino */}
                      <div className="space-y-1.5 text-xs font-bold text-slate-900 bg-white p-2.5 rounded-xl border-2 border-slate-950">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 stroke-[2.5]" />
                          <div>
                            <span className="text-[10px] font-black text-emerald-700 uppercase block">
                              Dónde se recoge:
                            </span>
                            <span>{ride.pickupAddress}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-1.5 pt-1 border-t border-slate-200">
                          <Navigation className="w-4 h-4 text-bogad-coral shrink-0 mt-0.5 stroke-[2.5]" />
                          <div>
                            <span className="text-[10px] font-black text-bogad-coral uppercase block">
                              Destino final:
                            </span>
                            <span>{ride.dropoffAddress}</span>
                          </div>
                        </div>

                        {ride.notes && (
                          <div className="pt-1 text-[11px] text-slate-600 italic">
                            📝 {ride.notes}
                          </div>
                        )}
                      </div>

                      {/* Botón Clickeable para Tomar el Servicio */}
                      <div className="pt-1">
                        {isAvailable ? (
                          <TactileButton
                            variant="lime"
                            size="md"
                            fullWidth
                            onClick={() => handleTakeService(ride)}
                            className="flex items-center justify-center gap-2 font-black text-sm uppercase shadow-tactile animate-pulse"
                          >
                            <span>Tomar Servicio Ahora ⚡</span>
                            <ChevronRight className="w-4 h-4 stroke-[3]" />
                          </TactileButton>
                        ) : isMine ? (
                          <TactileButton
                            variant="primary"
                            size="sm"
                            fullWidth
                            onClick={() => setSelectedRide(ride)}
                            className="flex items-center justify-center gap-1.5 font-black text-xs uppercase shadow-tactile"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
                            <span>Servicio Tomado por Ti (Abrir Chat y Detalle) 💬</span>
                          </TactileButton>
                        ) : (
                          <div className="text-center py-1.5 px-2 bg-slate-200 border-2 border-slate-950 rounded-xl text-xs font-black text-slate-700">
                            🔒 Tomado por {ride.driverName || 'otro repartidor'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Mensajes de texto normales
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-0.5`}
                  >
                    <span className="text-[10px] font-black text-slate-600 px-1">
                      {msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div
                      className={`max-w-[85%] px-3.5 py-2 rounded-2xl border-2 border-slate-950 shadow-tactile-sm text-xs font-bold ${
                        isMe
                          ? 'bg-bogad-lime text-slate-950 rounded-br-none'
                          : msg.senderRole === 'system'
                          ? 'bg-amber-100 text-slate-950 border-amber-950 font-black'
                          : 'bg-white text-slate-950 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Envío de Mensaje al Grupo */}
            <form onSubmit={handleSendGroupMessage} className="flex gap-2 pt-2 border-t-2 border-slate-950">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe al grupo de domiciliarios..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border-2 border-slate-950 rounded-xl text-xs font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 shadow-tactile-sm"
              />
              <TactileButton
                type="submit"
                variant="dark"
                size="sm"
                className="flex items-center justify-center gap-1 font-black px-4"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </TactileButton>
            </form>
          </TactileCard>
        </div>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA 2: TABLA DE DOMICILIOS DEL DÍA Y DETALLES DE DINERO */}
      {/* ============================================================== */}
      {activeTab === 'finance' && (
        <div className="space-y-4">
          {/* Tarjetas de Resumen Financiero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <TactileCard variant="lime" className="p-3 border-2 border-slate-950 shadow-tactile space-y-0.5">
              <span className="text-[10px] font-black text-slate-800 uppercase block">
                💵 Ganancia de Hoy
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-950">
                ${finances.totalEarnings.toLocaleString()}
              </div>
              <span className="text-[10px] font-bold text-slate-700">
                {finances.completedRidesCount} carreras cerradas
              </span>
            </TactileCard>

            <TactileCard variant="yellow" className="p-3 border-2 border-slate-950 shadow-tactile space-y-0.5">
              <span className="text-[10px] font-black text-slate-800 uppercase block">
                💰 Efectivo en Mano
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-950">
                ${finances.cashCollected.toLocaleString()}
              </div>
              <span className="text-[10px] font-bold text-slate-700">
                Por liquidar
              </span>
            </TactileCard>

            <TactileCard variant="default" className="p-3 border-2 border-slate-950 shadow-tactile space-y-0.5">
              <span className="text-[10px] font-black text-slate-800 uppercase block">
                📲 Pagos Digitales
              </span>
              <div className="text-xl sm:text-2xl font-black text-blue-700">
                ${finances.digitalCollected.toLocaleString()}
              </div>
              <span className="text-[10px] font-bold text-slate-700">
                Nequi / Bancos
              </span>
            </TactileCard>

            <TactileCard variant="coral" className="p-3 border-2 border-slate-950 shadow-tactile space-y-0.5">
              <span className="text-[10px] font-black text-white uppercase block">
                🛵 Total Pedidos
              </span>
              <div className="text-xl sm:text-2xl font-black text-white">
                {todayRides.length}
              </div>
              <span className="text-[10px] font-bold text-white/90">
                Registrados hoy
              </span>
            </TactileCard>
          </div>

          {/* Filtros de la Tabla */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-950 uppercase flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span>Tabla de Domicilios del Día ({todayStr})</span>
            </h3>

            <div className="flex items-center gap-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'pending', label: 'Pendientes' },
                { id: 'completed', label: 'Completados' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterRides(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg border-2 border-slate-950 text-[11px] font-black transition-transform active:translate-y-0.5 ${
                    filterRides === f.id
                      ? 'bg-slate-950 text-white shadow-tactile-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 shadow-tactile-sm'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Domicilios */}
          {displayedRides.length === 0 ? (
            <TactileCard variant="default" className="p-8 text-center border-2 border-slate-950 space-y-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-black text-slate-900">
                No hay domicilios para este filtro hoy.
              </p>
              <p className="text-xs font-semibold text-slate-600">
                Las carreras tomadas aparecerán aquí con sus detalles de dinero y cliente.
              </p>
            </TactileCard>
          ) : (
            <div className="space-y-2.5">
              {displayedRides.map((ride) => {
                const isMine = ride.driverId === driver.id;

                return (
                  <TactileCard
                    key={ride.id}
                    variant="default"
                    className="p-3.5 border-2 border-slate-950 shadow-tactile space-y-2 hover:border-slate-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-950 bg-amber-100 px-1.5 py-0.5 rounded border border-slate-950">
                            {ride.code}
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMine && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-bogad-lime text-slate-950 border border-slate-950">
                              Asignado a ti
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-black text-slate-950">
                          {ride.customerName} • 📞 {ride.customerPhone}
                        </h4>
                      </div>

                      {/* Precio */}
                      <div className="text-right shrink-0">
                        <div className="text-base font-black text-emerald-700">
                          ${ride.price.toLocaleString()}
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase">
                          {ride.paymentMethod === 'cash' ? '💵 Efectivo' : '📲 Digital'}
                        </span>
                      </div>
                    </div>

                    {/* Direcciones */}
                    <div className="text-xs font-bold text-slate-800 space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-300">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Recoge: {ride.pickupAddress}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Navigation className="w-3.5 h-3.5 text-bogad-coral shrink-0" />
                        <span className="truncate">Entrega: {ride.dropoffAddress} ({ride.km} km)</span>
                      </div>
                    </div>

                    {/* Estado y Botón de Acción */}
                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-950 uppercase ${
                        ride.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-900'
                          : ride.status === 'in_transit'
                          ? 'bg-blue-100 text-blue-900'
                          : ride.status === 'arrived_pickup'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-900'
                      }`}>
                        {ride.status === 'completed' ? '✅ Completado'
                          : ride.status === 'in_transit' ? '🛵 En Camino'
                          : ride.status === 'arrived_pickup' ? '📍 En Recogida'
                          : ride.status === 'taken' ? '⚡ Tomado'
                          : 'Disponible'}
                      </span>

                      <TactileButton
                        variant="dark"
                        size="sm"
                        onClick={() => setSelectedRide(ride)}
                        className="flex items-center gap-1 font-black text-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Abrir Chat & Detalle</span>
                      </TactileButton>
                    </div>
                  </TactileCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL / CHAT PRIVADO DEL SERVICIO Y DETALLES DEL CLIENTE */}
      {/* ============================================================== */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <TactileCard
            variant="default"
            className="w-full max-w-lg p-5 space-y-4 border-4 border-slate-950 shadow-tactile-lg relative my-auto max-h-[90vh] flex flex-col"
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b-2 border-slate-950 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-amber-400 border border-slate-950 text-slate-950">
                    {selectedRide.code}
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    Detalle & Chat del Cliente
                  </span>
                </div>
                <div className="text-lg font-black text-slate-950 mt-0.5">
                  {selectedRide.customerName}
                </div>
              </div>

              <button
                onClick={() => setSelectedRide(null)}
                className="p-1.5 rounded-lg border-2 border-slate-950 bg-slate-100 hover:bg-slate-200 text-slate-950 shadow-tactile-sm transition-transform active:translate-y-0.5"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            {/* Contenido scrolleable */}
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 no-scrollbar">
              {/* Resumen Financiero y Cobro */}
              <div className="grid grid-cols-2 gap-2 bg-emerald-50 p-3 rounded-xl border-2 border-slate-950 shadow-tactile-sm">
                <div>
                  <span className="text-[10px] font-black text-slate-600 uppercase">
                    Valor a Cobrar
                  </span>
                  <div className="text-xl font-black text-emerald-800">
                    ${selectedRide.price.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-600 uppercase">
                    Método de Pago
                  </span>
                  <div className="text-sm font-black text-slate-900 uppercase">
                    {selectedRide.paymentMethod === 'cash' ? '💵 Efectivo' : '📲 Digital / Nequi'}
                  </div>
                </div>
              </div>

              {/* Botones de Contacto Directo */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`tel:${selectedRide.customerPhone}`}
                  className="py-2 px-3 rounded-xl border-2 border-slate-950 bg-white hover:bg-slate-50 font-black text-xs text-slate-950 flex items-center justify-center gap-1.5 shadow-tactile-sm transition-transform active:translate-y-0.5"
                >
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>Llamar al Cliente</span>
                </a>

                <a
                  href={`https://wa.me/${selectedRide.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${selectedRide.customerName}, soy tu domiciliario de Pedigochos sobre el servicio ${selectedRide.code}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 rounded-xl border-2 border-slate-950 bg-emerald-500 hover:bg-emerald-400 font-black text-xs text-white flex items-center justify-center gap-1.5 shadow-tactile-sm transition-transform active:translate-y-0.5"
                >
                  <span>WhatsApp Directo 💬</span>
                </a>
              </div>

              {/* Direcciones y GPS */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border-2 border-slate-950 text-xs font-bold text-slate-900">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-700 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Lugar de Recogida:</span>
                  </span>
                  <p className="pl-4">{selectedRide.pickupAddress}</p>
                </div>

                <div className="space-y-1 pt-1.5 border-t border-slate-200">
                  <span className="text-[10px] font-black text-bogad-coral uppercase flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Destino de Entrega ({selectedRide.km} km):</span>
                  </span>
                  <p className="pl-4">{selectedRide.dropoffAddress}</p>
                </div>

                {selectedRide.notes && (
                  <div className="pt-1.5 border-t border-slate-200 text-slate-600 text-[11px] italic">
                    📝 {selectedRide.notes}
                  </div>
                )}

                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(selectedRide.pickupAddress)}&destination=${encodeURIComponent(selectedRide.dropoffAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-blue-700 hover:underline"
                >
                  <span>Ver Ruta en Google Maps con GPS</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Control de Progreso de la Carrera */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-black text-slate-800 uppercase block">
                  Actualizar Estado de la Carrera
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => handleStatusChange('arrived_pickup')}
                    className={`py-2 px-1 rounded-xl border-2 border-slate-950 font-black text-[11px] text-center transition-all ${
                      selectedRide.status === 'arrived_pickup'
                        ? 'bg-amber-400 text-slate-950 shadow-tactile'
                        : 'bg-white hover:bg-slate-100 shadow-tactile-sm'
                    }`}
                  >
                    📍 En Recogida
                  </button>

                  <button
                    onClick={() => handleStatusChange('in_transit')}
                    className={`py-2 px-1 rounded-xl border-2 border-slate-950 font-black text-[11px] text-center transition-all ${
                      selectedRide.status === 'in_transit'
                        ? 'bg-blue-400 text-slate-950 shadow-tactile'
                        : 'bg-white hover:bg-slate-100 shadow-tactile-sm'
                    }`}
                  >
                    🛵 En Camino
                  </button>

                  <button
                    onClick={() => handleStatusChange('completed')}
                    className={`py-2 px-1 rounded-xl border-2 border-slate-950 font-black text-[11px] text-center transition-all ${
                      selectedRide.status === 'completed'
                        ? 'bg-emerald-500 text-white shadow-tactile'
                        : 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200 shadow-tactile-sm'
                    }`}
                  >
                    ✅ Entregado
                  </button>
                </div>
              </div>

              {/* Chat Privado del Servicio */}
              <div className="space-y-2 pt-2 border-t-2 border-slate-950">
                <h5 className="text-xs font-black text-slate-950 uppercase flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Mensajes de Entrega</span>
                </h5>

                <div className="max-h-44 overflow-y-auto space-y-2 p-2.5 bg-slate-100 rounded-xl border-2 border-slate-950 text-xs">
                  {rideMessages.length === 0 ? (
                    <p className="text-slate-500 text-center font-bold text-[11px] py-2">
                      Inicia el chat para coordinar la entrega con el cliente.
                    </p>
                  ) : (
                    rideMessages.map(m => {
                      const isMe = m.senderRole === 'driver';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-0.5`}
                        >
                          <span className="text-[9px] font-bold text-slate-500">
                            {m.senderName}
                          </span>
                          <div
                            className={`px-3 py-1.5 rounded-xl border border-slate-950 text-xs font-bold ${
                              isMe ? 'bg-bogad-lime text-slate-950' : 'bg-white text-slate-950'
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={rideChatEndRef} />
                </div>

                <form onSubmit={handleSendRideMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={rideChatInput}
                    onChange={(e) => setRideChatInput(e.target.value)}
                    placeholder="Enviar mensaje al cliente..."
                    className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl text-xs font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 shadow-tactile-sm"
                  />
                  <TactileButton
                    type="submit"
                    variant="dark"
                    size="sm"
                    className="px-3"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </TactileButton>
                </form>
              </div>
            </div>
          </TactileCard>
        </div>
      )}
    </div>
  );
};
