import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, Search, Plus, Minus, Check, AlertCircle, 
  Coffee, CookingPot, Utensils, Sparkles, MapPin, Ticket
} from 'lucide-react';
import type { Product, Category, CartItem, PromoCode, Order } from '../../types';

interface CustomerSelfOrderViewProps {
  tableId: string | null;
  qrToken: string | null;
}

export const CustomerSelfOrderView: React.FC<CustomerSelfOrderViewProps> = ({ tableId, qrToken }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Scoped Data fetched via Public API
  const [shop, setShop] = useState<any>(null);
  const [table, setTable] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Customer Cart States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');

  // Active placed order tracking state
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  // Load Table Menu Details on mount
  useEffect(() => {
    if (!qrToken) {
      setError('Missing QR Verification Token. Please scan the QR Code on your table again.');
      setLoading(false);
      return;
    }

    const fetchMenu = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/public/table/${qrToken}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load table details.');
        }

        setShop(data.shop);
        setTable(data.table);
        setCategories([{ id: 'all', name: 'All Items', color: '#714B67' }, ...data.categories]);
        
        const mappedProducts = data.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price),
          category: p.category_id,
          image: p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60',
          available: p.is_available,
          popularity: p.popularity || 4,
          costIndex: p.cost_index || 2,
          country: p.country || 'India'
        }));
        setProducts(mappedProducts);

        const mappedPromos = data.promos.map((pr: any) => ({
          code: pr.code,
          discountType: pr.discount_type,
          value: parseFloat(pr.discount_value),
          active: pr.is_active
        }));
        setPromoCodes(mappedPromos);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error connecting to Odoo Cafe.');
        setLoading(false);
      }
    };

    fetchMenu();
  }, [qrToken]);

  // Subscribe to real-time status update of the active customer order via SSE
  useEffect(() => {
    if (!activeOrder) return;

    const eventSource = new EventSource('http://localhost:5000/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ORDER_UPDATED' && data.payload.id === activeOrder.id) {
          setActiveOrder(data.payload);
        }
      } catch (err) {
        console.error('Error parsing SSE for customer tracking:', err);
      }
    };

    return () => eventSource.close();
  }, [activeOrder]);

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
    setCart(prev => {
      const exists = prev.find(item => item.product.id === product.id);
      if (exists) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const nextQty = item.quantity + delta;
          return nextQty > 0 ? { ...item, quantity: nextQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  // Calculations
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
    const tax = (subtotal - discount) * 0.05;
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
  }, [cart, appliedPromo]);

  const handleApplyPromo = () => {
    setPromoError('');
    if (!promoInput.trim()) return;
    const promo = promoCodes.find(p => p.code.toUpperCase() === promoInput.trim().toUpperCase());
    if (!promo) {
      setPromoError('Invalid promo code');
    } else if (!promo.active) {
      setPromoError('Promo code expired');
    } else {
      setAppliedPromo(promo);
      setPromoInput('');
    }
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    
    const payload = {
      qr_token: qrToken,
      table_id: table.id,
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        line_total: item.product.price * item.quantity
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount_amount: totals.discount,
      total_amount: totals.total,
      notes: notes,
      customer_name: customerName.trim() || 'Table Guest'
    };

    try {
      const res = await fetch('http://localhost:5000/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || 'Failed to place order.');

      setActiveOrder({
        id: orderData.id,
        ticketNumber: orderData.order_number,
        status: 'To Cook',
        total: totals.total
      });
      setCart([]);
      setCustomerName('');
      setNotes('');
    } catch (err: any) {
      alert(err.message || 'Error placing order.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"/>
          <p className="text-sm font-semibold text-slate-500">Loading Odoo Cafe Digital Menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-100 p-6 rounded-2xl max-w-sm text-center shadow-lg space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Connection Error</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <p className="text-[10px] text-slate-400">Ask server/waiter for assistance with table configuration.</p>
        </div>
      </div>
    );
  }

  // Render Order Tracking View if customer has placed an order
  if (activeOrder) {
    const getStageIndex = (stage: string) => {
      if (stage === 'Completed') return 3;
      if (stage === 'Preparing') return 2;
      return 1; // To Cook
    };
    const stageIdx = getStageIndex(activeOrder.status);

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl w-full max-w-md shadow-xl space-y-6">
          <div className="text-center pb-4 border-b border-slate-100">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 mx-auto mb-2">
              <CookingPot className="w-6 h-6" />
            </div>
            <h2 className="text-base font-extrabold text-slate-800">Order Placed Successfully!</h2>
            <p className="text-xs text-slate-400 mt-1">Ticket Number: <span className="font-bold text-slate-700">{activeOrder.ticketNumber}</span></p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preparation Status</h3>
            
            {/* Visual Steps Tracker */}
            <div className="space-y-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              <div className="relative flex items-center gap-3">
                <span className={`absolute -left-[22px] w-4.5 h-4.5 rounded-full border-4 border-white flex items-center justify-center ${
                  stageIdx >= 1 ? 'bg-purple-600' : 'bg-slate-300'
                }`} />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Received (To Cook)</h4>
                  <p className="text-[10px] text-slate-400">Sent to the kitchen display screen.</p>
                </div>
              </div>

              <div className="relative flex items-center gap-3">
                <span className={`absolute -left-[22px] w-4.5 h-4.5 rounded-full border-4 border-white flex items-center justify-center ${
                  stageIdx >= 2 ? 'bg-purple-600 animate-pulse' : 'bg-slate-300'
                }`} />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Preparing</h4>
                  <p className="text-[10px] text-slate-400">Chef is preparing your meal.</p>
                </div>
              </div>

              <div className="relative flex items-center gap-3">
                <span className={`absolute -left-[22px] w-4.5 h-4.5 rounded-full border-4 border-white flex items-center justify-center ${
                  stageIdx >= 3 ? 'bg-green-500' : 'bg-slate-300'
                }`} />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Ready (Completed)</h4>
                  <p className="text-[10px] text-slate-400">Your meal is ready to be served!</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-semibold">Total Price:</span>
            <span className="font-bold text-purple-700 text-sm">₹{activeOrder.total?.toFixed(2)}</span>
          </div>

          <button
            onClick={() => setActiveOrder(null)}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Order Something Else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      {/* Dynamic Mobile Header */}
      <header className="bg-white border-b border-[#e2e8f0] px-4 py-3 sticky top-0 z-30 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shadow-sm">
            <Coffee className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-800">{shop?.name || 'Odoo Cafe'}</h1>
            <p className="text-[9px] text-slate-400 font-medium flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" /> Table #{table?.number} ({table?.floor_name || 'Main Floor'})
            </p>
          </div>
        </div>
        <span className="bg-green-50 border border-green-200 text-green-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
          Active Seating
        </span>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* CENTER MENU GRID */}
        <div className="flex-1 flex flex-col overflow-y-auto pb-24 md:pb-6 p-4 space-y-4">
          
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-purple-800 to-purple-600 p-5 rounded-2xl text-white shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="space-y-1 z-10">
              <h2 className="text-base font-extrabold flex items-center gap-1">
                Welcome to Odoo Cafe <Sparkles className="w-4.5 h-4.5 text-amber-300" />
              </h2>
              <p className="text-[10px] text-purple-100 max-w-xs leading-relaxed">
                Scan, Browse, Order instantly from your phone. Enjoy delicious meals served directly to your table!
              </p>
            </div>
            <Utensils className="w-16 h-16 text-purple-500/20 absolute -right-2 -bottom-2" />
          </div>

          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 shadow-sm"
            />
          </div>

          {/* Categories Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                  selectedCategory === cat.id 
                    ? 'bg-slate-800 border-slate-800 text-white shadow-sm'
                    : 'bg-white border-[#e2e8f0] text-slate-500 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-xs">No items found matching criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredProducts.map(product => (
                <div 
                  key={product.id}
                  className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow relative"
                >
                  <div className="h-28 w-full bg-slate-100 overflow-hidden relative">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover"/>
                    <span className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 px-1.5 py-0.5 rounded text-[8px] font-semibold text-slate-500">
                      {product.country}
                    </span>
                  </div>
                  <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{product.name}</h4>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">{product.category}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-black text-slate-800">₹{product.price.toFixed(2)}</span>
                      <button
                        onClick={() => addToCart(product)}
                        className="p-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIDE CART SCREEN (Absolute on mobile, sidebar on desktop) */}
        <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-[#e2e8f0] flex flex-col justify-between fixed bottom-0 left-0 right-0 md:relative z-25 max-h-[70vh] md:max-h-none shadow-lg md:shadow-none">
          <div className="p-4 border-b border-[#e2e8f0] flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShoppingBag className="w-4 h-4 text-purple-600" />
              <span>Checkout Order</span>
            </div>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Your cart is empty. Tap "+" to add menu items.
              </div>
            ) : (
              <>
                <div className="space-y-3 border-b border-slate-100 pb-3 max-h-36 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{item.product.name}</p>
                        <span className="text-[10px] text-slate-400">₹{item.product.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center border border-slate-200 bg-slate-50 rounded-lg overflow-hidden scale-90">
                        <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:bg-slate-100 text-slate-500">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-[10px] font-bold text-slate-700">{item.quantity}</span>
                        <button onClick={() => addToCart(item.product)} className="p-1 hover:bg-slate-100 text-slate-500">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-slate-800 text-right w-16">
                        ₹{(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Name & Promo Panel */}
                <div className="space-y-2 pt-1.5">
                  <input
                    type="text"
                    placeholder="Your Name (Optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Add special requests..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700"
                  />

                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-700 px-2 py-1.5 rounded-lg text-[10px]">
                      <span className="font-medium">Applied: {appliedPromo.code}</span>
                      <button onClick={() => setAppliedPromo(null)} className="text-green-700 font-bold hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Coupon Code"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-[10px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700 uppercase"
                      />
                      <button onClick={handleApplyPromo} className="px-3 bg-slate-800 text-white rounded-lg text-[10px] font-semibold hover:bg-slate-700">
                        Apply
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-[9px] text-red-500">{promoError}</p>}
                </div>
              </>
            )}
          </div>

          {/* Pricing calculations */}
          <div className="p-4 bg-slate-50 border-t border-[#e2e8f0] space-y-3">
            <div className="space-y-1 text-[10px] text-slate-500 border-b border-dashed border-slate-200 pb-2">
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
              <div className="flex justify-between text-xs font-bold text-slate-800 pt-1">
                <span>Total Due</span>
                <span className="text-purple-700">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={cart.length === 0}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Place Digital Order
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
