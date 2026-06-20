import type { Product, Category, Order, SeatingTable, PromoCode } from './types';

export const initialCategories: Category[] = [
  { id: 'all', name: 'All Items', color: '#1e3a8a' },
  { id: 'meal', name: 'Meals', color: '#714B67' },
  { id: 'beverages', name: 'Beverages', color: '#0369a1' },
  { id: 'dessert', name: 'Desserts', color: '#b91c1c' },
  { id: 'chaat', name: 'Chaat', color: '#15803d' },
];

export const initialProducts: Product[] = [
  // Beverages
  {
    id: 'b1',
    name: 'Special Filter Coffee',
    price: 4.50,
    category: 'beverages',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 5,
    costIndex: 1,
    country: 'India',
  },
  {
    id: 'b2',
    name: 'Masala Ginger Chai',
    price: 3.50,
    category: 'beverages',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 5,
    costIndex: 1,
    country: 'India',
  },
  {
    id: 'b3',
    name: 'Sweet Mango Lassi',
    price: 5.00,
    category: 'beverages',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 4,
    costIndex: 2,
    country: 'India',
  },
  {
    id: 'b4',
    name: 'Rose Milk Shake',
    price: 5.50,
    category: 'beverages',
    image: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 3,
    costIndex: 2,
    country: 'India',
  },

  // Meals
  {
    id: 'm1',
    name: 'Sambar Vada (2 Pcs)',
    price: 7.50,
    category: 'meal',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 4,
    costIndex: 2,
    country: 'India',
  },
  {
    id: 'm2',
    name: 'Classic Masala Dosa',
    price: 9.99,
    category: 'meal',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 5,
    costIndex: 2,
    country: 'India',
  },
  {
    id: 'm3',
    name: 'Paneer Tikka Roll',
    price: 11.50,
    category: 'meal',
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 4,
    costIndex: 3,
    country: 'India',
  },
  {
    id: 'm4',
    name: 'Odoo Cafe Special Burger',
    price: 12.99,
    category: 'meal',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 5,
    costIndex: 3,
    country: 'USA',
  },

  // Desserts
  {
    id: 'd1',
    name: 'Gulab Jamun (2 Pcs)',
    price: 4.99,
    category: 'dessert',
    image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 5,
    costIndex: 1,
    country: 'India',
  },
  {
    id: 'd2',
    name: 'Royal Rasmalai (2 Pcs)',
    price: 5.99,
    category: 'dessert',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 5,
    costIndex: 2,
    country: 'India',
  },
  {
    id: 'd3',
    name: 'Warm Chocolate Brownie',
    price: 7.00,
    category: 'dessert',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&auto=format&fit=crop&q=60',
    available: false,
    popularity: 4,
    costIndex: 3,
    country: 'France',
  },

  // Chaat
  {
    id: 'c1',
    name: 'Crispy Pani Puri',
    price: 6.50,
    category: 'chaat',
    image: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 5,
    costIndex: 1,
    country: 'India',
  },
  {
    id: 'c2',
    name: 'Delhi Samosa Chaat',
    price: 7.99,
    category: 'chaat',
    image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400&auto=format&fit=crop&q=60',
    available: true,
    popularity: 4,
    costIndex: 2,
    country: 'India',
  },
];

export const initialOrders: Order[] = [
  {
    id: 'o-101',
    ticketNumber: 'T-101',
    items: [
      { product: initialProducts[4], quantity: 2, fulfilled: false }, // Sambar Vada
      { product: initialProducts[0], quantity: 2, fulfilled: true },  // Filter Coffee
    ],
    status: 'To Cook',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    elapsed: 12,
    total: 24.00,
    customer: 'Rohit Sharma',
    discount: 0,
    notes: 'Coffee needs to be extra hot',
  },
  {
    id: 'o-102',
    ticketNumber: 'T-102',
    items: [
      { product: initialProducts[5], quantity: 1, fulfilled: false }, // Masala Dosa
      { product: initialProducts[2], quantity: 1, fulfilled: false }, // Mango Lassi
      { product: initialProducts[8], quantity: 1, fulfilled: false }, // Gulab Jamun
    ],
    status: 'Preparing',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    elapsed: 5,
    total: 19.98,
    customer: 'Jane Smith',
    discount: 2.00,
    promoCode: 'CAFE10',
    notes: 'No onions in Dosa please',
  },
  {
    id: 'o-103',
    ticketNumber: 'T-103',
    items: [
      { product: initialProducts[7], quantity: 2, fulfilled: true },  // Special Burger
      { product: initialProducts[3], quantity: 2, fulfilled: true },  // Rose Milk Shake
    ],
    status: 'Completed',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    elapsed: 25,
    total: 36.98,
    customer: 'Alice Green',
    discount: 0,
  }
];

export const initialTables: SeatingTable[] = [
  { id: 'tbl-1', number: 1, capacity: 2, status: 'Occupied' },
  { id: 'tbl-2', number: 2, capacity: 4, status: 'Available' },
  { id: 'tbl-3', number: 3, capacity: 4, status: 'Reserved' },
  { id: 'tbl-4', number: 4, capacity: 6, status: 'Available' },
  { id: 'tbl-5', number: 5, capacity: 2, status: 'Occupied' },
  { id: 'tbl-6', number: 6, capacity: 8, status: 'Available' },
];

export const initialPromoCodes: PromoCode[] = [
  { code: 'WELCOME10', discountType: 'percentage', value: 10, active: true },
  { code: 'CAFE5', discountType: 'fixed', value: 5, active: true },
  { code: 'ODEEP', discountType: 'percentage', value: 20, active: true },
  { code: 'EXPIRED25', discountType: 'percentage', value: 25, active: false },
];
