import React, { useState } from 'react';
import { X, Bike, Lock, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { TactileCard } from './ui/TactileCard';
import { TactileButton } from './ui/TactileButton';
import { deliveryService } from '../services/deliveryService';

interface DeliveryLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeliveryLoginModal: React.FC<DeliveryLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [username, setUsername] = useState('yoxman');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const res = deliveryService.login(username, password);
      setIsLoading(false);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || 'Credenciales incorrectas');
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <TactileCard
        variant="yellow"
        className="w-full max-w-sm p-6 space-y-5 border-4 border-slate-950 shadow-tactile-lg relative"
      >
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border-2 border-slate-950 bg-white hover:bg-slate-100 text-slate-950 shadow-tactile-sm transition-transform active:translate-y-0.5"
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>

        {/* Cabecera */}
        <div className="space-y-1 text-center pr-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white border-2 border-slate-950 shadow-tactile mb-1">
            <span className="text-3xl">🛵</span>
          </div>
          <h3 className="text-xl font-black text-slate-950 tracking-tight">
            Acceso Domiciliarios
          </h3>
          <p className="text-xs font-bold text-slate-800">
            Red de Repartidores Pedigochos
          </p>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-2.5 bg-red-100 border-2 border-red-950 rounded-xl text-xs font-bold text-red-900 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Usuario Domiciliario</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yoxman"
                className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-950 rounded-xl text-sm font-black text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 shadow-tactile-sm"
              />
            </div>
            <p className="text-[10px] font-bold text-slate-700">
              Cuenta preasignada: <strong className="font-black text-slate-950">yoxman</strong> (Nombre fijo: Yoxman).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-950 uppercase flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Contraseña de Seguridad</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-950 rounded-xl text-sm font-black text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 shadow-tactile-sm font-mono"
            />
          </div>

          <div className="pt-2 space-y-2">
            <TactileButton
              type="submit"
              variant="lime"
              size="lg"
              fullWidth
              disabled={isLoading}
              className="flex items-center justify-center gap-2 font-black text-sm uppercase shadow-tactile"
            >
              <Bike className="w-4 h-4 stroke-[2.5]" />
              <span>{isLoading ? 'Verificando...' : 'Entrar a Mi Turno 🛵'}</span>
            </TactileButton>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-center text-xs font-black text-slate-700 hover:text-slate-950 underline underline-offset-2"
            >
              Volver a la App
            </button>
          </div>
        </form>

        {/* Badge de Seguridad */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-slate-800 bg-white/70 py-1.5 px-2 rounded-lg border border-slate-950">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
          <span>Acceso Restringido a Domicilios del Día y Chat Grupal</span>
        </div>
      </TactileCard>
    </div>
  );
};
