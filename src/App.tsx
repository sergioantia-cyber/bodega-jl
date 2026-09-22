import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Clock, MapPin, Phone, Heart, QrCode, Send, Settings, Palette, CreditCard, Lock } from 'lucide-react';
import { Header } from './components/ui/Header';
import { BottomNavigation, NavTab } from './components/BottomNavigation';
import { ProductCard } from './components/ProductCard';
import { CartModal } from './components/CartModal';
import { CustomerCheckoutModal } from './components/CustomerCheckoutModal';
import { CustomerOrdersView } from './components/CustomerOrdersView';
import { OwnerOrdersView } from './components/OwnerOrdersView';
import { InstallPromptModal } from './components/InstallPromptModal';
import { ScannerFAB } from './components/ScannerFAB';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { SalePOSView } from './components/SalePOSView';
import { CustomersView } from './components/CustomersView';
import { OwnerCatalogView } from './components/OwnerCatalogView';
import { EditStoreProfileModal } from './components/EditStoreProfileModal';
import { BrandCustomizerModal } from './components/BrandCustomizerModal';
import { PaymentMethodsConfigModal } from './components/PaymentMethodsConfigModal';
import { AdminPinModal } from './components/AdminPinModal';
import { StoreShareModal } from './components/StoreShareModal';
import { TermsAndConditionsModal } from './components/TermsAndConditionsModal';
import { TactileCard } from './components/ui/TactileCard';
import { TactileButton } from './components/ui/TactileButton';
import { VoiceSearchButton } from './components/VoiceSearchButton';
import { usePWA } from './hooks/usePWA';
import { useCart } from './hooks/useCart';
import { storageService } from './services/storageService';
import { soundService } from './services/soundService';
import { themeService } from './services/themeService';
import { storeService } from './services/storeService';
import { orderDispatchService } from './services/orderDispatchService';
import { cloudStoreService, cloudProductService } from './services/supabaseClient';
import { CATEGORIES } from './services/productData';
import { Product, Customer, Sale, UserRole, CustomerOrder, CartItem, OrderStatus } from './types';

