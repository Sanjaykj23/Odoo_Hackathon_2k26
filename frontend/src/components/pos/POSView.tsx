import { useState, useMemo, useEffect } from 'react';
import { 
  Coffee, Utensils, CreditCard, Tag, Calendar, Users, 
  ChefHat, BarChart3, LogOut, Search, Plus, Minus, 
  User, Check, Percent, ShoppingBag, AlertCircle, X, MapPin, Layers
} from 'lucide-react';
import type { Product, CartItem, PromoCode, SeatingTable } from '../../types';

interface POSViewProps {
  products: Product[];
  categories: { id: string; name: string }[];
  promoCodes: PromoCode[];
  onSendToKitchen: (items: CartItem[], customerName: string, promo: PromoCode | null, notes: string, tableId: string) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  tables: SeatingTable[];
  activeSession: any | null;
  token: string | null;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  categories,
  promoCodes,
  onSendToKitchen,
  activeView,
  setActiveView,
  tables,
  activeSession,
  token
}) => {
  // Search & Category states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Cart states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [recentOrderNum, setRecentOrderNum] = useState('');

  // Table selection & checkout payment states
  const [selectedTableId, setSelectedTableId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
  const [transactionRef, setTransactionRef] = useState('');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);

  // Synchronize cart changes to LocalStorage for secondary customer display screen
  useEffect(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.discountType === 'percentage') {
        discount = subtotal * (appliedPromo.value / 100);
      } else {
        discount = Math.min(appliedPromo.value, subtotal);
      }
    }
    const tax = (subtotal - discount) * 0.05;
    const total = Math.max(0, subtotal - discount + tax);

    localStorage.setItem(
      'customer_display_cart',
      JSON.stringify({
        cart,
        totals: { subtotal, discount, tax, total },
        customerName,
        appliedPromo,
        checkoutComplete: showCheckoutSuccess,
        receiptNumber: recentOrderNum
      })
    );
  }, [cart, customerName, appliedPromo, showCheckoutSuccess, recentOrderNum]);

  // Sidebar Menu configuration
  const menuItems = [
    { id: 'products', label: 'Products', icon: Coffee },
    { id: 'categories', label: 'Categories', icon: Utensils },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'promos', label: 'Promos', icon: Tag },
    { id: 'booking', label: 'Booking', icon: Calendar },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'kds', label: 'KDS Board', icon: ChefHat },
    { id: 'admin', label: 'Admin Panel', icon: BarChart3 },
    { id: 'logout', label: 'Log-Out', icon: LogOut },
  ];

  // Filtering products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (product: Product) => {
    if (!product.available) return;
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        return prevCart.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  // Calculations (Logic separated from JSX structure)
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    let discount = 0;
    if (appliedPromo) {
      if (appliedPromo.discountType === 'percentage') {
        discount = subtotal * (appliedPromo.value / 100);
      } else {
        discount = Math.min(appliedPromo.value, subtotal);
      }
    }
    const tax = (subtotal - discount) * 0.05; // 5% flat tax
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  }, [cart, appliedPromo]);

  // Promo handling
  const handleApplyPromo = () => {
    setPromoError('');
    if (!promoInput.trim()) return;
    const promo = promoCodes.find(p => p.code.toUpperCase() === promoInput.trim().toUpperCase());
    if (!promo) {
      setPromoError('Invalid promo code');
      setAppliedPromo(null);
    } else if (!promo.active) {
      setPromoError('Promo code expired');
      setAppliedPromo(null);
    } else {
      setAppliedPromo(promo);
      setPromoInput('');
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
  };

  // Checkout flows
  const handleKitchenDispatch = () => {
    if (cart.length === 0) return;
    if (!activeSession) {
      alert('You must open a POS session before sending orders to the kitchen.');
      return;
    }
    if (!selectedTableId) {
      alert('Table selection is mandatory to place an order.');
      return;
    }
    const resolvedCustomer = customerName.trim() || 'Guest Customer';
    onSendToKitchen(cart, resolvedCustomer, appliedPromo, orderNotes, selectedTableId);
    
    // Clear states
    setCart([]);
    setCustomerName('');
    setAppliedPromo(null);
    setOrderNotes('');
    setSelectedTableId('');
    alert('Order sent to Kitchen Display System (KDS) and table marked Occupied!');
  };

  const handleCheckoutOpen = () => {
    if (cart.length === 0) return;
    if (!activeSession) {
      alert('You must open a POS session to proceed to payment.');
      return;
    }
    if (!selectedTableId) {
      alert('Table selection is mandatory to proceed to payment.');
      return;
    }
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !token || !activeSession || !selectedTableId) return;
    setCheckoutProcessing(true);

    const resolvedCustomer = customerName.trim() || 'Guest Customer';

    // 1. Create order as Draft
    const payload = {
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        line_total: item.product.price * item.quantity
      })),
      table_id: selectedTableId,
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount_amount: totals.discount,
      total_amount: totals.total,
      payment_method: null,
      status: 'Draft',
      customer_name: resolvedCustomer,
      notes: orderNotes
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
      const orderData = await response.json();
      if (!response.ok) {
        throw new Error(orderData.error || 'Failed to place draft order.');
      }

      // 2. Submit payment to record transaction and mark order Paid
      const payResponse = await fetch(`http://localhost:5000/api/orders/${orderData.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_method: paymentMethod,
          transaction_ref: transactionRef,
          amount: totals.total
        })
      });
      const payData = await payResponse.json();
      if (!payResponse.ok) {
        throw new Error(payData.error || 'Failed to process payment.');
      }

      // 3. Complete checkout
      setRecentOrderNum(orderData.order_number || `T-${Math.floor(100 + Math.random() * 900)}`);
      setShowPaymentModal(false);
      setShowCheckoutSuccess(true);
      setTransactionRef('');
    } catch (err: any) {
      alert(err.message || 'Error executing payment checkout.');
    } finally {
      setCheckoutProcessing(false);
    }
  };

  const closeReceiptModal = () => {
    setShowCheckoutSuccess(false);
    setCart([]);
    setCustomerName('');
    setAppliedPromo(null);
    setOrderNotes('');
    setRecentOrderNum('');
    setSelectedTableId('');
  };


  // Update table status directly (manual override from seating view)
  const updateTableStatus = async (tableId: string, newStatus: SeatingTable['status']) => {
    if (!token) return;
    try {
      await fetch(`http://localhost:5000/api/tables/${tableId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.error('Error updating table status:', err);
    }
  };

  const handleAssignTableFromBooking = (tableId: string) => {
    setSelectedTableId(tableId);
    setActiveView('products');
  };

  return (

    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#f8fafc]">
      
      {/* COLUMN 1: LEFT SIDEBAR NAVIGATION */}
      <div className="w-64 bg-white border-r border-[#e2e8f0] flex flex-col justify-between p-4">
        <div className="space-y-1.5">
          <div className="px-3 py-2.5 mb-4 rounded-xl bg-odoo-trans">
            <span className="text-xs uppercase tracking-wider font-semibold text-odoo">System Mode</span>
            <p className="text-sm font-bold text-slate-800">Cafe POS Terminal</p>
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'logout') {
                      alert('Logging out of Odoo Cafe...');
                    } else if (item.id === 'kds' || item.id === 'admin') {
                      setActiveView(item.id);
                    } else if (item.id === 'booking') {
                      setActiveView('booking');
                    } else {
                      setActiveView('products');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isSelected 
                      ? 'bg-odoo text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-[#e2e8f0] pt-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-odoo text-white flex items-center justify-center font-bold text-xs">
              OP
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Operator Admin</p>
              <p className="text-[10px] text-slate-400">Terminal #01</p>
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 2: CENTER PRODUCT GRID or BOOKING VIEW */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">

        {/* BOOKING / SEATING LAYOUT VIEW */}
        {activeView === 'booking' ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Booking Header */}
            <div className="p-5 bg-white border-b border-[#e2e8f0]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">Floor Seating Layout</h1>
                    <p className="text-xs text-slate-400 mt-0.5">Live table occupancy — click an Available table to assign it to the current order</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveView('products')}
                  className="text-xs px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all"
                >
                  ← Back to Products
                </button>
              </div>

              {/* Occupancy Summary Metrics */}
              <div className="mt-4 grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Tables', value: tables.length, color: 'bg-slate-100 text-slate-700 border-slate-200' },
                  { label: 'Available', value: tables.filter(t => t.status === 'Available').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { label: 'Occupied', value: tables.filter(t => t.status === 'Occupied').length, color: 'bg-rose-50 text-rose-700 border-rose-200' },
                  { label: 'Reserved', value: tables.filter(t => t.status === 'Reserved').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                ].map(stat => (
                  <div key={stat.label} className={`border rounded-xl px-4 py-2.5 ${stat.color}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{stat.label}</p>
                    <p className="text-2xl font-black mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Floor Sections */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {tables.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <MapPin className="w-10 h-10 mb-2 stroke-1" />
                  <p className="text-sm">No tables configured yet. Add floors and tables in Admin Panel.</p>
                </div>
              ) : (
                Object.entries(
                  tables.reduce((acc, t) => {
                    const fName = t.floor_name || 'Main Floor';
                    if (!acc[fName]) acc[fName] = [];
                    acc[fName].push(t);
                    return acc;
                  }, {} as Record<string, typeof tables>)
                ).map(([floorName, floorTables]) => (
                  <div key={floorName}>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{floorName}</h2>
                      <span className="text-[10px] font-semibold text-slate-400 ml-1">{floorTables.length} tables</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {floorTables.sort((a, b) => a.number - b.number).map(table => {
                        const statusConfig: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
                          Available: { border: 'border-emerald-200 hover:border-emerald-400', bg: 'bg-white', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
                          Occupied: { border: 'border-rose-200 hover:border-rose-300', bg: 'bg-rose-50/30', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-pulse' },
                          Reserved: { border: 'border-amber-200 hover:border-amber-300', bg: 'bg-amber-50/20', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
                          Maintenance: { border: 'border-slate-200', bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
                        };
                        const cfg = statusConfig[table.status] || statusConfig.Available;
                        const isSelected = selectedTableId === table.id;

                        return (
                          <div
                            key={table.id}
                            className={`border rounded-xl p-4 flex flex-col gap-3 transition-all shadow-sm cursor-pointer ${
                              cfg.border
                            } ${ cfg.bg } ${
                              isSelected ? 'ring-2 ring-purple-500 ring-offset-1' : ''
                            }`}
                            onClick={() => table.status === 'Available' && handleAssignTableFromBooking(table.id)}
                          >
                            {/* Header row */}
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-base font-black text-slate-800">Table {table.number}</span>
                                {isSelected && (
                                  <span className="block text-[9px] text-purple-600 font-bold uppercase tracking-wider">Selected ✓</span>
                                )}
                              </div>
                              <span className={`w-2.5 h-2.5 rounded-full mt-1 ${cfg.dot}`} />
                            </div>

                            {/* Status badge */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border self-start ${cfg.badge}`}>
                              {table.status}
                            </span>

                            {/* Capacity */}
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                              <Users className="w-3 h-3" />
                              <span>{table.capacity} seats</span>
                            </div>

                            {/* Action area */}
                            <div className="border-t border-slate-100 pt-2 mt-auto">
                              {table.status === 'Available' ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAssignTableFromBooking(table.id); }}
                                  className="w-full text-[10px] font-bold py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                                >
                                  Assign to Order
                                </button>
                              ) : (
                                <select
                                  value={table.status}
                                  onChange={(e) => { e.stopPropagation(); updateTableStatus(table.id, e.target.value as SeatingTable['status']); }}
                                  className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg p-1 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="Available">Available</option>
                                  <option value="Occupied">Occupied</option>
                                  <option value="Reserved">Reserved</option>
                                  <option value="Maintenance">Maintenance</option>
                                </select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
        <>
        {/* Search and Filters Header */}
        <div className="p-5 bg-white border-b border-[#e2e8f0] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Select Products</h1>
            <div className="relative w-72">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo placeholder-slate-400 text-slate-800 transition-colors"
              />
            </div>
          </div>

          {/* Category Pill Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap tracking-wide border transition-all duration-200 ${
                    isSelected 
                      ? 'bg-slate-800 border-slate-800 text-white shadow-sm'
                      : 'bg-white border-[#e2e8f0] text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <ShoppingBag className="w-12 h-12 mb-3 stroke-1" />
              <p className="text-sm">No products match your search or filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={!product.available}
                  className={`group relative text-left bg-white border border-[#e2e8f0] rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 flex flex-col h-full ${
                    !product.available ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {/* Image Container */}
                  <div className="h-32 w-full bg-slate-100 overflow-hidden relative">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {!product.available && (
                      <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                        <span className="bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                          Out of Stock
                        </span>
                      </div>
                    )}
                    <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm border border-[#e2e8f0] px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-500">
                      {product.country}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-3.5 flex flex-col justify-between flex-1 space-y-2">
                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm line-clamp-1 group-hover:text-odoo transition-colors">
                        {product.name}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        {product.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-bold text-slate-800">
                        ₹{product.price.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span 
                            key={i} 
                            className={`text-xs ${i < product.popularity ? 'text-amber-400' : 'text-slate-200'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        </>)}
      </div>

      {/* COLUMN 3: RIGHT CART PANEL */}
      <div className="w-[380px] bg-white border-l border-[#e2e8f0] flex flex-col justify-between">
        
        {/* Cart Header */}
        <div className="p-4 border-b border-[#e2e8f0]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-slate-500" />
              <h2 className="text-base font-bold text-slate-800">Current Order</h2>
            </div>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
            </span>
          </div>
        </div>

        {/* Customer Assignment, Notes & Table Selection */}
        <div className="px-4 py-3 border-b border-[#e2e8f0] space-y-2.5 bg-[#f8fafc]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                <User className="h-3.5 w-3.5 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Assign Customer..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-700"
              />
            </div>
            {customerName && (
              <button 
                onClick={() => setCustomerName('')} 
                className="text-[10px] text-red-500 hover:underline px-1 self-center"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Special preparation notes..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-700"
          />

          {/* Floor Seating Table Picker */}
          <div className="space-y-1">
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo text-slate-700 font-semibold"
            >
              <option value="">-- Select Table (Required) --</option>
              {Object.entries(
                tables.reduce((acc, t) => {
                  const fName = t.floor_name || 'Main Floor';
                  if (!acc[fName]) acc[fName] = [];
                  acc[fName].push(t);
                  return acc;
                }, {} as Record<string, typeof tables>)
              ).map(([floorName, floorTables]) => (
                <optgroup key={floorName} label={floorName}>
                  {floorTables.map((t) => (
                    <option 
                      key={t.id} 
                      value={t.id}
                      className={t.status === 'Occupied' ? 'text-red-500 font-medium' : 'text-emerald-600 font-medium'}
                    >
                      Table {t.number} ({t.capacity} seats) - {t.status}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {selectedTableId && (() => {
              const selectedTable = tables.find(t => t.id === selectedTableId);
              if (!selectedTable) return null;
              const statusColors = {
                Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                Occupied: 'bg-rose-50 text-rose-700 border-rose-200',
                Reserved: 'bg-amber-50 text-amber-700 border-amber-200',
                Maintenance: 'bg-slate-50 text-slate-700 border-slate-200'
              };
              const color = statusColors[selectedTable.status] || statusColors.Available;
              return (
                <div className={`flex items-center justify-between text-[10px] px-2 py-1.5 border rounded-lg ${color}`}>
                  <span>Seats: <strong className="font-bold">{selectedTable.capacity}</strong></span>
                  <span className="font-bold uppercase tracking-wider text-[9px]">{selectedTable.status}</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Selected Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1" />
              <p className="text-xs">Cart is empty. Add menu items to start.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div 
                key={item.product.id} 
                className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-800 truncate">{item.product.name}</h4>
                  <p className="text-[10px] text-slate-400">
                    ₹{item.product.price.toFixed(2)} each
                  </p>
                </div>

                {/* Quantity Toggle Widget */}
                <div className="flex items-center border border-[#e2e8f0] rounded-lg bg-white overflow-hidden shadow-sm">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="p-1 hover:bg-slate-50 text-slate-500 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-xs font-semibold text-slate-700">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="p-1 hover:bg-slate-50 text-slate-500 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right w-16">
                  <span className="text-xs font-bold text-slate-800">
                    ₹{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Lower Summary Box */}
        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] space-y-4">
          
          {/* Promo code inputs */}
          <div className="space-y-1.5">
            {appliedPromo ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-700 px-2.5 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <Percent className="w-3.5 h-3.5 text-green-500" />
                  <span>Promo Applied: {appliedPromo.code} (-{appliedPromo.discountType === 'percentage' ? `${appliedPromo.value}%` : `₹${appliedPromo.value}`})</span>
                </div>
                <button onClick={removePromo} className="text-green-700 hover:text-green-900 font-bold ml-2">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Promo Code"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-700"
                />
                <button
                  onClick={handleApplyPromo}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
            {promoError && (
              <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                <AlertCircle className="w-3 h-3" />
                <span>{promoError}</span>
              </div>
            )}
          </div>

          {/* Pricing calculations */}
          <div className="space-y-1.5 text-xs border-b border-dashed border-[#e2e8f0] pb-3">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Discount</span>
                <span>-₹{totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Tax (5%)</span>
              <span className="font-semibold">₹{totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-800 pt-1">
              <span>Total Price</span>
              <span className="text-odoo">₹{totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Functional Button Triggers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleKitchenDispatch}
              disabled={cart.length === 0}
              className="py-2.5 px-3 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-98"
            >
              Send to Kitchen
            </button>
            <button
              onClick={handleCheckoutOpen}
              disabled={cart.length === 0}
              className="py-2.5 px-3 bg-odoo text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-odoo-dark active:scale-98"
            >
              Proceed to Pay
            </button>
          </div>
        </div>

      </div>

      {/* CHECKOUT RECEIPT MODAL */}
      {showCheckoutSuccess && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100">
            <div className="p-6 text-center border-b border-[#e2e8f0] bg-slate-50">
              <div className="w-12 h-12 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Checkout Completed</h3>
              <p className="text-xs text-slate-400 mt-1">Receipt for Order {recentOrderNum}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-xs text-slate-600">
                    <span>{item.product.name} (x{item.quantity})</span>
                    <span className="font-semibold">₹{(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-dashed border-[#e2e8f0] pt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{totals.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax (5%)</span>
                  <span>₹{totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-800 pt-2 border-t border-slate-100">
                  <span>Total Paid</span>
                  <span className="text-odoo">₹{totals.total.toFixed(2)}</span>
                </div>
              </div>
              
              {customerName && (
                <div className="bg-[#f8fafc] p-2.5 rounded-lg text-[10px] text-slate-500 border border-slate-100">
                  <span className="font-semibold block text-slate-700">Customer:</span>
                  {customerName}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-[#e2e8f0] flex justify-end">
              <button
                onClick={closeReceiptModal}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Close & Clear Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-slide-up">
            <div className="p-6 border-b border-[#e2e8f0] bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Process Checkout Payment</h3>
                <p className="text-xs text-slate-400 mt-0.5">Select payment method and verify details</p>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div className="p-6 space-y-5">
                {/* Total amount display */}
                <div className="bg-slate-900 text-white rounded-xl p-4 text-center">
                  <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">Amount to Pay</span>
                  <div className="text-3xl font-extrabold text-white mt-1">₹{totals.total.toFixed(2)}</div>
                  {selectedTableId && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-white/10 rounded text-[10px] font-semibold text-slate-300">
                      Table: {tables.find(t => t.id === selectedTableId)?.number}
                    </span>
                  )}
                </div>

                {/* Payment method selector tabs */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">Select Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Cash', label: 'Cash' },
                      { id: 'Card', label: 'Card' },
                      { id: 'UPI', label: 'UPI QR' }
                    ].map((method) => {
                      const isSelected = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id as any)}
                          className={`py-3 px-2 border rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                            isSelected 
                              ? 'border-purple-600 bg-purple-50 text-purple-700 ring-2 ring-purple-600/10'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-sm">
                            {method.id === 'Cash' ? '💵' : method.id === 'Card' ? '💳' : '📱'}
                          </span>
                          <span>{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Content based on selected payment method */}
                {paymentMethod === 'UPI' && (
                  <div className="flex flex-col items-center justify-center p-4 border border-purple-100 rounded-xl bg-purple-50/50 space-y-3">
                    <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Scan QR Code</span>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                        `upi://pay?pa=odoocafe@upi&pn=Odoo%20Cafe&am=${totals.total}&cu=INR`
                      )}`} 
                      alt="UPI QR Code" 
                      className="w-36 h-36 border border-slate-200 rounded-lg p-1 bg-white shadow-sm"
                    />
                    <div className="text-center">
                      <p className="text-[10px] font-semibold text-slate-500">Merchant: Odoo Cafe</p>
                      <p className="text-[9px] text-slate-400">UPI ID: odoocafe@upi</p>
                    </div>
                  </div>
                )}

                {/* Transaction Reference input */}
                {paymentMethod !== 'Cash' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <span>Transaction Reference</span>
                      <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={paymentMethod === 'UPI' ? 'Enter UPI Ref ID (e.g. UTR)' : 'Enter Card Approval Code'}
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800 placeholder-slate-400"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-[#e2e8f0] flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkoutProcessing}
                  className="flex-1 py-2 bg-odoo hover:bg-odoo-dark text-white font-bold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {checkoutProcessing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Paid'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
