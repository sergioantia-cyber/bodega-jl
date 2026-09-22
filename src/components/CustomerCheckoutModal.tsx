import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, MapPin, CheckCircle2, AlertCircle, Send, Loader2, ExternalLink, Copy, Check, Banknote, Store, Truck, Camera, Upload, Trash2 } from 'lucide-react';
import { CartItem, CustomerOrder, GPSLocation, PaymentMethodKey, OrderDeliveryType, StoreProfile } from '../types';
import { TactileCard } from './ui/TactileCard';
import { TactileButton } from './ui/TactileButton';
import { orderDispatchService } from '../services/orderDispatchService';
import { storageService } from '../services/storageService';
import { soundService } from '../services/soundService';
import { PaymentQRModal } from './PaymentQRModal';

// Helper para comprimir la imagen del comprobante a ~40-70KB y evitar QuotaExceededError en localStorage
const compressReceiptImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el procesador de imágenes'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Error al decodificar la imagen'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
  });
};

interface CustomerCheckoutModalProps {
  isOpen: boolean;
  items: CartItem[];
  totalPrice: number;
  onClose: () => void;
  onOrderCompleted: (order: CustomerOrder) => void;
  storeProfile?: StoreProfile;
  onOpenTerms?: () => void;
}

export const CustomerCheckoutModal: React.FC<CustomerCheckoutModalProps> = ({
  isOpen,
  items,
  totalPrice,
  onClose,
  onOrderCompleted,
  storeProfile: propStoreProfile,
  onOpenTerms
}) => {
  const [internalProfile, setInternalProfile] = useState<StoreProfile>(() =>
    propStoreProfile || storageService.getStoreProfile()
  );

  useEffect(() => {
    if (propStoreProfile) {
      setInternalProfile(propStoreProfile);
    }
  }, [propStoreProfile]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      setInternalProfile(storageService.getStoreProfile());
    };
    window.addEventListener('bogad_store_profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('bogad_store_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, []);

  const storeProfile = propStoreProfile || internalProfile;
  const payments = storeProfile.payments;
  const currencySymbol = storeProfile.currencySymbol || '$';

  // Modalidad: Delivery o Retiro en Local
  const [deliveryType, setDeliveryType] = useState<OrderDeliveryType>('delivery');
  const storeDeliveryFee = storeProfile.deliveryFee ?? 2.00;
  const activeDeliveryFee = deliveryType === 'delivery' ? storeDeliveryFee : 0;
  const subtotal = totalPrice;
  const grandTotal = subtotal + activeDeliveryFee;

  // Métodos de pago disponibles según configuración del dueño
  const availableMethods = useMemo(() => {
    const list: { id: PaymentMethodKey; label: string; flag: string; color: string }[] = [];

    // Colombia
    if (payments?.colombia?.nequi?.enabled) {
      list.push({ id: 'nequi', label: 'Nequi', flag: '🇨🇴', color: 'bg-purple-700 text-white' });
    }
    if (payments?.colombia?.bancolombia?.enabled) {
      list.push({ id: 'bancolombia', label: 'Bancolombia', flag: '🇨🇴', color: 'bg-amber-400 text-slate-950' });
    }

    // Venezuela
    if (payments?.venezuela?.bdv?.enabled) {
      list.push({ id: 'bdv', label: 'BDV Pago Móvil', flag: '🇻🇪', color: 'bg-red-700 text-white' });
    }
    if (payments?.venezuela?.banesco?.enabled) {
      list.push({ id: 'banesco', label: 'Banesco', flag: '🇻🇪', color: 'bg-emerald-700 text-white' });
    }
    if (payments?.venezuela?.bnc?.enabled) {
      list.push({ id: 'bnc', label: 'BNC', flag: '🇻🇪', color: 'bg-blue-800 text-white' });
    }

    // Efectivo
    if (payments?.cash?.enabled) {
      list.push({ id: 'cash', label: 'Efectivo', flag: '💵', color: 'bg-bogad-lime text-slate-950' });
    }

    return list;
  }, [payments]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>(availableMethods[0]?.id || 'cash');
  const [showQRModal, setShowQRModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Auto-switch paymentMethod si el método seleccionado fue deshabilitado
  useEffect(() => {
    if (availableMethods.length > 0) {
      const isCurrentValid = availableMethods.some((m) => m.id === paymentMethod);
      if (!isCurrentValid) {
        setPaymentMethod(availableMethods[0].id);
      }
    }
  }, [availableMethods, paymentMethod]);

  // Estado Comprobante de Pago (OBLIGATORIO)
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [isCompressingReceipt, setIsCompressingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setReceiptError('Por favor selecciona una imagen válida (JPG, PNG).');
      soundService.playWarning();
      return;
    }

    setIsCompressingReceipt(true);
    setReceiptError(null);
    try {
      const compressed = await compressReceiptImage(file);
      setPaymentReceipt(compressed);
      soundService.playBeep();
    } catch (err: unknown) {
      setReceiptError('Error al procesar la imagen del comprobante');
      soundService.playWarning();
    } finally {
      setIsCompressingReceipt(false);
    }
  };

  // Estado GPS obligatorio
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    soundService.playPop();
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCaptureGPS = async () => {
    setIsCapturingGPS(true);
    setGpsError(null);
    try {
      const location = await orderDispatchService.captureGPS();
      setGpsLocation(location);
      soundService.playBeep();
    } catch (err: unknown) {
      setGpsError(err instanceof Error ? err.message : 'Error al obtener GPS');
      soundService.playWarning();
    } finally {
      setIsCapturingGPS(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      return;
    }

    if (availableMethods.length === 0) {
      soundService.playWarning();
      return;
    }

    if (deliveryType === 'delivery' && (!address.trim() || !gpsLocation)) {
      soundService.playWarning();
      return;
    }

    // Validación estricta: NO dejar avanzar sin comprobante de pago
    if (!paymentReceipt) {
      setReceiptError('Debes adjuntar el comprobante de pago para poder continuar');
      soundService.playWarning();
      return;
    }

    const effectiveAddress = deliveryType === 'delivery'
      ? address.trim()
      : (address.trim() || `Retiro en Tienda (${storeProfile.name})`);

    const effectiveGps: GPSLocation = gpsLocation || {
      lat: 0,
      lng: 0,
      mapsUrl: ''
    };

    const newOrder = orderDispatchService.createOrder({
      customerName: name.trim(),
      customerPhone: phone.trim(),
      address: effectiveAddress,
      gpsLocation: effectiveGps,
      referenceNotes: reference.trim() || undefined,
      items: [...items],
      subtotal: subtotal,
      deliveryFee: activeDeliveryFee,
      deliveryType: deliveryType,
      total: grandTotal,
      paymentMethod,
      storeId: storeProfile.slug,
      paymentReceipt: paymentReceipt
    }, storeProfile.slug);

    soundService.playSuccessChime();

    // Abrir WhatsApp con el pedido formateado
    const waUrl = orderDispatchService.generateWhatsAppLink(newOrder);
    window.open(waUrl, '_blank');

    onOrderCompleted(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-md my-auto max-h-[94vh] overflow-y-auto">
        <TactileCard variant="yellow" className="relative p-4 sm:p-5 shadow-tactile-lg border-2 border-slate-950">
          {/* Botón cerrar */}
          <button
            onClick={onClose}
            aria-label="Cerrar pedido"
            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-950 border-2 border-slate-950 shadow-tactile-sm flex items-center justify-center font-black active:translate-y-0.5"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Encabezado */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white border-2 border-slate-950 shadow-tactile-sm flex items-center justify-center text-lg">
              <span>{storeProfile.iconEmoji || '🏪'}</span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950 leading-tight">
                {deliveryType === 'delivery' ? 'Datos de Entrega a Domicilio' : 'Datos para Retiro en Tienda'}
              </h3>
              <p className="text-xs font-bold text-slate-800">
                Total del pedido: <strong className="text-sm font-black">{currencySymbol}{grandTotal.toFixed(2)}</strong>
              </p>
            </div>
          </div>

          {/* Selector de Medio: Delivery vs Retiro en Local */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setDeliveryType('delivery');
                soundService.playPop();
              }}
              className={`py-2 px-3 rounded-xl border-2 border-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:translate-y-0.5 ${
                deliveryType === 'delivery'
                  ? 'bg-bogad-coral text-white shadow-tactile'
                  : 'bg-white text-slate-800 opacity-80 hover:opacity-100 shadow-tactile-sm'
              }`}
            >
              <Truck className="w-4 h-4 stroke-[2.5]" />
              <span>🛵 A Domicilio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeliveryType('local');
                soundService.playPop();
              }}
              className={`py-2 px-3 rounded-xl border-2 border-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:translate-y-0.5 ${
                deliveryType === 'local'
                  ? 'bg-bogad-lime text-slate-950 shadow-tactile'
                  : 'bg-white text-slate-800 opacity-80 hover:opacity-100 shadow-tactile-sm'
              }`}
            >
              <Store className="w-4 h-4 stroke-[2.5]" />
              <span>🏪 Retiro en Local</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 bg-white/95 dark:bg-slate-900/95 p-3.5 rounded-xl border-2 border-slate-950 shadow-tactile-sm">
            {/* Nombre y Celular */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Tu Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Juan Gómez"
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 rounded-lg text-slate-900 dark:text-white shadow-tactile-sm focus:outline-none focus:ring-2 focus:ring-bogad-yellow"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Tu Teléfono *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 300 123 4567"
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 rounded-lg text-slate-900 dark:text-white shadow-tactile-sm focus:outline-none focus:ring-2 focus:ring-bogad-yellow"
                />
              </div>
            </div>

            {deliveryType === 'delivery' ? (
              <>
                {/* Dirección */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Dirección Escrita / Casa / Apto *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej. Carrera 15 # 45-20, Apto 302"
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 rounded-lg text-slate-900 dark:text-white shadow-tactile-sm focus:outline-none focus:ring-2 focus:ring-bogad-yellow"
                  />
                </div>

                {/* Módulo GPS OBLIGATORIO */}
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border-2 border-slate-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-black text-xs text-slate-900 dark:text-white">
                      <MapPin className="w-3.5 h-3.5 text-bogad-coral" />
                      <span>Ubicación GPS Exacta *</span>
                    </div>
                    {gpsLocation && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-bogad-lime border border-slate-900 rounded shadow-tactile-sm text-slate-950 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-800 stroke-[3]" />
                        <span>GPS Fijado</span>
                      </span>
                    )}
                  </div>

                  {!gpsLocation ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-tight">
                        Para que el repartidor llegue directo a tu puerta, es <strong className="text-slate-900 dark:text-white">obligatorio activar tu GPS</strong> antes de enviar.
                      </p>

                      <TactileButton
                        type="button"
                        variant="primary"
                        size="sm"
                        fullWidth
                        disabled={isCapturingGPS}
                        onClick={handleCaptureGPS}
                        className="bg-bogad-cyan hover:bg-cyan-300 text-slate-950 font-black flex items-center justify-center gap-2 py-2.5"
                      >
                        {isCapturingGPS ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Detectando satélites GPS...</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4 stroke-[2.5]" />
                            <span>Presionar aquí para Fijar mi Ubicación GPS</span>
                          </>
                        )}
                      </TactileButton>

                      {gpsError && (
                        <div className="p-2 bg-red-100 border border-red-500 rounded-lg flex items-center gap-1.5 text-red-900 text-xs font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>{gpsError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-900 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">
                        <span>Coordenadas:</span>
                        <span>{gpsLocation.lat}, {gpsLocation.lng}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                        <span>Precisión: ±{gpsLocation.accuracy} metros</span>
                        <a
                          href={gpsLocation.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-bold underline flex items-center gap-0.5"
                        >
                          <span>Ver en Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={handleCaptureGPS}
                        className="text-[10px] font-bold text-slate-700 dark:text-slate-300 underline pt-1 block"
                      >
                        Actualizar ubicación GPS
                      </button>
                    </div>
                  )}
                </div>

                {/* Referencia Adicional */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Referencia de Entrega (Opcional)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ej. Portón negro, frente al parque"
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 rounded-lg text-slate-900 dark:text-white shadow-tactile-sm"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Información de Retiro en Local */}
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border-2 border-emerald-600 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300">
                    <Store className="w-4 h-4" />
                    <span>Retiro directo en mostrador</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Pasarás a retirar tu pedido en: <strong>{storeProfile.address}</strong>.
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    ¡Cero costo de envío! Tu pedido se preparará para entrega inmediata en tienda.
                  </p>
                </div>

                {/* Nota para la tienda */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Nota o indicación de retiro (Opcional)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ej. Llego en 15 minutos, llevar bolsa"
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 rounded-lg text-slate-900 dark:text-white shadow-tactile-sm"
                  />
                </div>
              </>
            )}

            {/* SECCIÓN MÉTODOS DE PAGO COLOMBIA & VENEZUELA */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                ¿Cómo deseas pagar?
              </label>
              
              {availableMethods.length === 0 ? (
                <div className="p-3 bg-red-100 dark:bg-red-950/40 border-2 border-red-500 rounded-xl text-center text-xs font-black text-red-700 dark:text-red-300 shadow-tactile-sm">
                  ⚠️ No hay métodos de pago habilitados por la tienda en este momento.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {availableMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m.id);
                        soundService.playPop();
                      }}
                      className={`py-2 px-2 rounded-xl border-2 font-black text-xs transition-all flex items-center justify-between gap-1 shadow-tactile-sm ${
                        paymentMethod === m.id
                          ? `${m.color} border-slate-950 -translate-y-0.5 ring-2 ring-slate-950`
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{m.label}</span>
                      <span className="text-sm">{m.flag}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* TARJETA DE DATOS INTERACTIVA CON COPIA RÁPIDA */}
              {paymentMethod === 'nequi' && payments?.colombia?.nequi?.enabled && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-800 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-950 dark:text-purple-200">
                      Datos Nequi Colombia 🇨🇴
                    </span>
                    <span className="text-[10px] font-bold bg-purple-700 text-white px-2 py-0.5 rounded-md">
                      Paga {currencySymbol}{totalPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-purple-800">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Celular Nequi</span>
                      <span className="text-sm font-mono font-black text-slate-950 dark:text-white">
                        {payments.colombia.nequi.phone}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payments.colombia.nequi.phone, 'nequi')}
                      className="px-2.5 py-1 bg-purple-700 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-tactile-sm active:translate-y-0.5"
                    >
                      {copiedField === 'nequi' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'nequi' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                    Titular: <strong>{payments.colombia.nequi.holderName}</strong>
                  </p>
                </div>
              )}

              {paymentMethod === 'bancolombia' && payments?.colombia?.bancolombia?.enabled && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-950 dark:text-amber-200">
                      Datos Bancolombia 🇨🇴
                    </span>
                    <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">
                      Paga {currencySymbol}{totalPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-500">
                    <div>
                      <span className="text-[10px] text-slate-500 block">
                        Cuenta de {payments.colombia.bancolombia.accountType}
                      </span>
                      <span className="text-xs font-mono font-black text-slate-950 dark:text-white">
                        {payments.colombia.bancolombia.accountNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payments.colombia.bancolombia.accountNumber, 'bancolombia')}
                      className="px-2.5 py-1 bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 shadow-tactile-sm active:translate-y-0.5"
                    >
                      {copiedField === 'bancolombia' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'bancolombia' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                    Titular: <strong>{payments.colombia.bancolombia.holderName}</strong>
                  </p>
                </div>
              )}

              {paymentMethod === 'bdv' && payments?.venezuela?.bdv?.enabled && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border-2 border-red-700 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-red-950 dark:text-red-200">
                      Pago Móvil Banco de Venezuela (0102) 🇻🇪
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-red-700 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Teléfono:</span>
                      <strong className="text-slate-950 dark:text-white">{payments.venezuela.bdv.phone}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Cédula / RIF:</span>
                      <strong className="text-slate-950 dark:text-white">{payments.venezuela.bdv.idNumber}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Banco:</span>
                      <strong className="text-slate-950 dark:text-white">0102 (Venezuela)</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${payments.venezuela.bdv.phone} ${payments.venezuela.bdv.idNumber} 0102`, 'bdv')}
                      className="w-full mt-1 py-1.5 bg-red-700 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-tactile-sm"
                    >
                      {copiedField === 'bdv' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'bdv' ? '¡Datos de Pago Móvil Copiados!' : 'Copiar Datos de Pago Móvil'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                    Titular: <strong>{payments.venezuela.bdv.holderName}</strong>
                  </p>
                </div>
              )}

              {paymentMethod === 'banesco' && payments?.venezuela?.banesco?.enabled && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-700 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                      Pago Móvil Banesco (0134) 🇻🇪
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-700 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Teléfono:</span>
                      <strong className="text-slate-950 dark:text-white">{payments.venezuela.banesco.phone}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Cédula / RIF:</span>
                      <strong className="text-slate-950 dark:text-white">{payments.venezuela.banesco.idNumber}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Banco:</span>
                      <strong className="text-slate-950 dark:text-white">0134 (Banesco)</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${payments.venezuela.banesco.phone} ${payments.venezuela.banesco.idNumber} 0134`, 'banesco')}
                      className="w-full mt-1 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-tactile-sm"
                    >
                      {copiedField === 'banesco' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'banesco' ? '¡Datos de Pago Móvil Copiados!' : 'Copiar Datos de Pago Móvil'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                    Titular: <strong>{payments.venezuela.banesco.holderName}</strong>
                  </p>
                </div>
              )}

              {paymentMethod === 'bnc' && payments?.venezuela?.bnc?.enabled && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-800 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-950 dark:text-blue-200">
                      Pago Móvil BNC (0191) 🇻🇪
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-blue-800 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Teléfono:</span>
                      <strong className="text-slate-950 dark:text-white">{payments.venezuela.bnc.phone}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Cédula / RIF:</span>
                      <strong className="text-slate-950 dark:text-white">{payments.venezuela.bnc.idNumber}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Banco:</span>
                      <strong className="text-slate-950 dark:text-white">0191 (BNC)</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${payments.venezuela.bnc.phone} ${payments.venezuela.bnc.idNumber} 0191`, 'bnc')}
                      className="w-full mt-1 py-1.5 bg-blue-800 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-tactile-sm"
                    >
                      {copiedField === 'bnc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'bnc' ? '¡Datos de Pago Móvil Copiados!' : 'Copiar Datos de Pago Móvil'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                    Titular: <strong>{payments.venezuela.bnc.holderName}</strong>
                  </p>
                </div>
              )}

              {paymentMethod === 'cash' && payments?.cash?.enabled && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-900 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Pagas en efectivo al recibir tu pedido en la puerta de tu casa.</span>
                </div>
              )}
            </div>

            {/* SECCIÓN OBLIGATORIA: COMPROBANTE DE PAGO */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/90 rounded-xl border-2 border-slate-900 shadow-tactile-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-bogad-coral stroke-[2.5]" />
                  <span className="text-xs font-black text-slate-950 dark:text-white">
                    Comprobante de Pago
                  </span>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-slate-900 ${
                  paymentReceipt ? 'bg-bogad-lime text-slate-950 shadow-tactile-sm' : 'bg-bogad-coral text-white animate-pulse'
                }`}>
                  {paymentReceipt ? '✓ Adjuntado' : '⚠️ Obligatorio'}
                </span>
              </div>

              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                Adjunta la foto o captura de pantalla del comprobante de transferencia o pago. <strong className="text-slate-950 dark:text-white">Sin comprobante no podrás enviar tu orden.</strong>
              </p>

              {/* Input file oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleReceiptFileChange}
              />

              {paymentReceipt ? (
                <div className="space-y-2 pt-1">
                  <div className="relative rounded-xl overflow-hidden border-2 border-slate-900 bg-black/5 max-h-48 flex items-center justify-center">
                    <img
                      src={paymentReceipt}
                      alt="Comprobante de pago"
                      className="w-full h-auto max-h-48 object-contain"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 bg-white text-slate-950 rounded-lg border-2 border-slate-900 shadow-tactile-sm font-black text-xs flex items-center gap-1 hover:bg-slate-100 active:translate-y-0.5"
                        title="Cambiar foto del comprobante"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Cambiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentReceipt(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                          soundService.playPop();
                        }}
                        className="p-1.5 bg-bogad-coral text-white rounded-lg border-2 border-slate-900 shadow-tactile-sm font-black text-xs hover:bg-red-600 active:translate-y-0.5"
                        title="Eliminar comprobante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Comprobante listo y optimizado para el envío.</span>
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    disabled={isCompressingReceipt}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-3 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-900 dark:border-slate-400 hover:border-solid hover:bg-slate-100 rounded-xl flex items-center justify-center gap-2.5 font-black text-xs text-slate-900 dark:text-white transition-all shadow-tactile-sm active:translate-y-0.5"
                  >
                    {isCompressingReceipt ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-bogad-coral" />
                        <span>Procesando comprobante...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full bg-bogad-coral text-white flex items-center justify-center shadow-tactile-sm shrink-0">
                          <Camera className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div className="text-left">
                          <span className="block font-black text-xs text-slate-950 dark:text-white">📷 Adjuntar Foto o Comprobante</span>
                          <span className="block text-[10px] text-slate-500 font-bold">Toca aquí para seleccionar o tomar foto</span>
                        </div>
                      </>
                    )}
                  </button>
                  {receiptError && (
                    <p className="text-[11px] font-black text-bogad-coral mt-1.5 text-center">
                      {receiptError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Resumen de Costos y Desglose */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-slate-900 text-xs space-y-1.5 shadow-tactile-sm">
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>Subtotal (solo productos):</span>
                <span className="font-mono">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>{deliveryType === 'delivery' ? 'Costo de envío (Delivery):' : 'Modalidad de entrega:'}</span>
                <span className={`font-mono font-black ${deliveryType === 'delivery' ? 'text-slate-950 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {deliveryType === 'delivery' ? `+${currencySymbol}${activeDeliveryFee.toFixed(2)}` : '¡Retiro Gratis en Tienda!'}
                </span>
              </div>
              <div className="pt-1.5 border-t border-slate-300 dark:border-slate-700 flex justify-between text-sm font-black text-slate-950 dark:text-white">
                <span>Total a Pagar:</span>
                <span className="text-base text-emerald-700 dark:text-emerald-400 font-mono">{currencySymbol}{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Botón de Envío: Bloqueado estrictamente si falta comprobante, GPS o datos */}
            <div className="pt-2">
              {(() => {
                const isDeliv = deliveryType === 'delivery';
                const hasCustData = Boolean(name.trim()) && Boolean(phone.trim());
                const hasDelivData = !isDeliv || (Boolean(address.trim()) && Boolean(gpsLocation));
                const hasReceipt = Boolean(paymentReceipt);
                const hasPaymentMethod = availableMethods.length > 0;
                const canSubmit = hasCustData && hasDelivData && hasReceipt && hasPaymentMethod;

                return (
                  <>
                    <TactileButton
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      disabled={!canSubmit}
                      className={`py-3 flex items-center justify-center gap-2 ${
                        canSubmit
                          ? 'bg-bogad-lime hover:bg-lime-300 text-slate-950 font-black shadow-tactile-lg'
                          : 'opacity-50 cursor-not-allowed bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Send className="w-5 h-5 stroke-[2.5]" />
                      <span>
                        {isDeliv ? 'Enviar Pedido con Delivery 🛵' : 'Enviar Pedido para Retiro en Tienda 🏪'}
                      </span>
                    </TactileButton>

                    {onOpenTerms && (
                      <p className="text-center text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Al pedir confirmas los{' '}
                        <button
                          type="button"
                          onClick={onOpenTerms}
                          className="underline font-bold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white"
                        >
                          Términos del Servicio y Despacho GPS
                        </button>
                      </p>
                    )}

                    <div className="space-y-1 mt-2">
                      {!hasPaymentMethod && (
                        <div className="p-2 bg-red-100 dark:bg-red-950/40 border-2 border-red-500 rounded-xl text-center text-xs font-black text-red-700 dark:text-red-300 flex items-center justify-center gap-1.5 shadow-tactile-sm">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>⚠️ No hay métodos de pago habilitados. La tienda debe activar al menos uno.</span>
                        </div>
                      )}

                      {!hasReceipt && hasPaymentMethod && (
                        <div className="p-2 bg-red-100 dark:bg-red-950/40 border-2 border-red-500 rounded-xl text-center text-xs font-black text-red-700 dark:text-red-300 flex items-center justify-center gap-1.5 animate-pulse shadow-tactile-sm">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>⚠️ Debes adjuntar el comprobante de pago para poder continuar</span>
                        </div>
                      )}

                      {isDeliv && !gpsLocation && (
                        <p className="text-center text-[11px] font-extrabold text-bogad-coral">
                          ⚠️ Debes fijar tu ubicación GPS arriba para poder pedir a domicilio
                        </p>
                      )}

                      {(!name.trim() || !phone.trim()) && (
                        <p className="text-center text-[11px] font-extrabold text-slate-600 dark:text-slate-400">
                          ⚠️ Completa tu nombre y teléfono de contacto arriba
                        </p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </form>

        </TactileCard>
      </div>

      {/* Modal Pasarela QR */}
      {showQRModal && (
        <PaymentQRModal
          isOpen={showQRModal}
          total={totalPrice}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
};
