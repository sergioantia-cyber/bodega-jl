import React from 'react';
import { ShoppingBag, Grid, Users, Store, Tag, ShoppingCart, Truck, Clock } from 'lucide-react';
import { UserRole } from '../types';

export type NavTab = 'pos' | 'online_orders' | 'catalog' | 'fiados' | 'bodega' | 'offers' | 'cart_view' | 'my_orders';

interface BottomNavigationProps {
  currentTab: NavTab;
  role: UserRole;
  cartCount: number;
  debtorsCount: number;
  onlineOrdersCount: number;
  customerOrdersCount: number;
  onSelectTab: (tab: NavTab) => void;
  onOpenCart: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  role,
  cartCount,
  debtorsCount,
  onlineOrdersCount,
  customerOrdersCount,
  onSelectTab,
  onOpenCart
}) => {
  // Pestañas para el Dueño
  const ownerTabs = [
    {
      id: 'pos' as NavTab,
      label: 'Caja',
      icon: ShoppingBag,
      badge: cartCount > 0 ? (cartCount > 9 ? '9+' : cartCount) : null,
      badgeColor: 'bg-bogad-coral text-white'
    },
    {
      id: 'online_orders' as NavTab,
      label: 'Envíos GPS',
      icon: Truck,
      badge: onlineOrdersCount > 0 ? onlineOrdersCount : null,
      badgeColor: 'bg-bogad-coral text-white'
    },
    {
      id: 'catalog' as NavTab,
      label: 'Catálogo',
      icon: Grid,
      badge: null,
      badgeColor: ''
    },
    {
      id: 'fiados' as NavTab,
      label: 'Fiados',
      icon: Users,
      badge: debtorsCount > 0 ? debtorsCount : null,
      badgeColor: 'bg-bogad-yellow text-slate-950'
    },
    {
      id: 'bodega' as NavTab,
      label: 'Bodega',
      icon: Store,
      badge: null,
      badgeColor: ''
    }
  ];

  // Pestañas para el Cliente
  const customerTabs = [
    {
      id: 'catalog' as NavTab,
      label: 'Productos',
      icon: Grid,
      badge: null,
      badgeColor: ''
    },
    {
      id: 'my_orders' as NavTab,
      label: 'Mis Compras',
      icon: Clock,
      badge: customerOrdersCount > 0 ? customerOrdersCount : null,
      badgeColor: 'bg-bogad-lime text-slate-950'
    },
    {
      id: 'offers' as NavTab,
      label: 'Ofertas',
      icon: Tag,
      badge: 'TOP',
      badgeColor: 'bg-bogad-yellow text-slate-950 text-[8px]'
    },
    {
      id: 'cart_view' as NavTab,
      label: 'Mi Pedido',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
      badgeColor: 'bg-bogad-coral text-white',
      isAction: true
    },
    {
      id: 'bodega' as NavTab,
      label: 'La Tienda',
      icon: Store,
      badge: null,
      badgeColor: ''
    }
  ];

  const activeTabs = role === 'owner' ? ownerTabs : customerTabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t-2 border-slate-900 pb-[env(safe-area-inset-bottom)] px-2 pt-1.5">
      <div className="max-w-md mx-auto flex items-center justify-around gap-1">
        {activeTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          const handleClick = () => {
            if (tab.id === 'cart_view') {
              onOpenCart();
            } else {
              onSelectTab(tab.id);
            }
          };

          return (
            <button
              key={tab.id}
              onClick={handleClick}
              className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-75 select-none touch-manipulation border-2 relative ${
                isActive
                  ? 'bg-bogad-yellow border-slate-900 shadow-tactile-sm -translate-y-1 font-black text-slate-950'
                  : 'border-transparent text-slate-600 dark:text-slate-400 font-bold active:bg-slate-100 dark:active:bg-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge !== null && (
                  <span
                    className={`absolute -top-1.5 -right-3 text-[9px] font-black min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center border border-slate-900 shadow-tactile-sm ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight truncate max-w-[56px] text-center">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
