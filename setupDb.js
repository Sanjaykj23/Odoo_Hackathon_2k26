const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function ensureDatabaseExists() {
  require('dotenv').config();
  const dbName = process.env.DB_NAME || 'odoo cafe';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'root';
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432');

  console.log(`Connecting to database 'postgres' to verify if '${dbName}' database exists...`);
  
  const client = new Client({
    user,
    host,
    password,
    port,
    database: 'postgres', // connect to default maintenance db
  });

  try {
    await client.connect();
    
    // Check if database exists
    const checkDbRes = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (checkDbRes.rows.length === 0) {
      console.log(`Database '${dbName}' does not exist. Creating it now...`);
      // CREATE DATABASE cannot be executed in a transaction, and must run on a clean connection
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created successfully.`);
    } else {
      console.log(`Database '${dbName}' already exists.`);
    }
  } catch (err) {
    console.error('Error during database verification/creation:', err);
    throw err;
  } finally {
    await client.end();
  }
}

async function setup() {
  console.log('Starting Odoo Cafe POS database setup...');

  try {
    // 1. Ensure the target database exists
    await ensureDatabaseExists();

    // 2. Connect to the target database and run schema.sql
    const pool = require('./db');
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`Reading schema from ${schemaPath}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating tables...');
    await pool.query(schemaSql);
    console.log('Tables created successfully.');

    // 3. Seed Shops
    console.log('Seeding Shops...');
    const shopResult = await pool.query(
      `INSERT INTO shops (name, address, phone) 
       VALUES ('Odoo Cafe HQ', '123 Tech Park, Suite 100', '+1 (555) 019-2834') 
       RETURNING id`
    );
    const shopId = shopResult.rows[0].id;
    console.log(`Shop seeded with ID: ${shopId}`);

    // 4. Seed Users
    console.log('Seeding Users...');
    const superAdminHash = bcrypt.hashSync('superadmin123', 10);

    // Static SuperAdmin (Only user initially in database)
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, shop_id, is_active) 
       VALUES ('Super Admin', 'superadmin@odoocafe.com', $1, 'SuperAdmin', NULL, true)`,
      [superAdminHash]
    );
    console.log('Seeded Static SuperAdmin: superadmin@odoocafe.com / superadmin123');

    // 5. Seed Categories
    console.log('Seeding Categories...');
    const categories = [
      { id: 'meal', name: 'Meals', color: '#714B67' },
      { id: 'beverages', name: 'Beverages', color: '#0369a1' },
      { id: 'dessert', name: 'Desserts', color: '#b91c1c' },
      { id: 'chaat', name: 'Chaat', color: '#15803d' }
    ];

    for (const cat of categories) {
      await pool.query(
        `INSERT INTO categories (id, shop_id, name, color) VALUES ($1, $2, $3, $4)`,
        [cat.id, shopId, cat.name, cat.color]
      );
    }
    console.log('Categories seeded.');

    // 6. Seed Products
    console.log('Seeding Products...');
    const products = [
      {
        id: 'b1',
        name: 'Special Filter Coffee',
        price: 4.50,
        category: 'beverages',
        image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60',
        description: 'Traditional Indian style filter coffee.'
      },
      {
        id: 'b2',
        name: 'Masala Ginger Chai',
        price: 3.50,
        category: 'beverages',
        image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=60',
        description: 'Brewed black tea with aromatic spices and ginger.'
      },
      {
        id: 'b3',
        name: 'Sweet Mango Lassi',
        price: 5.00,
        category: 'beverages',
        image_url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=60',
        description: 'Creamy sweet yogurt drink flavored with mango.'
      },
      {
        id: 'b4',
        name: 'Rose Milk Shake',
        price: 5.50,
        category: 'beverages',
        image_url: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400&auto=format&fit=crop&q=60',
        description: 'Chilled milk mixed with sweet rose syrup.'
      },
      {
        id: 'm1',
        name: 'Sambar Vada (2 Pcs)',
        price: 7.50,
        category: 'meal',
        image_url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=60',
        description: 'Crispy fried lentil donuts soaked in hot sambar.'
      },
      {
        id: 'm2',
        name: 'Classic Masala Dosa',
        price: 9.99,
        category: 'meal',
        image_url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&auto=format&fit=crop&q=60',
        description: 'Crispy rice crepe filled with spiced potato mash.'
      },
      {
        id: 'm3',
        name: 'Paneer Tikka Roll',
        price: 11.50,
        category: 'meal',
        image_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=60',
        description: 'Tandoori paneer cubes wrapped in flatbread with green chutney.'
      },
      {
        id: 'm4',
        name: 'Odoo Cafe Special Burger',
        price: 12.99,
        category: 'meal',
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60',
        description: 'Gourmet house burger served with potato fries.'
      },
      {
        id: 'd1',
        name: 'Gulab Jamun (2 Pcs)',
        price: 4.99,
        category: 'dessert',
        image_url: 'https://images.unsplash.com/photo-1579616235489-cf210b4da67e?w=400&auto=format&fit=crop&q=60',
        description: 'Fried milk dumplings soaked in cardamom sugar syrup.'
      },
      {
        id: 'd2',
        name: 'Royal Rasmalai (2 Pcs)',
        price: 5.99,
        category: 'dessert',
        image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=60',
        description: 'Spongy cottage cheese patties in thickened saffron milk.'
      },
      {
        id: 'c1',
        name: 'Crispy Pani Puri',
        price: 6.50,
        category: 'chaat',
        image_url: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400&auto=format&fit=crop&q=60',
        description: 'Hollow crispy puris with spiced water, potatoes, and chickpeas.'
      },
      {
        id: 'c2',
        name: 'Delhi Samosa Chaat',
        price: 7.99,
        category: 'chaat',
        image_url: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&auto=format&fit=crop&q=60',
        description: 'Crushed samosas topped with spicy chole, sweet yogurt, and chutneys.'
      }
    ];

    for (const prod of products) {
      await pool.query(
        `INSERT INTO products (id, shop_id, category_id, name, price, description, image_url, is_available) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [prod.id, shopId, prod.category, prod.name, prod.price, prod.description, prod.image_url]
      );
    }
    console.log('Products seeded.');

    // 7. Seed Floor & Tables
    console.log('Seeding Floor & Tables...');
    const floorResult = await pool.query(
      `INSERT INTO floors (shop_id, name) VALUES ($1, 'Main Floor') RETURNING id`,
      [shopId]
    );
    const floorId = floorResult.rows[0].id;

    const tables = [
      { id: 'tbl-1', number: 1, capacity: 2, status: 'Occupied', qr_token: 'token_t1' },
      { id: 'tbl-2', number: 2, capacity: 4, status: 'Available', qr_token: 'token_t2' },
      { id: 'tbl-3', number: 3, capacity: 4, status: 'Reserved', qr_token: 'token_t3' },
      { id: 'tbl-4', number: 4, capacity: 6, status: 'Maintenance', qr_token: 'token_t4' },
      { id: 'tbl-5', number: 5, capacity: 2, status: 'Occupied', qr_token: 'token_t5' },
      { id: 'tbl-6', number: 6, capacity: 8, status: 'Available', qr_token: 'token_t6' }
    ];

    for (const t of tables) {
      await pool.query(
        `INSERT INTO tables (id, floor_id, table_number, seats, status, qr_token) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.id, floorId, t.number, t.capacity, t.status, t.qr_token]
      );
    }
    console.log('Floor and Tables seeded.');

    // 8. Seed Payment Methods
    console.log('Seeding Payment Methods...');
    await pool.query(
      `INSERT INTO payment_methods (shop_id, name, is_enabled, upi_id) VALUES 
       ($1, 'Cash', true, NULL),
       ($1, 'Card', true, NULL),
       ($1, 'UPI', true, 'odoocafe@ybl')`,
      [shopId]
    );
    console.log('Payment Methods seeded.');

    // 9. Seed Promotions & Coupons
    console.log('Seeding Promo Codes...');
    const promoCodes = [
      { code: 'WELCOME10', discountType: 'percentage', value: 10, active: true },
      { code: 'CAFE5', discountType: 'fixed', value: 5, active: true },
      { code: 'ODEEP', discountType: 'percentage', value: 20, active: true }
    ];

    for (const promo of promoCodes) {
      await pool.query(
        `INSERT INTO coupons_promotions (shop_id, type, code, discount_type, discount_value, is_active) 
         VALUES ($1, 'Coupon', $2, $3, $4, $5)`,
        [shopId, promo.code, promo.discountType, promo.value, promo.active]
      );
    }
    console.log('Promo Codes seeded.');

    console.log('Database setup and seeding completed successfully!');
    await pool.end();
  } catch (err) {
    console.error('Error during database setup:', err);
    process.exit(1);
  }
}

setup();
