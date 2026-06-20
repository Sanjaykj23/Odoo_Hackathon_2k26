import { useState } from 'react';
import { initialProducts, initialCategories, initialOrders, initialTables, initialPromoCodes } from './dummyData';
import type { Product, Category, SeatingTable, PromoCode, Order, CartItem } from './types';
import { POSView } from './components/pos/POSView';
import { KDSView } from './components/kds/KDSView';
import { AdminView } from './components/admin/AdminView';
import { Coffee, Server, Clock } from 'lucide-react';

function App() {
  // App-level Shared States
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [tables, setTables] = useState<SeatingTable[]>(initialTables);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(initialPromoCodes);
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // Active View switching
  const [activeView, setActiveView] = useState<string>('products');

  // Time tracker for visual detail
  const [currentTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  // State Modifiers (Transactional Logic)
  const handleSendToKitchen = (
    cartItems: CartItem[], 
    customerName: string, 
    promo: PromoCode | null, 
    notes: string
  ) => {
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

    const newOrder: Order = {
      id: `o-${Date.now()}`,
      ticketNumber: `T-${Math.floor(100 + Math.random() * 900)}`,
      items: cartItems.map(item => ({
        product: item.product,
        quantity: item.quantity,
        fulfilled: false
      })),
      status: 'To Cook',
      createdAt: new Date().toISOString(),
      elapsed: 0,
      total: total,
      customer: customerName,
      discount: discount,
      promoCode: promo?.code,
      notes: notes
    };

    setOrders(prev => [newOrder, ...prev]);
  };

  const handleUpdateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, status } : o
    ));
  };

  const handleToggleItemFulfillment = (orderId: string, itemIndex: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const updatedItems = o.items.map((item, idx) => 
          idx === itemIndex ? { ...item, fulfilled: !item.fulfilled } : item
        );
        return { ...o, items: updatedItems };
      }
      return o;
    }));
  };

  const handleClearOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* GLOBAL SYSTEM HEADER */}
      <header className="h-16 bg-white border-b border-[#e2e8f0] px-6 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-odoo flex items-center justify-center shadow-sm">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 tracking-tight">Odoo Cafe POS</span>
              <span className="bg-[#714B67]/10 text-odoo border border-[#714B67]/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase">
                Enterprise
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Terminal v2.6.4</p>
          </div>
        </div>

        {/* Global Nav Bar Switchers */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveView('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'products' || activeView === 'payments' || activeView === 'promos' || activeView === 'booking' || activeView === 'users' || activeView === 'categories'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            POS Terminal
          </button>
          <button
            onClick={() => setActiveView('kds')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeView === 'kds'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            KDS Board
            {orders.filter(o => o.status !== 'Completed').length > 0 && (
              <span className="bg-odoo text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold">
                {orders.filter(o => o.status !== 'Completed').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveView('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'admin'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Admin Panel
          </button>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-600 hidden md:inline">Server Connected</span>
            <Server className="w-3.5 h-3.5 text-slate-400 md:hidden" />
          </div>
          <div className="border-l border-slate-200 h-4" />
          <div className="flex items-center gap-1 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTime}</span>
          </div>
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
