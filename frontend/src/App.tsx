import { useState, useEffect } from 'react';
import type { Product, Category, SeatingTable, PromoCode, Order, CartItem } from './types';
import { POSView } from './components/pos/POSView';
import { KDSView } from './components/kds/KDSView';
import { AdminView } from './components/admin/AdminView';
import { LoginView } from './components/auth/LoginView';
import { SessionControl } from './components/pos/SessionControl';
import { CustomerSelfOrderView } from './components/customer/CustomerSelfOrderView';
import { CustomerDisplayView } from './components/customer/CustomerDisplayView';
import { PantryHomeView } from './components/home/PantryHomeView';
import { Coffee, Server, Clock } from 'lucide-react';
import { io } from 'socket.io-client';


function App() {
  // Authentication States
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(JSON.parse(localStorage.getItem('user') || 'null'));

  // Routing Checks
  const getInitialRoute = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    if (params.get('customer') === 'true' || path.startsWith('/customer/')) return 'customer';
    if (path === '/customer-display' || params.get('display') === 'true') return 'customer-display';
    return 'terminal';
  };

  const getInitialTableId = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    if (path.startsWith('/customer/table/')) {
      return path.split('/')[3];
    }
    return params.get('tableId');
  };

  const [route, setRoute] = useState<'terminal' | 'customer' | 'customer-display'>(getInitialRoute);
  const [customerTableId, setCustomerTableId] = useState<string | null>(getInitialTableId);
  const [customerQrToken, setCustomerQrToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('token'));

  // App-level Shared States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  // Active View switching
  const [activeView, setActiveView] = useState<string>('products');

  // Central authenticated fetch — auto-logs out on 401 (expired/revoked token)
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const currentToken = localStorage.getItem('token');
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      // Token is expired or revoked — force logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setActiveView('products');
      throw new Error('SESSION_EXPIRED');
    }
    return res;
  };

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
    window.location.href = '/';
  };

  // On startup: validate stored token immediately to prevent 401 flood
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    fetch('/api/products', {
      headers: { 'Authorization': `Bearer ${storedToken}` }
    }).then(res => {
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    }).catch(() => {/* backend offline, ignore */});
  }, []); // run once on mount

  // Sync URL with Active View
  useEffect(() => {
    if (route !== 'terminal') return;
    if (!token) {
      window.history.replaceState({}, '', '/login');
    } else {
      const path = activeView === 'products' || activeView === 'booking' ? '/pos' : `/${activeView}`;
      window.history.replaceState({}, '', path);
    }
  }, [activeView, token, route]);

  // Load data from Backend API when logged in
  useEffect(() => {
    if (!token) return;

    const fetchAllData = async () => {
      try {
        // Fetch Products
        const prodRes = await apiFetch('/api/products');
        const prodData = await prodRes.json();
        if (Array.isArray(prodData)) {
          const mapped = prodData.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            category: p.category_id,
            image: p.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60',
            available: p.is_available,
            popularity: p.popularity || 4,
            costIndex: p.cost_index || 2,
            country: p.country || 'India'
          }));
          setProducts(mapped);
        }

        // Fetch Categories
        const catRes = await apiFetch('/api/categories');
        const catData = await catRes.json();
        if (Array.isArray(catData)) {
          setCategories(catData);
        }

        // Fetch Floors
        const floorRes = await apiFetch('/api/floors');
        const floorData = await floorRes.json();
        if (Array.isArray(floorData)) {
          setFloors(floorData);
        }

        // Fetch Tables
        const tableRes = await apiFetch('/api/tables');
        const tableData = await tableRes.json();
        if (Array.isArray(tableData)) {
          const mapped = tableData.map((t: any) => ({
            id: t.id,
            number: t.table_number,
            capacity: t.seats,
            occupied_seats: t.occupied_seats,
            status: t.status,
            floor_id: t.floor_id,
            floor_name: t.floor_name,
            shop_id: t.shop_id,
            qr_token: t.qr_token
          }));
          setTables(mapped);
        }

        // Fetch Promo Codes
        const promoRes = await apiFetch('/api/promos');
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
        const orderRes = await apiFetch('/api/orders');
        const orderData = await orderRes.json();
        if (Array.isArray(orderData)) {
          setOrders(orderData);
        }

        // Fetch Sessions
        const sessRes = await apiFetch('/api/sessions');
        const sessData = await sessRes.json();
        if (Array.isArray(sessData)) {
          setSessions(sessData);
          const openSess = sessData.find((s: any) => s.status === 'Open');
          setActiveSession(openSess || null);
        }
      } catch (err: any) {
        if (err?.message !== 'SESSION_EXPIRED') {
          console.error('Error fetching data from API:', err);
        }
      }
    };

    fetchAllData();

    // Socket.IO — polling-first so React StrictMode double-invoke doesn't crash
    const socket = io('', {
      transports: ['polling', 'websocket'],
      autoConnect: false,
    });

    // Join the appropriate shop room
    if (user && user.shop_id) {
      socket.once('connect', () => socket.emit('join_shop', { shop_id: user.shop_id }));
    } else {
      socket.once('connect', () => socket.emit('join_shop', {}));
    }

    socket.connect();

    const handleMessage = (data: any) => {
      try {
        const { type, payload } = data;

        switch (type) {
          case 'CONNECTED':
            console.log('[Socket] Connection confirmed:', payload);
            break;
          case 'ORDER_CREATED':
            setOrders(prev => {
              if (prev.some(o => o.id === payload.id)) return prev;
              return [payload, ...prev];
            });
            break;
          case 'ORDER_UPDATED':
            setOrders(prev => prev.map(o => o.id === payload.id ? payload : o));
            break;
          case 'ORDER_DELETED':
            setOrders(prev => prev.filter(o => o.id !== payload.id));
            break;
          case 'PRODUCT_UPDATED':
            setProducts(prev => {
              const mapped = {
                id: payload.id,
                name: payload.name,
                price: parseFloat(payload.price),
                category: payload.category_id,
                image: payload.image_url || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60',
                available: payload.is_available,
                popularity: payload.popularity || 4,
                costIndex: payload.cost_index || 2,
                country: payload.country || 'India'
              };
              if (prev.some(p => p.id === payload.id)) {
                return prev.map(p => p.id === payload.id ? mapped : p);
              }
              return [...prev, mapped];
            });
            break;
          case 'PRODUCT_DELETED':
            setProducts(prev => prev.filter(p => p.id !== payload.id));
            break;
          case 'CATEGORY_UPDATED':
            setCategories(prev => {
              if (prev.some(c => c.id === payload.id)) {
                return prev.map(c => c.id === payload.id ? payload : c);
              }
              return [...prev, payload];
            });
            break;
          case 'CATEGORY_DELETED':
            setCategories(prev => prev.filter(c => c.id !== payload.id));
            break;
          case 'TABLE_UPDATED':
            setTables(prev => {
              const mapped = {
                id: payload.id,
                number: payload.table_number,
                capacity: payload.seats,
                status: payload.status,
                occupied_seats: payload.occupied_seats,
                floor_id: payload.floor_id,
                floor_name: payload.floor_name,
                shop_id: payload.shop_id,
                qr_token: payload.qr_token  // preserve QR token
              };
              if (prev.some(t => t.id === payload.id)) {
                return prev.map(t => t.id === payload.id ? mapped : t);
              }
              return [...prev, mapped];
            });
            break;
          case 'TABLE_DELETED':
            setTables(prev => prev.filter(t => t.id !== payload.id));
            break;
          case 'FLOOR_UPDATED':
            setFloors(prev => {
              if (prev.some(f => f.id === payload.id)) {
                return prev.map(f => f.id === payload.id ? payload : f);
              }
              return [...prev, payload];
            });
            break;
          case 'FLOOR_DELETED':
            setFloors(prev => prev.filter(f => f.id !== payload.id));
            break;
          case 'PROMO_UPDATED':
            setPromoCodes(prev => {
              const mapped = {
                code: payload.code,
                discountType: payload.discount_type,
                value: parseFloat(payload.discount_value),
                active: payload.is_active
              };
              if (prev.some(p => p.code === payload.code)) {
                return prev.map(p => p.code === payload.code ? mapped : p);
              }
              return [...prev, mapped];
            });
            break;
          case 'PROMO_DELETED':
            setPromoCodes(prev => prev.filter(p => p.code !== payload.code));
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('[Socket] Failed to parse message event data:', err);
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
      socket.disconnect();
    };
  }, [token]);  // ← only reconnect when token changes (login/logout)

  // State Modifiers (Transactional API Logic)
  const handleSendToKitchen = async (
    cartItems: CartItem[], 
    customerName: string, 
    promo: PromoCode | null, 
    notes: string,
    tableId: string
  ) => {
    if (!token) return;

    if (!tableId) {
      alert('Table selection is mandatory to place an order.');
      return;
    }

    if (!activeSession) {
      alert('You must open a POS session before placing an order.');
      return;
    }

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

    const payload = {
      items: cartItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        line_total: item.product.price * item.quantity
      })),
      table_id: tableId,
      subtotal,
      tax,
      discount_amount: discount,
      total_amount: total,
      payment_method: null,
      status: 'Draft',
      customer_name: customerName || 'Guest',
      notes: notes
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const newOrder = await response.json();
      if (!response.ok) {
        alert(newOrder.error || 'Failed to place order.');
      }
    } catch (err) {
      console.error('Error placing order:', err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/orders/${orderId}/kds`, {
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
      const response = await fetch(`/api/orders/${orderId}/items/${item.product.id}/fulfill`, {
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
        const response = await fetch(`/api/orders/${orderId}`, {
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

  // Dynamic Routing Resolver
  if (route === 'customer') {
    return <CustomerSelfOrderView tableId={customerTableId} qrToken={customerQrToken} />;
  }

  if (route === 'customer-display') {
    return <CustomerDisplayView />;
  }

  // If not authenticated, display login screen
  if (!token || !user) {
    if (window.location.pathname === '/' && !window.location.search.includes('customer=')) {
      return <PantryHomeView />;
    }
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
          <div className="flex-1 flex flex-col overflow-hidden">
            {['SuperAdmin', 'Admin', 'Employee'].includes(user.role) && (
              <div className="p-4 bg-slate-50 border-b border-[#e2e8f0]">
                <SessionControl 
                  token={token}
                  activeSession={activeSession}
                  onSessionOpened={setActiveSession}
                  onSessionClosed={() => setActiveSession(null)}
                  userName={user.name}
                />
              </div>
            )}
            <div className="flex-1 flex overflow-hidden">
              <POSView 
                products={products}
                categories={categories.map(c => ({ id: c.id, name: c.name }))}
                promoCodes={promoCodes}
                onSendToKitchen={handleSendToKitchen}
                activeView={activeView}
                setActiveView={setActiveView}
                tables={tables}
                activeSession={activeSession}
                token={token}
              />
            </div>
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
