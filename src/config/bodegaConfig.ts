import { StoreProfile } from '../types';

/**
 * CONFIGURACIÓN CENTRAL DE LA BODEGA / ESTABLECIMIENTO (MARCA BLANCA)
 * Modifica aquí los valores iniciales. Además, se pueden personalizar
 * directamente desde la app en tiempo real.
 */

export const BODEGA_CONFIG: StoreProfile = {
  // 1. Identificador único de Tienda (SaaS / Multi-Tenant por URL ?tienda=slug)
  slug: (import.meta.env.VITE_STORE_SLUG as string) || 'bodega-jl',

  // 2. Identidad de Marca
  name: (import.meta.env.VITE_BODEGA_NAME as string) || 'Bodega JL',
  slogan: (import.meta.env.VITE_BODEGA_SLOGAN as string) || 'Tu tienda de confianza en el barrio',
  iconEmoji: (import.meta.env.VITE_BODEGA_EMOJI as string) || '🏪',
  currencySymbol: (import.meta.env.VITE_BODEGA_CURRENCY as string) || '$',

  // 3. Contacto y Despacho WhatsApp
  whatsappNumber: (import.meta.env.VITE_BODEGA_WHATSAPP as string) || '573227949751',
  phoneDisplay: (import.meta.env.VITE_BODEGA_PHONE_DISPLAY as string) || '573227949751',
  address: (import.meta.env.VITE_BODEGA_ADDRESS as string) || 'Aguas calientes calle 3',
  schedule: 'Lunes a Domingo: 7:00 AM - 10:00 PM',
  catalogUrl: (import.meta.env.VITE_CATALOG_URL as string) || 'https://bodega-jl.onrender.com',
  deliveryFee: Number(import.meta.env.VITE_BODEGA_DELIVERY_FEE) || 6.00,
  pedigochosPhone: (import.meta.env.VITE_PEDIGOCHOS_PHONE as string) || '573227949751',

  // 4. Paleta de Colores por Defecto (Bodega Pop)
  theme: {
    presetId: 'yellow',
    primaryColor: '#FFE600',
    secondaryColor: '#D2FF00',
    accentColor: '#FF5C38',
    cyanColor: '#00F0FF'
  },

  // 5. Métodos de Pago Habilitados (Colombia & Venezuela)
  payments: {
    cash: { enabled: true },
    colombia: {
      nequi: {
        enabled: true,
        phone: '3001234567',
        holderName: 'Carlos Pérez'
      },
      bancolombia: {
        enabled: true,
        accountNumber: '123-456789-01',
        accountType: 'ahorros',
        holderName: 'Carlos Pérez'
      }
    },
    venezuela: {
      bdv: {
        enabled: true,
        phone: '04121234567',
        idNumber: 'V-12345678',
        bankCode: '0102', // Banco de Venezuela
        holderName: 'Carlos Pérez'
      },
      banesco: {
        enabled: true,
        phone: '04141234567',
        idNumber: 'V-12345678',
        bankCode: '0134', // Banesco
        holderName: 'Carlos Pérez'
      },
      bnc: {
        enabled: true,
        phone: '04241234567',
        idNumber: 'V-12345678',
        bankCode: '0191', // Banco Nacional de Crédito
        holderName: 'Carlos Pérez'
      }
    }
  }
};
