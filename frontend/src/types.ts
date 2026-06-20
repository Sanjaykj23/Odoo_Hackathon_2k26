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
  orderStatus?: 'Draft' | 'Paid' | 'Cancelled';
  createdAt: string; // ISO String
  elapsed: number; // minutes elapsed
  total: number;
  customer?: string;
  promoCode?: string;
  discount: number; // total discount in currency
  notes?: string;
  tableNumber?: number;
}


export interface SeatingTable {
  id: string;
  number: number;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';
  floor_id?: number;
  floor_name?: string;
  qr_token?: string;  // the unique QR scan token
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
  is_active?: boolean;
}

export interface Shop {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Floor {
  id: number;
  shop_id: number;
  name: string;
}

export interface Payment {
  id: number;
  order_id: string;
  amount: number;
  payment_method: string;
  transaction_ref?: string;
  status: string;
  created_at: string;
}

export interface Session {
  id: number;
  shop_id: number;
  opened_by_user_id: number;
  opening_date: string;
  closing_date?: string;
  closing_sale_amount: number;
  status: 'Open' | 'Closed';
  employee_name?: string;
}

