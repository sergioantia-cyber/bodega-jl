-- =========================================================
-- BOGAD: ESQUEMA DE BASE DE DATOS EN LA NUBE (SUPABASE)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- =========================================================

-- 1. Tabla de Productos e Inventario
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    original_price NUMERIC(10,2),
    unit TEXT DEFAULT 'Unidad',
    image TEXT,
    tag TEXT,
    in_stock BOOLEAN DEFAULT true,
    stock INTEGER DEFAULT 10,
    min_stock INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Clientes y Libreta de Fiados
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    debt NUMERIC(10,2) DEFAULT 0.00,
    last_payment_date TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Pedidos Online con Despacho GPS (Sincronización en Tiempo Real)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    gps_location JSONB NOT NULL,
    reference_notes TEXT,
    items JSONB NOT NULL,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de Ventas en Caja POS
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT now(),
    items JSONB NOT NULL,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL,
    received_amount NUMERIC(10,2),
    change_amount NUMERIC(10,2),
    customer_id TEXT,
    customer_name TEXT
);

-- 5. Tabla de Cierres de Caja Diarios (Reporte Z)
CREATE TABLE IF NOT EXISTS daily_closings (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    sales_count INTEGER DEFAULT 0,
    total_sales NUMERIC(10,2) DEFAULT 0.00,
    cash_sales NUMERIC(10,2) DEFAULT 0.00,
    transfer_sales NUMERIC(10,2) DEFAULT 0.00,
    credit_sales NUMERIC(10,2) DEFAULT 0.00,
    debt_repayments_collected NUMERIC(10,2) DEFAULT 0.00,
    expected_cash_in_drawer NUMERIC(10,2) DEFAULT 0.00,
    notes TEXT
);

-- 6. Tabla de Perfil de la Tienda y Métodos de Pago
CREATE TABLE IF NOT EXISTS store_profiles (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL,
    slogan TEXT,
    icon_emoji TEXT,
    currency_symbol TEXT DEFAULT '$',
    whatsapp_number TEXT NOT NULL,
    phone_display TEXT,
    address TEXT,
    schedule TEXT,
    delivery_fee NUMERIC(10,2) DEFAULT 2.00,
    catalog_url TEXT,
    pedigochos_phone TEXT DEFAULT '573227949751',
    theme JSONB,
    payments JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================
-- MIGRACIÓN / COMPATIBILIDAD MULTI-TIENDA (SaaS)
-- =========================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'bodega-jl';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'bodega-jl';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'bodega-jl';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'bodega-jl';
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'bodega-jl';

-- Índices de búsqueda optimizados por tienda
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);

-- =========================================================
-- SEGURIDAD (RLS) Y PUBLICACIÓN EN TIEMPO REAL
-- =========================================================

-- Habilitar RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público anónimo (idempotentes con DROP IF EXISTS)
DROP POLICY IF EXISTS "Permitir todo en products para anon" ON products;
CREATE POLICY "Permitir todo en products para anon" ON products FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en customers para anon" ON customers;
CREATE POLICY "Permitir todo en customers para anon" ON customers FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en orders para anon" ON orders;
CREATE POLICY "Permitir todo en orders para anon" ON orders FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en sales para anon" ON sales;
CREATE POLICY "Permitir todo en sales para anon" ON sales FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en daily_closings para anon" ON daily_closings;
CREATE POLICY "Permitir todo en daily_closings para anon" ON daily_closings FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo en store_profiles para anon" ON store_profiles;
CREATE POLICY "Permitir todo en store_profiles para anon" ON store_profiles FOR ALL TO anon USING (true) WITH CHECK (true);

-- Habilitar SUPABASE REALTIME de forma segura (sin fallar si ya está agregada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'store_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE store_profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;
END $$;
