import React, { useState, useMemo } from 'react';
import { Search, Package, AlertTriangle, XCircle, Plus, Edit3, Barcode, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { TactileCard } from './ui/TactileCard';
import { TactileButton } from './ui/TactileButton';
import { VoiceSearchButton } from './VoiceSearchButton';
import { EditProductModal } from './EditProductModal';
import { CATEGORIES, sortProducts } from '../services/productData';

interface OwnerCatalogViewProps {
  products: Product[];
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  onOpenScanner: () => void;
}

export const OwnerCatalogView: React.FC<OwnerCatalogViewProps> = ({
  products,
  onUpdateProduct,
  onDeleteProduct,
  onAddToCart,
  onOpenScanner
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [filterMode, setFilterMode] = useState<'all' | 'low_stock' | 'out_of_stock' | 'offers'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Métricas de inventario para el dueño
  const metrics = useMemo(() => {
    const total = products.length;
    const outOfStock = products.filter(p => p.stock <= 0 || !p.inStock).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 3)).length;
    const offers = products.filter(p => p.tag === 'OFERTA' || Boolean(p.originalPrice)).length;

    return { total, outOfStock, lowStock, offers };
  }, [products]);

  // Filtrado reactivo de productos
  const filteredProducts = useMemo(() => {
    let list = products;

    // Filtros rápidos de estado de inventario
    if (filterMode === 'low_stock') {
      list = list.filter(p => p.stock > 0 && p.stock <= (p.minStock || 3));
    } else if (filterMode === 'out_of_stock') {
      list = list.filter(p => p.stock <= 0 || !p.inStock);
    } else if (filterMode === 'offers') {
      list = list.filter(p => p.tag === 'OFERTA' || Boolean(p.originalPrice));
    }

    // Filtro por categoría
    if (selectedCategory !== 'todos') {
      list = list.filter(p => p.category === selectedCategory);
    }

    // Búsqueda por texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
      );
    }

    return sortProducts(list);
  }, [products, filterMode, selectedCategory, searchQuery]);

  return (
    <div className="space-y-3 pb-12 animate-in fade-in duration-200">
      {/* Banner de Control de Inventario para el Dueño */}
      <TactileCard variant="yellow" className="p-4 space-y-2 shadow-tactile border-2 border-slate-950">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border-2 border-slate-950 rounded-lg text-[10px] font-black uppercase shadow-tactile-sm text-slate-950">
            <Package className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Gestión de Inventario y Precios</span>
          </div>

          <TactileButton
            variant="lime"
            size="sm"
            onClick={onOpenScanner}
            className="flex items-center gap-1 text-xs font-black shadow-tactile-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Escanear / Nuevo</span>
          </TactileButton>
        </div>

        <div>
          <h2 className="text-xl font-black text-slate-950 leading-tight">
            Catálogo del Dueño
          </h2>
          <p className="text-xs font-bold text-slate-800">
            Presiona cualquier producto para ver sus detalles y modificar precios, stock, código o nombre.
          </p>
        </div>

        {/* Chips de Resumen Rápido y Filtro con 1 Clic */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setFilterMode(filterMode === 'all' ? 'all' : 'all')}
            className={`p-2 rounded-xl border-2 border-slate-900 text-left transition-all ${
              filterMode === 'all'
                ? 'bg-white text-slate-950 shadow-tactile-sm -translate-y-0.5'
                : 'bg-white/60 text-slate-700 active:translate-y-0.5'
            }`}
          >
            <span className="text-[10px] font-black uppercase block text-slate-600">Total Items</span>
            <span className="text-lg font-black text-slate-950">{metrics.total}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode(filterMode === 'low_stock' ? 'all' : 'low_stock')}
            className={`p-2 rounded-xl border-2 border-slate-900 text-left transition-all ${
              filterMode === 'low_stock'
                ? 'bg-amber-400 text-slate-950 shadow-tactile-sm -translate-y-0.5'
                : 'bg-amber-100 text-amber-950 active:translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-900">Stock Bajo</span>
              <AlertTriangle className="w-3 h-3 text-amber-900" />
            </div>
            <span className="text-lg font-black text-amber-950">{metrics.lowStock}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode(filterMode === 'out_of_stock' ? 'all' : 'out_of_stock')}
            className={`p-2 rounded-xl border-2 border-slate-900 text-left transition-all ${
              filterMode === 'out_of_stock'
                ? 'bg-rose-500 text-white shadow-tactile-sm -translate-y-0.5'
                : 'bg-rose-100 text-rose-950 active:translate-y-0.5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-rose-900">Agotados</span>
              <XCircle className="w-3 h-3 text-rose-900" />
            </div>
            <span className="text-lg font-black text-rose-950">{metrics.outOfStock}</span>
          </button>
        </div>
      </TactileCard>

      {/* Buscador Táctil con Reconocimiento de Voz */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-700 dark:text-slate-300">
            <Search className="w-4 h-4 stroke-[2.5]" />
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, código de barras..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-bold shadow-tactile-sm focus:outline-none focus:ring-2 focus:ring-bogad-yellow"
          />
        </div>
        <VoiceSearchButton onTranscript={(term: string) => setSearchQuery(term)} />
      </div>

      {/* Carrusel de Categorías */}
      <div className="flex gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar -mx-4 px-4">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-slate-900 font-extrabold text-xs transition-all select-none ${
                isSelected
                  ? `${cat.bgAccent} text-slate-950 shadow-tactile -translate-y-0.5`
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-tactile-sm active:translate-y-0.5'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Conteo de Resultados y Modo de Filtro */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Inventario ({filteredProducts.length} productos)
        </span>
        {filterMode !== 'all' && (
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className="text-[11px] font-extrabold text-bogad-coral underline"
          >
            Quitar filtro de alertas
          </button>
        )}
      </div>

      {/* Listado de Productos - Tarjetas de Gestión para el Dueño */}
      {filteredProducts.length === 0 ? (
        <TactileCard className="text-center py-10">
          <p className="font-extrabold text-sm text-slate-900 dark:text-white">
            No hay productos que coincidan
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Revisa el filtro aplicado o registra un producto nuevo con el escáner.
          </p>
          <TactileButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('todos');
              setFilterMode('all');
            }}
            className="mt-3"
          >
            Restablecer todos los filtros
          </TactileButton>
        </TactileCard>
      ) : (
        <div className="space-y-2.5">
          {filteredProducts.map((product) => {
            const isOutOfStock = product.stock <= 0 || !product.inStock;
            const isLowStock = !isOutOfStock && product.stock <= (product.minStock || 3);

            return (
              <TactileCard
                key={product.id}
                onClick={() => setEditingProduct(product)}
                className="p-3 border-2 border-slate-900 shadow-tactile transition-all hover:bg-slate-50 dark:hover:bg-slate-800/90 cursor-pointer relative"
              >
                <div className="flex items-center gap-3">
                  {/* Foto miniatura con badge de categoría */}
                  <div className="w-16 h-16 rounded-xl border-2 border-slate-900 bg-slate-100 overflow-hidden shrink-0 relative shadow-tactile-sm">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    {product.tag && (
                      <span className="absolute bottom-0 inset-x-0 bg-bogad-yellow text-slate-950 font-black text-[9px] text-center uppercase py-0.5">
                        {product.tag}
                      </span>
                    )}
                  </div>

                  {/* Datos principales del producto */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-sm font-black text-slate-950 dark:text-white truncate leading-tight">
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {product.barcode ? (
                        <span className="flex items-center gap-1 font-mono">
                          <Barcode className="w-3 h-3 text-slate-700" />
                          {product.barcode}
                        </span>
                      ) : (
                        <span className="italic text-[10px]">Sin código</span>
                      )}
                      <span>•</span>
                      <span>{product.unit}</span>
                    </div>

                    {/* Fila de Precio y Stock */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-black text-slate-950 dark:text-white">
                          ${product.price.toFixed(2)}
                        </span>
                        {product.originalPrice && (
                          <span className="text-xs font-bold line-through text-slate-400">
                            ${product.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Badge de Stock interactivo */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-950 font-black text-[11px] shadow-tactile-sm ${
                          isOutOfStock
                            ? 'bg-bogad-coral text-white'
                            : isLowStock
                            ? 'bg-amber-400 text-slate-950 animate-pulse'
                            : 'bg-bogad-lime text-slate-950'
                        }`}
                      >
                        {isOutOfStock ? (
                          <span>Agotado (0)</span>
                        ) : isLowStock ? (
                          <span>Pocas ({product.stock})</span>
                        ) : (
                          <span>Stock: {product.stock}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Barra de Acciones Rápidas para el Dueño */}
                <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    Toca para editar ficha
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onAddToCart(product)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-950 rounded-lg border border-slate-900 text-xs font-black flex items-center gap-1 shadow-tactile-sm active:translate-y-0.5"
                      title="Agregar a la canasta de venta en caja"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>A Caja</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingProduct(product)}
                      className="px-2.5 py-1 bg-bogad-yellow hover:bg-yellow-300 text-slate-950 rounded-lg border border-slate-900 text-xs font-black flex items-center gap-1 shadow-tactile-sm active:translate-y-0.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Modificar</span>
                    </button>
                  </div>
                </div>
              </TactileCard>
            );
          })}
        </div>
      )}

      {/* Modal Completo de Edición de Datos */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          isOpen={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          onSave={(updated: Product) => {
            onUpdateProduct(updated);
            setEditingProduct(null);
          }}
          onDelete={(id: string) => {
            onDeleteProduct(id);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
};
