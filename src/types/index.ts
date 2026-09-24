export interface Product {
  id: string;
  barcode?: string;
  name: string;
  category: 'bebidas' | 'snacks' | 'despensa' | 'lacteos' | 'limpieza';
  price: number;
  originalPrice?: number;
  unit: string;
  image: string;
  tag?: string;
  inStock: boolean;
  stock: number; // Cantidad disponible
  minStock: number; // Alerta de stock bajo
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  bgAccent: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  debt: number; // Positivo = debe dinero a la bodega; Negativo = tiene saldo a favor
  lastPaymentDate?: string;
  notes?: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'credit';
export type UserRole = 'owner' | 'customer';

export interface Sale {
  id: string;
  timestamp: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  receivedAmount?: number;
  changeAmount?: number;
  customerId?: string;
  customerName?: string;
}

export interface DailyClosingReport {
  id: string;
  date: string;
  timestamp: string;
  salesCount: number;
  totalSales: number;
  cashSales: number;
  transferSales: number;
  creditSales: number;
  debtRepaymentsCollected: number;
  expectedCashInDrawer: number;
  notes?: string;
}

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  mapsUrl: string;
  timestamp?: number;
}

export type OrderStatus = 'pending' | 'accepted' | 'delivering' | 'delivered' | 'cancelled';
export type OrderDeliveryType = 'delivery' | 'local';

export type PaymentMethodKey = 'cash' | 'nequi' | 'bancolombia' | 'bdv' | 'banesco' | 'bnc' | 'yape' | 'plin';

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  gpsLocation: GPSLocation;
  referenceNotes?: string;
  items: CartItem[];
  subtotal?: number;
  deliveryFee?: number;
  deliveryType?: OrderDeliveryType;
  total: number;
  paymentMethod: PaymentMethodKey | string;
  status: OrderStatus;
  createdAt: string;
  storeId?: string;
  paymentReceipt?: string;
}

export interface PWAInstallPrompt {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<void>;
}

export type ThemePresetId = 'yellow' | 'emerald' | 'blue' | 'red' | 'purple' | 'orange' | 'custom';

export interface StoreBrandTheme {
  presetId: ThemePresetId;
  primaryColor: string;    // Var --color-bogad-yellow
  secondaryColor: string;  // Var --color-bogad-lime
  accentColor: string;     // Var --color-bogad-coral
  cyanColor: string;       // Var --color-bogad-cyan
}

export interface BrandPreset {
  id: ThemePresetId;
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  cyanColor: string;
}

export interface ColombiaPayments {
  nequi: { enabled: boolean; phone: string; holderName: string };
  bancolombia: { enabled: boolean; accountNumber: string; accountType: 'ahorros' | 'corriente'; holderName: string };
}

export interface VenezuelaPayments {
  bdv: { enabled: boolean; phone: string; idNumber: string; bankCode: string; holderName: string }; // Banco de Venezuela (0102)
  banesco: { enabled: boolean; phone: string; idNumber: string; bankCode: string; holderName: string }; // Banesco (0134)
  bnc: { enabled: boolean; phone: string; idNumber: string; bankCode: string; holderName: string }; // Banco Nacional de Crédito (0191)
}

export interface StorePaymentConfig {
  cash: { enabled: boolean };
  colombia: ColombiaPayments;
  venezuela: VenezuelaPayments;
}

export interface StoreProfile {
  slug: string;
  name: string;
  slogan: string;
  iconEmoji: string;
  currencySymbol: string;
  whatsappNumber: string;
  phoneDisplay: string;
  address: string;
  schedule: string;
  catalogUrl?: string;
  deliveryFee?: number;
  pedigochosPhone?: string;
  theme: StoreBrandTheme;
  payments: StorePaymentConfig;
}

