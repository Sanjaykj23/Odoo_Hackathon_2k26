import { useState, useMemo } from 'react';
import { 
  Coffee, Utensils, CreditCard, Tag, Calendar, Users, 
  ChefHat, BarChart3, LogOut, Search, Plus, Minus, 
  User, Check, Percent, ShoppingBag, AlertCircle, X
} from 'lucide-react';
import type { Product, CartItem, PromoCode } from '../../types';

interface POSViewProps {
  products: Product[];
  categories: { id: string; name: string }[];
  promoCodes: PromoCode[];
  onSendToKitchen: (items: CartItem[], customerName: string, promo: PromoCode | null, notes: string) => void;
  activeView: string;
  setActiveView: (view: string) => void;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  categories,
  promoCodes,
  onSendToKitchen,
  activeView,
  setActiveView
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
    const resolvedCustomer = customerName.trim() || 'Guest Customer';
    onSendToKitchen(cart, resolvedCustomer, appliedPromo, orderNotes);
    
    // Clear states
    setCart([]);
    setCustomerName('');
    setAppliedPromo(null);
    setOrderNotes('');
    alert('Order sent to Kitchen Display System (KDS)!');
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const orderNum = `T-${Math.floor(100 + Math.random() * 900)}`;
    setRecentOrderNum(orderNum);
    setShowCheckoutSuccess(true);
  };

  const closeReceiptModal = () => {
    setShowCheckoutSuccess(false);
    setCart([]);
    setCustomerName('');
    setAppliedPromo(null);
    setOrderNotes('');
    setRecentOrderNum('');
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

      {/* COLUMN 2: CENTER PRODUCT GRID */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
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
                        ${product.price.toFixed(2)}
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

        {/* Customer Assignment & Notes */}
        <div className="px-4 py-3 border-b border-[#e2e8f0] space-y-2 bg-[#f8fafc]">
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
                    ${item.product.price.toFixed(2)} each
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
                    ${(item.product.price * item.quantity).toFixed(2)}
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
                  <span>Promo Applied: {appliedPromo.code} (-{appliedPromo.discountType === 'percentage' ? `${appliedPromo.value}%` : `$${appliedPromo.value}`})</span>
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
              <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-green-600 font-medium">
                <span>Discount</span>
                <span>-${totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Tax (5%)</span>
              <span className="font-semibold">${totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-800 pt-1">
              <span>Total Price</span>
              <span className="text-odoo">${totals.total.toFixed(2)}</span>
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
              onClick={handleCheckout}
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
                    <span className="font-semibold">${(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-dashed border-[#e2e8f0] pt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-${totals.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax (5%)</span>
                  <span>${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-800 pt-2 border-t border-slate-100">
                  <span>Total Paid</span>
                  <span className="text-odoo">${totals.total.toFixed(2)}</span>
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

    </div>
  );
};
