import { useState, useEffect } from 'react';
import type { Product, Category, SeatingTable, PromoCode, Order, CartItem } from './types';
import { POSView } from './components/pos/POSView';
import { KDSView } from './components/kds/KDSView';
import { AdminView } from './components/admin/AdminView';
import { LoginView } from './components/auth/LoginView';
import { Coffee, Server, Clock } from 'lucide-react';

function App() {
  // Authentication States
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(JSON.parse(localStorage.getItem('user') || 'null'));

  // App-level Shared States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Active View switching
  const [activeView, setActiveView] = useState<string>('products');

  // Time tracker for visual detail
  const [currentTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  // Handle successful login
  const handleLoginSuccess = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));

    // Redirect based on role
    if (newUser.role === 'Chef') {
      setActiveView('kds');
    } else if (['SuperAdmin', 'Admin'].includes(newUser.role)) {
      setActiveView('admin');
    } else {
      setActiveView('products');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setActiveView('products');
  };

  // Load data from Backend API when logged in
  useEffect(() => {
    if (!token) return;

    const headers = { 'Authorization': `Bearer ${token}` };

    const fetchAllData = async () => {
      try {
        // Fetch Products
        const prodRes = await fetch('http://localhost:5000/api/products', { headers });
        const prodData = await prodRes.json();
        if (Array.isArray(prodData)) {
          const mapped = prodData.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            category: p.category_id,
            image: p.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60',
            available: p.is_available,
            popularity: 4,
            costIndex: 2,
            country: 'India'
          }));
          setProducts(mapped);
        }

        // Fetch Categories
        const catRes = await fetch('http://localhost:5000/api/categories', { headers });
        const catData = await catRes.json();
        if (Array.isArray(catData)) {
          setCategories(catData);
        }

        // Fetch Tables
        const tableRes = await fetch('http://localhost:5000/api/tables', { headers });
        const tableData = await tableRes.json();
        if (Array.isArray(tableData)) {
          const mapped = tableData.map((t: any) => ({
            id: t.id,
            number: t.table_number,
            capacity: t.seats,
            status: t.status
          }));
          setTables(mapped);
        }

        // Fetch Promo Codes
        const promoRes = await fetch('http://localhost:5000/api/promos', { headers });
        const promoData = await promoRes.json();
        if (Array.isArray(promoData)) {
          const mapped = promoData.map((pr: any) => ({
            code: pr.code,
            discountType: pr.discount_type,
            value: parseFloat(pr.discount_value),
            active: pr.is_active
          }));
          setPromoCodes(mapped);
        }

        // Fetch Orders
        const orderRes = await fetch('http://localhost:5000/api/orders', { headers });
        const orderData = await orderRes.json();
        if (Array.isArray(orderData)) {
          setOrders(orderData);
        }
      } catch (err) {
        console.error('Error fetching data from API:', err);
      }
    };

    fetchAllData();

    // Poll orders every 10 seconds for real-time kitchen experience
    const interval = setInterval(() => {
      fetch('http://localhost:5000/api/orders', { headers })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setOrders(data);
          }
        })
        .catch(err => console.error('Poll orders error:', err));
    }, 10000);

    return () => clearInterval(interval);
  }, [token]);

  // State Modifiers (Transactional API Logic)
  const handleSendToKitchen = async (
    cartItems: CartItem[], 
    customerName: string, 
    promo: PromoCode | null, 
    notes: string
  ) => {
    if (!token) return;

    const subtotal = cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    let discount = 0;
    if (promo) {
      if (promo.discountType === 'percentage') {
        discount = subtotal * (promo.value / 100);
      } else {
        discount = Math.min(promo.value, subtotal);
      }
    }
    const tax = (subtotal - discount) * 0.05;
    const total = Math.max(0, subtotal - discount + tax);

    // Default to table 1 for terminal quick orders (tbl-1)
    const payload = {
      items: cartItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        line_total: item.product.price * item.quantity
      })),
      table_id: 'tbl-1',
      subtotal,
      tax,
      discount_amount: discount,
      total_amount: total,
      payment_method: 'Cash',
      status: 'Draft',
      customer_name: customerName || 'Guest',
      notes: notes
    };

    try {
      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const newOrder = await response.json();
      if (response.ok) {
        // Refetch orders list to update UI
        const orderRes = await fetch('http://localhost:5000/api/orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const orderData = await orderRes.json();
        if (Array.isArray(orderData)) {
          setOrders(orderData);
        }
      } else {
        alert(newOrder.error || 'Failed to place order.');
      }
    } catch (err) {
      console.error('Error placing order:', err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/kds`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ kds_status: status })
      });

      if (response.ok) {
        setOrders(prev => prev.map(o => 
          o.id === orderId ? { ...o, status } : o
        ));
      }
    } catch (err) {
      console.error('Error updating order KDS status:', err);
    }
  };

  const handleToggleItemFulfillment = async (orderId: string, itemIndex: number) => {
    if (!token) return;

    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const item = order.items[itemIndex];
    if (!item) return;

    try {
      const response = await fetch(`http://localhost:5000/api/orders/${orderId}/items/${item.product.id}/fulfill`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
            const updatedItems = o.items.map((it, idx) => 
              idx === itemIndex ? { ...it, fulfilled: !it.fulfilled } : it
            );
            return { ...o, items: updatedItems };
          }
          return o;
        }));
      }
    } catch (err) {
      console.error('Error toggling item fulfillment:', err);
    }
  };

  const handleClearOrder = async (orderId: string) => {
    if (!token) return;

    // SuperAdmin can delete orders completely
    if (user?.role === 'SuperAdmin') {
      const confirmDelete = window.confirm('Are you sure you want to delete this order from the system? Only SuperAdmins can delete orders.');
      if (!confirmDelete) return;

      try {
        const response = await fetch(`http://localhost:5000/api/orders/${orderId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          setOrders(prev => prev.filter(o => o.id !== orderId));
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to delete order.');
        }
      } catch (err) {
        console.error('Error deleting order:', err);
      }
    } else {
      // For Admin/Employee, just remove it from their active view or alert they cannot delete
      alert('Forbidden. Only SuperAdmin can delete orders from the database.');
    }
  };

  // If not authenticated, display login screen
  if (!token || !user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* GLOBAL SYSTEM HEADER */}
      <header className="h-16 bg-white border-b border-[#e2e8f0] px-6 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shadow-sm">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 tracking-tight">Odoo Cafe POS</span>
              <span className="bg-purple-600/10 text-purple-700 border border-purple-600/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase">
                {user.role}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Terminal v2.6.4</p>
          </div>
        </div>

        {/* Global Nav Bar Switchers */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {['SuperAdmin', 'Admin', 'Employee'].includes(user.role) && (
            <button
              onClick={() => setActiveView('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'products' || activeView === 'payments' || activeView === 'promos' || activeView === 'booking' || activeView === 'users' || activeView === 'categories'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              POS Terminal
            </button>
          )}
          {['SuperAdmin', 'Admin', 'Chef'].includes(user.role) && (
            <button
              onClick={() => setActiveView('kds')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'kds'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              KDS Board
              {orders.filter(o => o.status !== 'Completed').length > 0 && (
                <span className="bg-purple-600 text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold">
                  {orders.filter(o => o.status !== 'Completed').length}
                </span>
              )}
            </button>
          )}
          {['SuperAdmin', 'Admin'].includes(user.role) && (
            <button
              onClick={() => setActiveView('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeView === 'admin'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Admin Panel
            </button>
          )}
        </div>

        {/* System Status & User Profile Info */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-600 hidden md:inline font-bold">Connected</span>
            <Server className="w-3.5 h-3.5 text-slate-400 md:hidden" />
          </div>
          <div className="border-l border-slate-200 h-4" />
          <div className="flex items-center gap-1 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>

          <div className="border-l border-slate-200 h-4" />
          <div className="flex flex-col text-right">
            <span className="text-slate-800 text-[11px] font-extrabold leading-none">{user.name}</span>
            <span className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mt-0.5">
              {user.role} {user.shop_name ? `• ${user.shop_name}` : ''}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* CORE VIEW LAYER DYNAMIC SWITCHER */}
      <main className="flex-1">
        {activeView === 'kds' ? (
          <KDSView 
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onToggleItemFulfillment={handleToggleItemFulfillment}
            onClearOrder={handleClearOrder}
            setActiveView={setActiveView}
          />
        ) : activeView === 'admin' ? (
          <AdminView 
            token={token}
            user={user}
            products={products}
            categories={categories}
            tables={tables}
            promoCodes={promoCodes}
            orders={orders}
            onUpdateProducts={setProducts}
            onUpdateCategories={setCategories}
            onUpdateTables={setTables}
            onUpdatePromoCodes={setPromoCodes}
            setActiveView={setActiveView}
          />
        ) : (
          <POSView 
            products={products}
            categories={categories.map(c => ({ id: c.id, name: c.name }))}
            promoCodes={promoCodes}
            onSendToKitchen={handleSendToKitchen}
            activeView={activeView}
            setActiveView={setActiveView}
          />
        )}
      </main>

    </div>
  );
}

export default App;