export function App() {
  const [role, setRole] = useState<UserRole>('customer');
  const [currentTab, setCurrentTab] = useState<NavTab>('catalog');
  const [products, setProducts] = useState<Product[]>(() => storageService.getProducts());
  const [customers, setCustomers] = useState<Customer[]>(() => storageService.getCustomers());
  const [storeOrders, setStoreOrders] = useState<CustomerOrder[]>(() => orderDispatchService.getOrders());
  const [myOrders, setMyOrders] = useState<CustomerOrder[]>(() => orderDispatchService.getMyOrders());
  const [favorites, setFavorites] = useState<string[]>(() => storageService.getFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modales
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [dismissInstall, setDismissInstall] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [isEditStoreModalOpen, setIsEditStoreModalOpen] = useState<boolean>(false);
  const [isBrandCustomizerOpen, setIsBrandCustomizerOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);
  const [storeProfile, setStoreProfile] = useState(() => storageService.getStoreProfile());
  const [isDark, setIsDark] = useState<boolean>(() => storageService.getTheme() === 'dark');

  const { isInstallable, isInstalled, isIOS, isOffline, promptInstall } = usePWA();
  const { items, totalItems, totalPrice, addToCart, removeFromCart, updateQuantity, clearCart } = useCart();

  // Contador de toques secretos en "condiciones" (5 toques silenciosos)
  const secretClickCountRef = useRef<number>(0);
  const secretClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretCondicionesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    secretClickCountRef.current += 1;

    if (secretClickTimerRef.current) {
      clearTimeout(secretClickTimerRef.current);
    }

    secretClickTimerRef.current = setTimeout(() => {
      secretClickCountRef.current = 0;
    }, 3000);

    if (secretClickCountRef.current >= 5) {
      secretClickCountRef.current = 0;
      if (secretClickTimerRef.current) {
        clearTimeout(secretClickTimerRef.current);
      }
      setIsAdminPinModalOpen(true);
    }
  };

  const handleUnlockOwner = () => {
    setRole('owner');
    setCurrentTab('pos');
    setIsAdminPinModalOpen(false);
  };

  const handleLockOwner = () => {
    setRole('customer');
    setCurrentTab('catalog');
  };

  // Inicializar tema de marca blanca
  useEffect(() => {
    themeService.init(storeProfile.theme);
  }, []);

  const activeSlug = useMemo(() => {
    return storeService.getStoreSlugFromUrl() || storeProfile.slug || storeService.getActiveSlug();
  }, [storeProfile.slug]);

  // Detección Multi-Tienda y Carga inicial desde la nube (Supabase)
  useEffect(() => {
    const urlSlug = storeService.getStoreSlugFromUrl();
    const currentSlug = urlSlug || storeProfile.slug || storeService.getActiveSlug();
    if (urlSlug && urlSlug !== storeProfile.slug) {
      setStoreProfile(prev => ({ ...prev, slug: urlSlug }));
    }

    cloudStoreService.fetchStoreProfile(currentSlug).then((remoteProfile) => {
      if (remoteProfile) {
        storageService.saveStoreProfile(remoteProfile, currentSlug);
        setStoreProfile(remoteProfile);
        themeService.init(remoteProfile.theme);
      }
    });

    cloudProductService.fetchProducts(currentSlug).then((remoteProducts) => {
      if (remoteProducts && remoteProducts.length > 0) {
        storageService.saveProducts(remoteProducts, currentSlug);
        setProducts(remoteProducts);
      }
    });
  }, [activeSlug]);

  // Limpieza defensiva de pedidos mock heredados en almacenamiento local
  useEffect(() => {
    try {
      const rawStore = localStorage.getItem('bogad_customer_orders');
      if (rawStore && rawStore.includes('María Elena Ramos')) {
        const cleaned = JSON.parse(rawStore).filter((o: any) => !o.customerName?.includes('María Elena Ramos') && o.id !== 'ord-1042');
        localStorage.setItem('bogad_customer_orders', JSON.stringify(cleaned));
        if (activeSlug === 'bodega-jl') {
          setStoreOrders(cleaned);
        }
      }
      const rawMy = localStorage.getItem('bogad_my_local_orders');
      if (rawMy && rawMy.includes('María Elena Ramos')) {
        const cleaned = JSON.parse(rawMy).filter((o: any) => !o.customerName?.includes('María Elena Ramos') && o.id !== 'ord-1042');
        localStorage.setItem('bogad_my_local_orders', JSON.stringify(cleaned));
        if (activeSlug === 'bodega-jl') {
          setMyOrders(cleaned);
        }
      }
    } catch (e) {
      console.warn('Error purgando pedidos de prueba:', e);
    }
  }, [activeSlug]);

  // Suscribirse a nuevos pedidos en tiempo real para esta tienda
  useEffect(() => {
    const unsubscribe = orderDispatchService.subscribe(() => {
      setStoreOrders(orderDispatchService.getOrders(activeSlug));
      setMyOrders(orderDispatchService.getMyOrders(activeSlug));
    }, activeSlug);
    return () => unsubscribe();
  }, [activeSlug]);

  // Sincronización en tiempo real de cambios en métodos de pago y perfil de tienda
  useEffect(() => {
    const handleProfileUpdate = () => {
      const fresh = storageService.getStoreProfile(activeSlug);
      setStoreProfile(fresh);
      themeService.init(fresh.theme);
    };

    window.addEventListener('bogad_store_profile_updated', handleProfileUpdate);
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `bogad_store_profile_${activeSlug}` || (activeSlug === 'bodega-jl' && e.key === 'bogad_store_profile')) {
        handleProfileUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);

    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        broadcastChannel = new BroadcastChannel(`bogad_store_channel_${activeSlug}`);
        broadcastChannel.addEventListener('message', (event) => {
          if (event.data?.type === 'STORE_PROFILE_UPDATED') {
            handleProfileUpdate();
          }
        });
      } catch {
        // Ignorar
      }
    }

    // Suscripción remota vía Supabase Realtime si está activo
    const unsubscribeCloud = cloudStoreService.subscribeToStoreProfile((remoteProfile) => {
      if (remoteProfile) {
        storageService.saveStoreProfile(remoteProfile, activeSlug);
        setStoreProfile(storageService.getStoreProfile(activeSlug));
      }
    }, activeSlug);

    return () => {
      window.removeEventListener('bogad_store_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleStorage);
      if (broadcastChannel) broadcastChannel.close();
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, [activeSlug]);

  // Sincronización en tiempo real de productos e inventario (catálogo cliente)
  useEffect(() => {
    const handleProductsUpdate = () => {
      setProducts(storageService.getProducts(activeSlug));
    };

    window.addEventListener('bogad_products_updated', handleProductsUpdate);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === `bogad_products_data_${activeSlug}` || (activeSlug === 'bodega-jl' && e.key === 'bogad_products_data')) {
        handleProductsUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);

    let prodBroadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        prodBroadcastChannel = new BroadcastChannel(`bogad_products_channel_${activeSlug}`);
        prodBroadcastChannel.addEventListener('message', (event) => {
          if (event.data?.type === 'PRODUCTS_UPDATED') {
            handleProductsUpdate();
          }
        });
      } catch {
        // Ignorar
      }
    }

    // Suscripción remota vía Supabase Realtime si está activo
    const unsubscribeCloudProd = cloudProductService.subscribeToProducts((remoteProducts) => {
      if (remoteProducts && Array.isArray(remoteProducts)) {
        storageService.saveProducts(remoteProducts, activeSlug);
        setProducts(storageService.getProducts(activeSlug));
      }
    }, activeSlug);

    return () => {
      window.removeEventListener('bogad_products_updated', handleProductsUpdate);
      window.removeEventListener('storage', handleStorage);
      if (prodBroadcastChannel) prodBroadcastChannel.close();
      if (unsubscribeCloudProd) unsubscribeCloudProd();
    };
  }, [activeSlug]);

  // Gestión de Dark Mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      storageService.saveTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      storageService.saveTheme('light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Cantidad de clientes con deuda para badge de navegación
  const debtorsCount = useMemo(() => {
    return customers.filter((c) => c.debt > 0).length;
  }, [customers]);

  // Cantidad de pedidos online pendientes de despacho
  const pendingOrdersCount = useMemo(() => {
    return storeOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;
  }, [storeOrders]);

  // Manejo de nuevo producto registrado al vuelo con el escáner
  const handleProductRegistered = (newProduct: Product) => {
    const updated = storageService.addProduct(newProduct, activeSlug);
    setProducts(updated);
  };

  // Manejo de modificación de productos por el dueño
  const handleUpdateProduct = (updatedProduct: Product) => {
    const updated = storageService.updateProduct(updatedProduct, activeSlug);
    setProducts(updated);
  };

  // Manejo de eliminación de productos por el dueño
  const handleDeleteProduct = (productId: string) => {
    const updated = storageService.deleteProduct(productId, activeSlug);
    setProducts(updated);
  };

  // Manejo de venta completada desde la vista POS
  const handleCompleteSale = (
    sale: Sale,
    debtUpdate?: { customerId: string; amountAdded: number }
  ) => {
    storageService.recordSale(sale, activeSlug);
    // Descontar inventario en tiempo real
    const updatedProducts = storageService.decrementStock(sale.items, activeSlug);
    setProducts(updatedProducts);

    if (debtUpdate) {
      const updatedCustomers = storageService.updateCustomerDebt(
        debtUpdate.customerId,
        debtUpdate.amountAdded,
        activeSlug
      );
      setCustomers(updatedCustomers);
    }
    clearCart();
  };

  // Manejo de favoritos ❤️
  const handleToggleFavorite = (productId: string) => {
    const updated = storageService.toggleFavorite(productId, activeSlug);
    setFavorites(updated);
  };

  // Manejo de abonos a deudas de clientes
  const handleUpdateCustomerDebt = (customerId: string, amountChange: number) => {
    const updatedCustomers = storageService.updateCustomerDebt(customerId, amountChange, activeSlug);
    setCustomers(updatedCustomers);
  };

  // Manejo de registro de nuevos clientes
  const handleAddCustomer = (newCustomer: Customer) => {
    const updatedCustomers = storageService.addCustomer(newCustomer, activeSlug);
    setCustomers(updatedCustomers);
  };

  // Manejo de cambio de estado de pedido online (por el dueño)
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const updated = orderDispatchService.updateOrderStatus(orderId, newStatus, activeSlug);
    setStoreOrders(updated);
    setMyOrders(orderDispatchService.getMyOrders(activeSlug));
  };

  // Repetir pedido anterior
  const handleRepeatOrder = (orderItems: CartItem[]) => {
    orderItems.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        addToCart(item.product);
      }
    });
    setIsCartOpen(true);
  };

  // Filtrado de productos en catálogo
  const filteredProducts = useMemo(() => {
    let list = products;

    if (showFavoritesOnly) {
      list = list.filter((p) => favorites.includes(p.id));
    }

    if (currentTab === 'offers') {
      list = list.filter((p) => p.tag === 'OFERTA' || p.originalPrice);
    } else if (selectedCategory !== 'todos') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
      );
    }

    return list;
  }, [products, currentTab, selectedCategory, searchQuery, showFavoritesOnly, favorites]);

  return (
    <div className="min-h-screen bg-bogad-light dark:bg-bogad-dark flex flex-col transition-colors pb-24">
      {/* Encabezado Superior Fijo con margen seguro para Notch/Cámara */}
      <Header
        cartCount={totalItems}
        isOffline={isOffline}
        isDark={isDark}
        role={role}
        storeProfile={storeProfile}
        onToggleTheme={toggleTheme}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenBrandCustomizer={() => setIsBrandCustomizerOpen(true)}
        onLockOwner={role === 'owner' ? handleLockOwner : undefined}
      />

      {/* Área Principal de Contenido */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-2.5 space-y-3">

        {/* 1. VISTA PRINCIPAL DE VENTA (POS) - Solo Dueño */}
        {role === 'owner' && currentTab === 'pos' && (
          <SalePOSView
            items={items}
            customers={customers}
            totalPrice={totalPrice}
            totalItems={totalItems}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeFromCart}
            onClearCart={clearCart}
            onCompleteSale={handleCompleteSale}
            onOpenScanner={() => setIsScannerOpen(true)}
            onSwitchToCustomer={handleLockOwner}
          />
        )}

        {/* 2. PEDIDOS ONLINE Y DESPACHO CON GPS - Solo Dueño */}
        {role === 'owner' && currentTab === 'online_orders' && (
          <OwnerOrdersView
            orders={storeOrders}
            onUpdateStatus={handleUpdateOrderStatus}
          />
        )}

        {/* 3. HISTORIAL DE COMPRAS ANTERIORES - Solo Cliente */}
        {role === 'customer' && currentTab === 'my_orders' && (
          <CustomerOrdersView
            orders={myOrders}
            onRepeatOrder={handleRepeatOrder}
          />
        )}

        {/* 4. CATÁLOGO DE GESTIÓN E INVENTARIO - Solo Dueño */}
        {role === 'owner' && (currentTab === 'catalog' || currentTab === 'offers') && (
          <OwnerCatalogView
            products={products}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddToCart={addToCart}
            onOpenScanner={() => setIsScannerOpen(true)}
          />
        )}

        {/* 5. CATÁLOGO COMPLETO DE COMPRAS Y OFERTAS - Solo Cliente */}
        {role === 'customer' && (currentTab === 'catalog' || currentTab === 'offers') && (
          <div className="space-y-3 pb-12 animate-in fade-in duration-200">
            {/* Banner Hero de la Tienda */}
            <TactileCard variant="yellow" className="p-4 space-y-1.5 shadow-tactile">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border-2 border-slate-950 rounded-lg text-[10px] font-black uppercase shadow-tactile-sm text-slate-950">
                <span>{storeProfile.iconEmoji || '🏪'}</span>
                <span>{storeProfile.name} • Catálogo Oficial</span>
              </div>
              <h2 className="text-xl font-black text-slate-950 leading-tight">
                {storeProfile.name}
              </h2>
              <p className="text-xs font-semibold text-slate-800">
                {storeProfile.slogan || 'Elige tus productos y recíbelos en minutos con tu ubicación GPS en vivo.'}
              </p>
            </TactileCard>

            {/* Buscador Táctil con Búsqueda por Voz */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-700 dark:text-slate-300">
                  <Search className="w-4 h-4 stroke-[2.5]" />
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, categoría o código..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-bold shadow-tactile-sm focus:outline-none focus:ring-2 focus:ring-bogad-yellow"
                />
              </div>
              <VoiceSearchButton onTranscript={(term) => setSearchQuery(term)} />
            </div>

            {/* Carrusel de Categorías + Filtro de Favoritos */}
            {currentTab === 'catalog' && (
              <div className="flex gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar -mx-4 px-4">
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly(prev => !prev)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 font-extrabold text-xs transition-all duration-75 select-none touch-manipulation ${
                    showFavoritesOnly
                      ? 'bg-rose-400 text-slate-950 shadow-tactile -translate-y-0.5'
                      : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-tactile-sm active:translate-y-0.5 active:shadow-none'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-slate-950 text-slate-950' : 'fill-rose-500 text-rose-500'}`} />
                  <span>Favoritos {favorites.length > 0 ? `(${favorites.length})` : ''}</span>
                </button>

                {CATEGORIES.map((cat) => {
                  const isSelected = !showFavoritesOnly && selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setShowFavoritesOnly(false);
                        setSelectedCategory(cat.id);
                      }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 font-extrabold text-xs transition-all duration-75 select-none touch-manipulation ${
                        isSelected
                          ? `${cat.bgAccent} text-slate-950 shadow-tactile -translate-y-0.5`
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-tactile-sm active:translate-y-0.5 active:shadow-none'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Grid de Productos */}
            <div className="flex items-center justify-between pt-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                {currentTab === 'offers' ? 'Ofertas Especiales 🔥' : 'Disponibles en Estantería'}
              </h3>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {filteredProducts.length} productos
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <TactileCard className="text-center py-10">
                <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                  No se encontraron productos
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Intenta buscar con otro término o escanea el código para registrarlo.
                </p>
                <TactileButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('todos');
                  }}
                  className="mt-3"
                >
                  Restablecer filtros
                </TactileButton>
              </TactileCard>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => {
                  const inCartItem = items.find((i) => i.product.id === product.id);
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      quantityInCart={inCartItem ? inCartItem.quantity : 0}
                      isFavorite={favorites.includes(product.id)}
                      onAddToCart={addToCart}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  );
                })}
              </div>
            )}

            {/* Botón flotante de Pedir para el Cliente si tiene artículos */}
            {role === 'customer' && totalItems > 0 && (
              <div className="sticky bottom-20 z-30 pt-2">
                <TactileButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="bg-bogad-lime hover:bg-lime-300 flex items-center justify-between px-5 shadow-tactile-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-950 text-white font-black text-xs flex items-center justify-center">
                      {totalItems}
                    </span>
                    <span className="font-black text-slate-950">Pedir con GPS 📍</span>
                  </div>
                  <span className="text-lg font-black text-slate-950">${totalPrice.toFixed(2)}</span>
                </TactileButton>
              </div>
            )}
          </div>
        )}

        {/* 5. MÓDULO DE CLIENTES Y FIADOS - Solo Dueño */}
        {role === 'owner' && currentTab === 'fiados' && (
          <CustomersView
            customers={customers}
            onUpdateDebt={handleUpdateCustomerDebt}
            onAddCustomer={handleAddCustomer}
          />
        )}

        {/* 6. INFORMACIÓN DE LA BODEGA & QR PARA CLIENTES */}
        {currentTab === 'bodega' && (
          <div className="space-y-3 pb-12 animate-in fade-in duration-200">
            <TactileCard variant="yellow" className="space-y-2 shadow-tactile">
              <span className="text-xs font-black uppercase px-2 py-0.5 bg-white border-2 border-slate-900 rounded-md shadow-tactile-sm">
                Tu Bodega de Confianza
              </span>
              <h2 className="text-2xl font-black text-slate-950 tracking-tight leading-tight flex items-center gap-2">
                <span>{storeProfile.iconEmoji || '🏪'}</span>
                <span>{storeProfile.name}</span>
              </h2>
              <p className="text-xs font-bold text-slate-800">
                {storeProfile.slogan || 'Atendiendo a los vecinos con productos frescos, venta al contado, transferencias y fiados.'}
              </p>
            </TactileCard>

            {/* Tarjeta de Personalización Marca Blanca (Estudio de Marca & Colores para el Dueño) */}
            {role === 'owner' && (
              <TactileCard variant="yellow" className="p-4 space-y-2 shadow-tactile border-2 border-slate-950 bg-amber-50">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-white border border-slate-950 rounded">
                      Personalización Marca Blanca
                    </span>
                    <h3 className="text-base font-black text-slate-950 mt-1 flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-slate-950" />
                      <span>Colores & Marca del Negocio</span>
                    </h3>
                    <p className="text-xs font-bold text-slate-800">
                      Personaliza el nombre, logo, eslogan, moneda y paleta de colores de la app para adaptarla a cualquier negocio o cliente.
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-bogad-yellow border-2 border-slate-950 flex items-center justify-center shrink-0 shadow-tactile-sm text-xl">
                    <span>{storeProfile.iconEmoji || '🏪'}</span>
                  </div>
                </div>

                <TactileButton
                  variant="dark"
                  size="sm"
                  fullWidth
                  onClick={() => setIsBrandCustomizerOpen(true)}
                  className="mt-2 flex items-center justify-center gap-1.5 font-black text-xs"
                >
                  <Palette className="w-4 h-4 text-bogad-yellow stroke-[2.5]" />
                  <span>Personalizar Nombre, Colores & Marca 🎨</span>
                </TactileButton>
              </TactileCard>
            )}

            {/* Configuración de WhatsApp y Datos (Herramienta Clave para el Dueño) */}
            {role === 'owner' && (
              <TactileCard variant="lime" className="p-4 space-y-2 shadow-tactile border-2 border-slate-950">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-white border border-slate-950 rounded">
                      Configuración del Negocio
                    </span>
                    <h3 className="text-base font-black text-slate-950 mt-1">
                      WhatsApp para Recibir Pedidos
                    </h3>
                    <p className="text-xs font-bold text-slate-800">
                      Número activo: <span className="font-mono underline font-black">{storeProfile.whatsappNumber}</span>. Aquí llegan los carritos de compra de los clientes con su ubicación GPS.
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white border-2 border-slate-950 flex items-center justify-center shrink-0 shadow-tactile-sm">
                    <Settings className="w-7 h-7 text-slate-950" />
                  </div>
                </div>

                <TactileButton
                  variant="dark"
                  size="sm"
                  fullWidth
                  onClick={() => setIsEditStoreModalOpen(true)}
                  className="mt-2 flex items-center justify-center gap-1.5 font-black"
                >
                  <Phone className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span>Configurar WhatsApp y Sucursal ⚙️</span>
                </TactileButton>
              </TactileCard>
            )}

            {/* Configuración de Métodos de Pago (Colombia & Venezuela) */}
            {role === 'owner' && (
              <TactileCard variant="lime" className="p-4 space-y-2 shadow-tactile border-2 border-slate-950">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-white border border-slate-950 rounded">
                      Pasarela Multi-País
                    </span>
                    <h3 className="text-base font-black text-slate-950 mt-1 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-slate-950" />
                      <span>Métodos de Pago (Colombia & Venezuela)</span>
                    </h3>
                    <p className="text-xs font-bold text-slate-800">
                      Configura Nequi, Bancolombia (🇨🇴) y Pago Móvil BDV, Banesco, BNC (🇻🇪). Tus clientes verán tus datos y podrán copiarlos al pedir.
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white border-2 border-slate-950 flex items-center justify-center shrink-0 shadow-tactile-sm">
                    <CreditCard className="w-6 h-6 text-slate-950" />
                  </div>
                </div>

                <TactileButton
                  variant="dark"
                  size="sm"
                  fullWidth
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="mt-2 flex items-center justify-center gap-1.5 font-black text-xs"
                >
                  <CreditCard className="w-4 h-4 text-bogad-lime stroke-[2.5]" />
                  <span>Configurar Cuentas y Pago Móvil 💳</span>
                </TactileButton>
              </TactileCard>
            )}

            {/* Tarjeta de Código QR para el Mostrador (Herramienta Clave para el Dueño) */}
            {role === 'owner' && (
              <TactileCard variant="cyan" className="p-4 space-y-2 shadow-tactile border-2 border-slate-950">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-white border border-slate-950 rounded">
                      Herramienta para el Bodeguero
                    </span>
                    <h3 className="text-base font-black text-slate-950 mt-1">
                      Código QR para el Mostrador
                    </h3>
                    <p className="text-xs font-bold text-slate-800">
                      Tus clientes escanean este código con su celular para ver tus productos y pedir con GPS sin descargar nada.
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white border-2 border-slate-950 flex items-center justify-center shrink-0 shadow-tactile-sm">
                    <QrCode className="w-7 h-7 text-slate-950" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <TactileButton
                    variant="dark"
                    size="sm"
                    fullWidth
                    onClick={() => setShowQRModal(true)}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold"
                  >
                    <QrCode className="w-4 h-4 stroke-[2.5]" />
                    <span>Ver Cartel QR</span>
                  </TactileButton>

                  <TactileButton
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      soundService.playPop();
                      const shareUrl = storeService.getStoreShareUrl(storeProfile.slug, storeProfile.catalogUrl);
                      const message = `👋 ¡Hola! Te invito a ver nuestro catálogo oficial en línea de *${storeProfile.name}* 🏪.\n\nPuedes ver productos, precios y pedir a domicilio al instante desde tu celular:\n👉 ${shareUrl}`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-950"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    <span>Enviar WhatsApp</span>
                  </TactileButton>
                </div>
              </TactileCard>
            )}

            <TactileCard className="space-y-3 shadow-tactile">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bogad-cyan border-2 border-slate-900 shadow-tactile-sm flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-slate-900 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Ubicación</h4>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {storeProfile.address}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bogad-lime border-2 border-slate-900 shadow-tactile-sm flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-slate-900 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Horario de Atención</h4>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {storeProfile.schedule}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bogad-coral border-2 border-slate-900 shadow-tactile-sm flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Teléfono y WhatsApp</h4>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {storeProfile.phoneDisplay || storeProfile.whatsappNumber} (Entregas al instante con GPS)
                  </p>
                </div>
              </div>
            </TactileCard>

            {/* Tarjeta de Seguridad y Bloqueo para el Dueño */}
            {role === 'owner' && (
              <TactileCard variant="default" className="p-4 space-y-2 border-2 border-slate-950 shadow-tactile">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-bogad-yellow border border-slate-950 rounded">
                      Seguridad y Control
                    </span>
                    <h3 className="text-sm font-black text-slate-950 dark:text-white mt-1">
                      Modo Administrador Activo
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Bloquea el panel para volver a la vista del catálogo público para clientes.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-950 flex items-center justify-center shrink-0 shadow-tactile-sm">
                    <Lock className="w-5 h-5 text-slate-950 dark:text-white stroke-[2.5]" />
                  </div>
                </div>

                <TactileButton
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={handleLockOwner}
                  className="mt-2 flex items-center justify-center gap-1.5 font-bold text-xs"
                >
                  <Lock className="w-4 h-4 stroke-[2.5]" />
                  <span>Bloquear y Volver a Catálogo 🔒</span>
                </TactileButton>
              </TactileCard>
            )}
          </div>
        )}

        {/* Footer info & Términos y condiciones con acceso legal y acceso oculto */}
        <footer className="text-center py-4 text-slate-500 dark:text-slate-400 text-xs font-medium space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-bold">
            <span>{storeProfile.name}</span>
            <span>•</span>
            <span>{role === 'owner' ? 'Panel de Administración POS' : 'Catálogo Oficial'}</span>
            <span>•</span>
            <Heart className="w-3.5 h-3.5 text-bogad-coral fill-bogad-coral inline" />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            <button
              type="button"
              onClick={() => setIsTermsModalOpen(true)}
              className="underline hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer font-semibold"
            >
              Términos y condiciones legales
            </button>
            <span> • </span>
            <span
              onClick={handleSecretCondicionesClick}
              className="cursor-default select-none hover:text-slate-600 transition-colors"
              title="Acceso administrativo"
            >
              © {new Date().getFullYear()} {storeProfile.name}
            </span>
          </p>
        </footer>
      </main>

      {/* BOTÓN FLOTANTE FIJO (FAB) - Visible solo para el Dueño */}
      {role === 'owner' && (
        <ScannerFAB onClick={() => setIsScannerOpen(true)} />
      )}

      {/* MODAL DE ESCÁNER DE CÁMARA A PANTALLA COMPLETA */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        products={products}
        onClose={() => setIsScannerOpen(false)}
        onProductScanned={(prod) => {
          addToCart(prod);
        }}
        onProductRegistered={handleProductRegistered}
      />

      {/* MODAL DEL CARRITO / DETALLE DE COMPRA */}
      <CartModal
        isOpen={isCartOpen}
        items={items}
        totalPrice={totalPrice}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onClearCart={clearCart}
        onOpenGPSCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutModalOpen(true);
        }}
      />

      {/* MODAL CHECKOUT CLIENTE CON GPS OBLIGATORIO */}
      <CustomerCheckoutModal
        isOpen={isCheckoutModalOpen}
        items={items}
        totalPrice={totalPrice}
        storeProfile={storeProfile}
        onOpenTerms={() => setIsTermsModalOpen(true)}
        onClose={() => setIsCheckoutModalOpen(false)}
        onOrderCompleted={(newOrder) => {
          const updatedProducts = storageService.decrementStock(newOrder.items);
          setProducts(updatedProducts);
          clearCart();
          setStoreOrders(orderDispatchService.getOrders());
          setMyOrders(orderDispatchService.getMyOrders());
          setCurrentTab('my_orders');
        }}
      />

      {/* MODAL CONFIGURACIÓN DE PERFIL Y WHATSAPP DE LA BODEGA (Solo Dueño) */}
      <EditStoreProfileModal
        isOpen={isEditStoreModalOpen}
        onClose={() => setIsEditStoreModalOpen(false)}
        onProfileUpdated={(updated) => setStoreProfile(updated)}
      />

      {/* MODAL ESTUDIO DE MARCA BLANCA Y PERSONALIZACIÓN DE COLORES (Solo Dueño) */}
      <BrandCustomizerModal
        isOpen={isBrandCustomizerOpen}
        onClose={() => setIsBrandCustomizerOpen(false)}
        onProfileUpdated={(updated) => setStoreProfile(updated)}
      />

      {/* MODAL MÉTODOS DE PAGO COLOMBIA & VENEZUELA (Solo Dueño) */}
      <PaymentMethodsConfigModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onPaymentsUpdated={(updated) => setStoreProfile(updated)}
      />

      {/* MODAL DE CÓDIGO PIN DE SEGURIDAD (ACCESO DUEÑO OCULTO) */}
      <AdminPinModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        onSuccess={handleUnlockOwner}
      />

      {/* MODAL DE CARTEL QR Y COMPARTIR CATÁLOGO A CLIENTES CON QR REAL */}
      <StoreShareModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        storeProfile={storeProfile}
        onProfileUpdated={(updated) => setStoreProfile(updated)}
      />

      {/* MODAL DE TÉRMINOS Y CONDICIONES LEGALES */}
      <TermsAndConditionsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        storeProfile={storeProfile}
      />

      {/* BANNER / MODAL DE INSTALACIÓN PWA */}
      {!dismissInstall && !isInstalled && (
        <InstallPromptModal
          isInstallable={isInstallable}
          isIOS={isIOS}
          onInstall={promptInstall}
          onDismiss={() => setDismissInstall(true)}
        />
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR MOBILE-FIRST SEGÚN EL ROL */}
      <BottomNavigation
        currentTab={currentTab}
        role={role}
        cartCount={totalItems}
        debtorsCount={debtorsCount}
        onlineOrdersCount={pendingOrdersCount}
        customerOrdersCount={myOrders.length}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenCart={() => setIsCartOpen(true)}
      />
    </div>
  );
}

export default App;
