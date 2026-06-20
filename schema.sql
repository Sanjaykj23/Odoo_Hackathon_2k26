-- Odoo Cafe POS Schema DDL

-- Drop tables if they exist (for reset/re-initialization)
DROP TABLE IF EXISTS jwt_tokens CASCADE;
DROP TABLE IF EXISTS kitchen_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS coupons_promotions CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS floors CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- 1. Shops Table
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (SuperAdmin, Admin, Employee, Chef)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SuperAdmin', 'Admin', 'Employee', 'Chef')),
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Categories Table
CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY, -- Using string IDs like 'beverages', 'meal' to align with frontend types
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50) NOT NULL DEFAULT '#714B67',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table
CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY, -- Using string IDs like 'b1', 'm1' to match frontend Typescript types
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    category_id VARCHAR(50) REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    uom VARCHAR(50) NOT NULL DEFAULT 'per piece',
    tax DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    description TEXT,
    image_url VARCHAR(512),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Floors Table
CREATE TABLE floors (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tables Table (Individual seating tables)
CREATE TABLE tables (
    id VARCHAR(50) PRIMARY KEY, -- E.g. 'tbl-1' to match frontend SeatingTable type
    floor_id INT REFERENCES floors(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    seats INT NOT NULL DEFAULT 2,
    status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Reserved', 'Maintenance')),
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- JWT Tokens Table (Stores active sessions)
CREATE TABLE jwt_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- 7. Payment Methods Table
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL CHECK (name IN ('Cash', 'Card', 'UPI')),
    is_enabled BOOLEAN DEFAULT TRUE,
    upi_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Coupons and Promotions Table
CREATE TABLE coupons_promotions (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Coupon', 'ProductPromo', 'OrderPromo')),
    code VARCHAR(100) UNIQUE,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL,
    min_quantity INT,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    min_order_amount DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Sessions Table
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    opened_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    opening_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closing_date TIMESTAMP,
    closing_sale_amount DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Closed'))
);

-- 10. Customers Table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Orders Table
CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY, -- matches 'o-xxxxxx' format
    order_number VARCHAR(100) UNIQUE NOT NULL,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    session_id INT REFERENCES sessions(id) ON DELETE SET NULL,
    employee_id INT REFERENCES users(id) ON DELETE SET NULL,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    table_id VARCHAR(50) REFERENCES tables(id) ON DELETE SET NULL,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Paid', 'Cancelled')),
    kds_status VARCHAR(50) DEFAULT 'To Cook' CHECK (kds_status IN ('To Cook', 'Preparing', 'Completed')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Order Items Table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    line_total DECIMAL(10, 2) NOT NULL,
    fulfilled BOOLEAN DEFAULT FALSE
);

-- 13. Payments Table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL, -- Cash, Card, UPI
    transaction_ref VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Kitchen Logs Table (Tracks order status changes)
CREATE TABLE kitchen_logs (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE SET NULL,
    previous_stage VARCHAR(50),
    new_stage VARCHAR(50) NOT NULL,
    updated_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

