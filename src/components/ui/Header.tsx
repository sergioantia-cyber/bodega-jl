import React from 'react';
import { ShoppingBag, Moon, Sun, WifiOff, Palette, Lock } from 'lucide-react';
import { TactileButton } from './TactileButton';
import { UserRole, StoreProfile } from '../../types';
import { storageService } from '../../services/storageService';

interface HeaderProps {
  cartCount: number;
  isOffline: boolean;
  isDark: boolean;
  role: UserRole;
  storeProfile?: StoreProfile;
  onToggleTheme: () => void;
  onOpenCart: () => void;
  onOpenBrandCustomizer?: () => void;
  onLockOwner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  isOffline,
  isDark,
  role,
  storeProfile,
  onToggleTheme,
  onOpenCart,
  onOpenBrandCustomizer,
  onLockOwner
}) => {
  const profile = storeProfile || storageService.getStoreProfile();

  return (
    <header className="sticky top-0 z-40 w-full bg-bogad-light/95 dark:bg-bogad-dark/95 backdrop-blur-md border-b-2 border-slate-900 px-4 pt-[max(env(safe-area-inset-top,0px),2.6rem)] pb-3">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            onClick={role === 'owner' ? onOpenBrandCustomizer : undefined}
            className={`w-10 h-10 rounded-xl bg-bogad-yellow border-2 border-slate-900 shadow-tactile-sm flex items-center justify-center font-black text-slate-950 text-xl shrink-0 ${
              role === 'owner' ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
            }`}
            title={role === 'owner' ? 'Personalizar Marca y Colores' : profile.name}
          >
            <span>{profile.iconEmoji || '🏪'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black tracking-tight leading-none text-slate-950 dark:text-white truncate">
                {profile.name || 'BOGAD'}
              </h1>
              {/* Badge solo para el Dueño */}
              {role === 'owner' && (
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 border border-slate-900 rounded shadow-tactile-sm shrink-0 bg-bogad-yellow text-slate-950">
                  POS DUEÑO
                </span>
              )}
            </div>
            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 leading-tight truncate">
              {profile.slogan || (role === 'owner' ? 'Caja & Despacho GPS' : 'Catálogo Virtual')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isOffline && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-bogad-coral text-white border-2 border-slate-900 rounded-lg shadow-tactile-sm text-[10px] font-bold animate-pulse">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
            </div>
          )}

          {/* Botón de Marca Blanca para el Dueño */}
          {role === 'owner' && onOpenBrandCustomizer && (
            <TactileButton
              variant="secondary"
              size="icon"
              onClick={onOpenBrandCustomizer}
              aria-label="Personalizar marca"
              className="w-9 h-9 bg-bogad-yellow text-slate-950"
              title="Personalizar Colores y Marca"
            >
              <Palette className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </TactileButton>
          )}

          {/* Botón de Bloqueo / Salir de Administrador para el Dueño */}
          {role === 'owner' && onLockOwner && (
            <TactileButton
              variant="coral"
              size="sm"
              onClick={onLockOwner}
              aria-label="Bloquear panel de administrador y volver a clientes"
              className="h-9 px-2.5 flex items-center gap-1.5 text-xs font-black text-white bg-bogad-coral"
              title="Volver al Catálogo de Clientes"
            >
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Salir</span>
            </TactileButton>
          )}

          <TactileButton
            variant="secondary"
            size="icon"
            onClick={onToggleTheme}
            aria-label="Cambiar tema"
            className="w-9 h-9"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-bogad-yellow" />
            ) : (
              <Moon className="w-4 h-4 text-slate-900" />
            )}
          </TactileButton>

          <TactileButton
            variant="primary"
            size="icon"
            onClick={onOpenCart}
            aria-label="Ver carrito"
            className="w-9 h-9 relative"
          >
            <ShoppingBag className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-bogad-coral text-white border border-slate-900 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-tactile-sm animate-bounce">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </TactileButton>
        </div>
      </div>
    </header>
  );
};
