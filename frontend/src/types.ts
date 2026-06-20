export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
  popularity: number; // 1-5 rating
  costIndex: number; // 1-3 ($, $$, $$$)
  country: string; // Origin
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  product: Product;
  quantity: number;
  fulfilled?: boolean;
}

export interface Order {
  id: string;
  ticketNumber: string;
  items: OrderItem[];
  status: 'To Cook' | 'Preparing' | 'Completed';
  createdAt: string; // ISO String
  elapsed: number; // minutes elapsed
  total: number;
  customer?: string;
  promoCode?: string;
  discount: number; // total discount in currency
  notes?: string;
}

export interface SeatingTable {
  id: string;
  number: number;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';
}

export interface PromoCode {
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string; // hex code or tailwind color
}
