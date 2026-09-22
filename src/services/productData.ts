import { Product, Category } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'todos', name: 'Todos', emoji: '🏪', bgAccent: 'bg-bogad-yellow' },
  { id: 'bebidas', name: 'Bebidas', emoji: '🥤', bgAccent: 'bg-bogad-cyan' },
  { id: 'snacks', name: 'Snacks', emoji: '🍿', bgAccent: 'bg-bogad-coral' },
  { id: 'despensa', name: 'Despensa', emoji: '🥫', bgAccent: 'bg-bogad-lime' },
  { id: 'lacteos', name: 'Lácteos', emoji: '🧀', bgAccent: 'bg-bogad-purple' },
  { id: 'limpieza', name: 'Limpieza', emoji: '🧼', bgAccent: 'bg-emerald-400' }
];

/**
 * Ordenamiento determinista y 100% estable para el catálogo.
 * Evita que los productos salten o cambien de lugar al azar cuando
 * se actualiza el stock, se hace una compra o Supabase Realtime sincroniza.
 */
export function sortProducts(products: Product[]): Product[] {
  if (!products || !Array.isArray(products)) return [];
  return [...products].sort((a, b) => {
    // 1. Si ambos tienen formato p-X, ordenar numéricamente (p-1, p-2, ..., p-10)
    const matchA = a.id.match(/^p-(\d+)$/);
    const matchB = b.id.match(/^p-(\d+)$/);
    if (matchA && matchB) {
      return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
    }
    if (matchA && !matchB) return -1;
    if (!matchA && matchB) return 1;

    // 2. Si son productos con timestamps o números en el ID
    const numA = parseInt(a.id.replace(/\D/g, ''), 10);
    const numB = parseInt(b.id.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }

    // 3. Fallback alfabético por nombre
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p-1',
    barcode: '7751234567890',
    name: 'Gaseosa Cola 1.5L Refrescante',
    category: 'bebidas',
    price: 2.20,
    originalPrice: 2.50,
    unit: 'Botella 1.5L',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80',
    tag: 'OFERTA',
    inStock: true,
    stock: 12,
    minStock: 4
  },
  {
    id: 'p-2',
    barcode: '7759876543210',
    name: 'Papas Fritas Onduladas Sal Marina',
    category: 'snacks',
    price: 1.50,
    unit: 'Bolsa 140g',
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80',
    tag: 'TOP',
    inStock: true,
    stock: 8,
    minStock: 3
  },
  {
    id: 'p-3',
    barcode: '7753344556677',
    name: 'Leche Entera Cremosa Pasteurizada',
    category: 'lacteos',
    price: 1.80,
    unit: 'Tetrapack 1L',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80',
    inStock: true,
    stock: 2, // Alerta stock bajo
    minStock: 5
  },
  {
    id: 'p-4',
    barcode: '7754455667788',
    name: 'Arroz Extra Selección Grano Largo',
    category: 'despensa',
    price: 1.30,
    unit: 'Bolsa 1kg',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
    inStock: true,
    stock: 20,
    minStock: 5
  },
  {
    id: 'p-5',
    barcode: '7755566778899',
    name: 'Aceite Vegetal Puro para Cocina',
    category: 'despensa',
    price: 3.40,
    originalPrice: 3.80,
    unit: 'Botella 900ml',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80',
    tag: 'OFERTA',
    inStock: true,
    stock: 1, // Alerta stock bajo
    minStock: 3
  },
  {
    id: 'p-6',
    barcode: '7756677889900',
    name: 'Agua Mineral de Manantial sin Gas',
    category: 'bebidas',
    price: 0.90,
    unit: 'Botella 625ml',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80',
    inStock: true,
    stock: 15,
    minStock: 4
  },
  {
    id: 'p-7',
    barcode: '7757788990011',
    name: 'Detergente Líquido Aroma Fresco',
    category: 'limpieza',
    price: 4.20,
    unit: 'Doypack 850ml',
    image: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&auto=format&fit=crop&q=80',
    inStock: true,
    stock: 6,
    minStock: 2
  },
  {
    id: 'p-8',
    barcode: '7758899001122',
    name: 'Galletas Rellenas de Chocolate',
    category: 'snacks',
    price: 0.80,
    unit: 'Paquete 6 unidades',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80',
    tag: 'RÁPIDO',
    inStock: false,
    stock: 0, // Agotado
    minStock: 4
  }
];
