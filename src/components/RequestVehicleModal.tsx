import React, { useState } from 'react';
import { X, Bike, MapPin, Navigation, DollarSign, User, Phone, FileText, CheckCircle2 } from 'lucide-react';
import { TactileCard } from './ui/TactileCard';
import { TactileButton } from './ui/TactileButton';
import { deliveryService } from '../services/deliveryService';
import { StoreProfile } from '../types';

interface RequestVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeProfile: StoreProfile;
  onSuccess?: () => void;
}

export const RequestVehicleModal: React.FC<RequestVehicleModalProps> = ({
  isOpen,
  onClose,
  storeProfile,
  onSuccess
}) => {
  const [pickupAddress, setPickupAddress] = useState(storeProfile.address || 'Aguas calientes calle 3');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [km, setKm] = useState('2.5');
  const [price, setPrice] = useState('6000');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'nequi' | 'transfer'>('cash');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  // Actualizar precio estimado automáticamente cuando cambia el kilometraje
  const handleKmChange = (val: string) => {
    setKm(val);
    const numKm = parseFloat(val);
    if (!isNaN(numKm) && numKm > 0) {
      // Tarifa base $4.000 + $1.200 por km adicional
      const calculated = Math.max(5000, Math.round(4000 + (numKm * 1200)));
      setPrice(String(calculated));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      alert('Por favor indica el lugar de recogida y el destino.');
      return;
    }

    deliveryService.createRideRequest({
      pickupAddress: pickupAddress.trim(),
      dropoffAddress: dropoffAddress.trim(),
      km: parseFloat(km) || 1.0,
      price: parseFloat(price) || 5000,
      customerName: customerName.trim() || 'Cliente Particular',
      customerPhone: customerPhone.trim() || storeProfile.phoneDisplay || 'Sin número',
      notes: notes.trim(),
      paymentMethod,
      storeSlug: storeProfile.slug || 'bodega-jl'
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      if (onSuccess) onSuccess();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <TactileCard
        variant="default"
        className="w-full max-w-lg p-5 sm:p-6 space-y-4 border-4 border-slate-950 shadow-tactile-lg relative my-auto"
      >
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border-2 border-slate-950 bg-slate-100 hover:bg-slate-200 text-slate-950 shadow-tactile-sm transition-transform active:translate-y-0.5"
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>

        {/* Cabecera */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-bogad-lime border-2 border-slate-950 shadow-tactile flex items-center justify-center shrink-0">
            <Bike className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 border border-slate-950 text-[10px] font-black uppercase text-slate-950">
              <span>Pedigochos Express</span>
            </div>
            <h3 className="text-lg font-black text-slate-950 leading-tight">
              Solicitar Vehículo / Carrera 🛵
            </h3>
            <p className="text-xs font-bold text-slate-600">
              Se enviará de inmediato al Chat Grupal de Domiciliarios
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto stroke-[2.5]" />
            <h4 className="text-xl font-black text-slate-950">
              ¡Solicitud Enviada al Chat Grupal!
            </h4>
            <p className="text-xs font-bold text-slate-600 max-w-xs mx-auto">
              Los domiciliarios activos han recibido la tarjeta con el precio, km y mapa para tomar tu servicio al instante.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-left">
            {/* Origen y Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1 text-emerald-700">
                  <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Dónde se recoge *</span>
                </label>
                <input
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Dirección del local o casa..."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl text-xs font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-tactile-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1 text-bogad-coral">
                  <Navigation className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Destino de entrega *</span>
                </label>
                <input
                  type="text"
                  required
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  placeholder="Calle, Barrio, Casa o Apto..."
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl text-xs font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-bogad-coral shadow-tactile-sm"
                />
              </div>
            </div>

            {/* Kilómetros y Precio */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 border-2 border-slate-950 rounded-xl">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1">
                  <span>Distancia (KM)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={km}
                    onChange={(e) => handleKmChange(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-white border-2 border-slate-950 rounded-lg text-sm font-black text-slate-950 shadow-tactile-sm"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">
                    km
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1 text-emerald-800">
                  <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Valor Carrera ($)</span>
                </label>
                <input
                  type="number"
                  step="100"
                  min="1000"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-950 rounded-lg text-sm font-black text-emerald-700 shadow-tactile-sm"
                />
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Nombre de contacto</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej: Doña Carmen"
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl text-xs font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950 shadow-tactile-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Teléfono para llamar</span>
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="300 123 4567"
                  className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl text-xs font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950 shadow-tactile-sm"
                />
              </div>
            </div>

            {/* Método de pago */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-950 uppercase">
                Método de Pago del Domicilio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: '💵 Efectivo' },
                  { id: 'nequi', label: '📲 Nequi' },
                  { id: 'transfer', label: '🏦 Transf.' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-1 text-center rounded-xl border-2 border-slate-950 text-xs font-black transition-all ${
                      paymentMethod === m.id
                        ? 'bg-bogad-yellow text-slate-950 shadow-tactile scale-[1.02]'
                        : 'bg-white text-slate-700 hover:bg-slate-100 shadow-tactile-sm'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Indicaciones del paquete / Notas</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Tocar timbre de reja blanca, paquete frágil o cambio de $20.000..."
                className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-950 rounded-xl text-xs font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 shadow-tactile-sm resize-none"
              />
            </div>

            {/* Botón de Envío */}
            <div className="pt-2">
              <TactileButton
                type="submit"
                variant="lime"
                size="lg"
                fullWidth
                className="flex items-center justify-center gap-2 font-black text-sm uppercase shadow-tactile"
              >
                <Bike className="w-5 h-5 stroke-[2.5]" />
                <span>Enviar al Chat Grupal de Domiciliarios 🚀</span>
              </TactileButton>
            </div>
          </form>
        )}
      </TactileCard>
    </div>
  );
};
