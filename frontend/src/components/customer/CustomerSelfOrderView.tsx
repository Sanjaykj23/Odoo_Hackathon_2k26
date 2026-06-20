import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ShoppingBag, Search, Plus, Minus, Check, AlertCircle, 
  Coffee, CookingPot, Utensils, Sparkles, MapPin, Users, Phone, Mail, User, X, CreditCard, Landmark, History
} from 'lucide-react';
import { io } from 'socket.io-client';
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

  // Customer Seating Reservation State
  const [isReserved, setIsReserved] = useState(false);
  const [guestCount, setGuestCount] = useState(2);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [reservationError, setReservationError] = useState('');
  const [reserving, setReserving] = useState(false);

  // Table History
  const [tableHistory, setTableHistory] = useState<any[]>([]);

  // Customer Cart States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');
  
  // Checkout states
  const [paymentMethod, setPaymentMethod] = useState<'Razorpay' | 'COD'>('Razorpay');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Responsive mobile drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Active placed order tracking state
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  // Stable refs for socket handler — avoids socket recreation on every state change
  const activeOrderRef = useRef<any>(null);
  const tableRef = useRef<any>(null);
  activeOrderRef.current = activeOrder;
  tableRef.current = table;

  // Load Razorpay Script on mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Fetch Table Menu Details on mount
  useEffect(() => {
    // The QR code embeds the qr_token. If it's missing, try using tableId directly.
    const tokenToUse = qrToken || tableId;
    if (!tokenToUse) {
      setError('Missing QR token. Please scan the QR Code on your table again.');
      setLoading(false);
      return;
    }

    const fetchMenu = async () => {
      try {
        const tokenToUse = qrToken || tableId;
        const res = await fetch(`/api/public/table/${tokenToUse}`);
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

        // Check if this specific device has already joined this table session
        const hasJoinedLocally = localStorage.getItem(`joined_table_${tokenToUse}`);
        if (hasJoinedLocally === 'true') {
          setIsReserved(true);
          
          // Try to recover phone from local storage if available so we can send it with future orders
          const savedPhone = localStorage.getItem('customerPhone');
          if (savedPhone) {
            setCustomerPhone(savedPhone);
          }
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error connecting to Odoo Cafe.');
        setLoading(false);
      }
    };

    fetchMenu();
  }, [qrToken, tableId]);

  // Fetch table history if reserved
  useEffect(() => {
    if (!isReserved || !table?.id) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/public/tables/${table.id}/history`);
        if (res.ok) {
          const data = await res.json();
          setTableHistory(data);
        }
      } catch (err) {
        console.error('Failed to load table order history:', err);
      }
    };

    fetchHistory();
  }, [isReserved, table?.id, activeOrder]);

  // WebSocket Live Updates — stable socket that only reconnects when shop changes
  useEffect(() => {
    if (!shop?.id) return;

    const socket = io('', {
      transports: ['polling', 'websocket'],
      autoConnect: false,
    });

    socket.once('connect', () => socket.emit('join_shop', { shop_id: shop.id }));
    socket.connect();

    const handleMessage = (data: any) => {
      try {
        const { type, payload } = data;
        if (type === 'ORDER_UPDATED') {
          if (activeOrderRef.current && payload.id === activeOrderRef.current.id) {
            setActiveOrder(payload);
          }
          if (tableRef.current?.id) {
            fetch(`/api/public/tables/${tableRef.current.id}/history`)
              .then(res => res.json())
              .then(data => setTableHistory(data))
              .catch(() => {});
          }
        }
        if (type === 'TABLE_UPDATED' && tableRef.current && payload.id === tableRef.current.id) {
          setTable((prev: any) => ({ ...prev, status: payload.status, seats: payload.seats, occupied_seats: payload.occupied_seats }));
          
          if (payload.status === 'Available') {
            setIsReserved(false);
            setCart([]);
            setTableHistory([]);
            setActiveOrder(null);
            
            // Clear local storage for this table
            const tokenToUse = qrToken || tableId;
            localStorage.removeItem(`joined_table_${tokenToUse}`);
          }
        }
      } catch (err) {
        console.error('[Socket] Failed to process real-time packet:', err);
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
      socket.disconnect();
    };
  }, [shop?.id]);  // ← only reconnect when the shop changes, NOT on every order update

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

  // History calculations
  const historyTotal = useMemo(() => {
    return tableHistory.reduce((sum, order) => {
      if (order.status !== 'Cancelled') {
        return sum + parseFloat(order.total_amount);
      }
      return sum;
    }, 0);
  }, [tableHistory]);

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

  // Handle Seating Reservation
  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    setReservationError('');
    setReserving(true);

    if (!customerName.trim()) {
      setReservationError('Name is required.');
      setReserving(false);
      return;
    }
    if (!customerPhone.trim()) {
      setReservationError('Phone number is required for notifications.');
      setReserving(false);
      return;
    }

    try {
      const res = await fetch(`/api/public/tables/${qrToken}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_count: guestCount,
          customer_name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete reservation.');
      }

      setIsReserved(true);
      
      // Save locally to remember this device
      const tokenToUse = qrToken || tableId;
      localStorage.setItem(`joined_table_${tokenToUse}`, 'true');
      if (customerPhone.trim()) {
        localStorage.setItem('customerPhone', customerPhone.trim());
      }
    } catch (err: any) {
      setReservationError(err.message || 'Error processing reservation.');
    } finally {
      setReserving(false);
    }
  };

  // Handle Order Placing
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);

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
      customer_name: customerName.trim() || 'Table Guest',
      customer_phone: customerPhone.trim(),
      guest_count: guestCount
    };

    try {
      // 1. Create the order in Draft status first
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error || 'Failed to create order.');

      // 2. Checkout based on payment method
      if (paymentMethod === 'Razorpay') {
        // Razorpay Sandbox checkout flow
        const payOrderRes = await fetch('/api/payments/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderData.id })
        });
        const payOrderData = await payOrderRes.json();
        
        if (!payOrderRes.ok) {
          throw new Error(payOrderData.error || 'Razorpay initialization failed.');
        }

        const options = {
          key: payOrderData.key,
          amount: payOrderData.amount,
          currency: payOrderData.currency,
          name: shop?.name || 'Odoo Cafe',
          description: `Table Order Verification #${orderData.order_number}`,
          order_id: payOrderData.razorpay_order_id,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch('/api/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: orderData.id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  is_mock: payOrderData.is_mock
                })
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) {
                throw new Error(verifyData.error || 'Signature validation failed.');
              }

              setActiveOrder({
                id: orderData.id,
                ticketNumber: orderData.order_number,
                status: 'To Cook',
                total: totals.total
              });
              setCart([]);
              setIsCartOpen(false);
              setNotes('');
            } catch (err: any) {
              alert(`Payment verification error: ${err.message}`);
            }
          },
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone
          },
          notes: {
            order_id: orderData.id
          },
          theme: {
            color: '#714B67'
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert(`Payment failed: ${response.error.description}`);
        });
        rzp.open();
      } else {
        // COD checkout flow (Status moves to 'To Pay' and alerts branch manager)
        const codRes = await fetch(`/api/public/orders/${orderData.id}/checkout/cod`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: customerPhone })
        });
        const codData = await codRes.json();
        
        if (!codRes.ok) throw new Error(codData.error || 'Failed to initialize COD checkout.');

        setActiveOrder({
          id: orderData.id,
          ticketNumber: orderData.order_number,
          status: 'To Cook',
          total: totals.total,
          is_cod: true
        });
        setCart([]);
        setIsCartOpen(false);
        setNotes('');
      }
    } catch (err: any) {
      alert(err.message || 'Error executing checkout.');
    } finally {
      setCheckoutLoading(false);
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
        <div className="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm text-center shadow-lg space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 font-sans">Connection Error</h2>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">{error}</p>
          <p className="text-[10px] text-slate-400 font-sans">Ask server/waiter for assistance with table configuration.</p>
        </div>
      </div>
    );
  }

  // Seating headcount registration modal overlay
  if (!isReserved) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background blobs to keep aesthetics high */}
        <div className="absolute top-[-10%] left-[-10%] w-72 h-72 rounded-full bg-purple-100 filter blur-3xl opacity-50 z-0"/>
        <div className="absolute bottom-[-10%] right-[-10%] w-72 h-72 rounded-full bg-pink-100 filter blur-3xl opacity-50 z-0"/>

        <div className="bg-white border border-slate-200/60 p-6 rounded-3xl w-full max-w-md shadow-xl space-y-5 z-10 relative">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-700 mx-auto mb-2 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Table Seating Registry</h2>
            <p className="text-xs text-slate-400">
              Welcome to <span className="font-semibold text-slate-600">{shop?.name || 'Odoo Cafe'}</span> • Table #{table?.number}
            </p>
          </div>

          <form onSubmit={handleReserve} className="space-y-4">
            {reservationError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{reservationError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-600" /> Your Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-purple-600" /> WhatsApp Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. +919876543210"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800"
              />
              <p className="text-[9px] text-slate-400">Confirmation digital tickets will be dispatched to this number.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-purple-600" /> Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="e.g. john@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800"
              />
            </div>

            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-700">Number of Guests</label>
                <p className="text-[9px] text-slate-400">
                  {table?.seats - (table?.occupied_seats || 0)} of {table?.seats} Seats Available
                </p>
              </div>
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                  className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-black text-slate-800 w-4 text-center">{guestCount}</span>
                <button
                  type="button"
                  onClick={() => setGuestCount(prev => Math.min(table?.seats - (table?.occupied_seats || 0), prev + 1))}
                  className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-30"
                  disabled={guestCount >= (table?.seats - (table?.occupied_seats || 0))}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={reserving}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {reserving ? 'Registering Seating...' : 'Validate & Open Menu'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active placed order tracking view
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
            <p className="text-xs text-slate-400 mt-1">
              Ticket Number: <span className="font-bold text-slate-700">{activeOrder.ticketNumber}</span>
            </p>
            {activeOrder.is_cod && (
              <span className="mt-2 inline-block bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold px-2.5 py-0.5 rounded-full">
                COD: Pay ₹{activeOrder.total?.toFixed(2)} to Server
              </span>
            )}
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

  const handleEndSession = async () => {
    const confirm = window.confirm('Are you sure you want to end your dining session?');
    if (!confirm) return;

    try {
      const res = await fetch(`/api/public/tables/${table.id}/end-session`, {
        method: 'POST'
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to end session.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans relative">
      
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
        <div className="flex items-center gap-1.5">
          <span className="bg-green-50 border border-green-200 text-green-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Seated
          </span>
          <button 
            onClick={handleEndSession}
            className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider cursor-pointer transition-colors"
          >
            End Session
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-7xl mx-auto w-full relative">
        
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

          {/* Table history display (so guests can see what's ordered today at their table) */}
          {tableHistory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <History className="w-4 h-4 text-purple-600" /> Current Table Seating History
                </h3>
                <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full text-[9px]">
                  Total: ₹{historyTotal.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto divide-y divide-slate-100">
                {tableHistory.map((histOrder: any) => (
                  <div key={histOrder.id} className="pt-2 flex justify-between items-start text-[11px]">
                    <div>
                      <p className="font-bold text-slate-700">Order {histOrder.order_number} ({histOrder.customer_name})</p>
                      <ul className="text-[10px] text-slate-400 list-disc list-inside">
                        {histOrder.items?.map((item: any, itemIdx: number) => (
                          <li key={itemIdx}>{item.product_name} x{item.quantity}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        histOrder.kds_status === 'Completed' ? 'bg-green-50 text-green-700 border border-green-150' : 'bg-purple-50 text-purple-700 border border-purple-150'
                      }`}>
                        {histOrder.kds_status}
                      </span>
                      <p className="font-extrabold text-slate-800 mt-1">₹{parseFloat(histOrder.total_amount).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800 shadow-sm"
            />
          </div>

          {/* Categories Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
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
                    <span className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500">
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

        {/* PERSISTENT FLOATING BOTTOM VIEW CART BAR FOR MOBILE */}
        {cart.length > 0 && !isCartOpen && (
          <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-purple-800 text-white p-3 rounded-2xl flex items-center justify-between shadow-lg animate-bounce">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <div>
                <p className="text-xs font-bold">{cart.reduce((sum, item) => sum + item.quantity, 0)} Items</p>
                <p className="text-[10px] text-purple-200">Total: ₹{totals.total.toFixed(2)}</p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-white text-purple-800 font-extrabold text-xs px-4 py-2 rounded-xl"
            >
              View Cart
            </button>
          </div>
        )}

        {/* SIDE CART / BOTTOM DRAWER SCREEN (Slide up on mobile, sidebar on desktop) */}
        <div className={`
          ${isCartOpen ? 'translate-y-0 opacity-100' : 'translate-y-full md:translate-y-0 opacity-0 md:opacity-100'} 
          w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-[#e2e8f0] flex flex-col justify-between 
          fixed bottom-0 left-0 right-0 md:relative z-50 md:z-25 
          max-h-[85vh] md:max-h-none h-[85vh] md:h-auto shadow-2xl md:shadow-none transition-all duration-300 ease-in-out
          rounded-t-3xl md:rounded-t-none
        `}>
          {/* Header of Drawer */}
          <div className="p-4 border-b border-[#e2e8f0] flex justify-between items-center bg-slate-50 md:bg-white rounded-t-3xl md:rounded-t-none">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShoppingBag className="w-4.5 h-4.5 text-purple-600" />
              <span>Checkout Order</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-slate-200/60 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
              </span>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="md:hidden p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Your cart is empty. Tap "+" to add menu items.
              </div>
            ) : (
              <>
                <div className="space-y-3 border-b border-slate-100 pb-3 max-h-36 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{item.product.name}</p>
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
                      <span className="font-black text-slate-800 text-right w-16">
                        ₹{(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Name & Notes Panel */}
                <div className="space-y-2 pt-1.5">
                  <input
                    type="text"
                    placeholder="Add special requests..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700"
                  />

                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-xl text-[10px]">
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
                        className="flex-1 px-3 py-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 uppercase"
                      />
                      <button onClick={handleApplyPromo} className="px-3 bg-slate-800 text-white rounded-xl text-[10px] font-bold hover:bg-slate-700">
                        Apply
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-[9px] text-red-500 px-1">{promoError}</p>}
                </div>

                {/* Payment Option Picker */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Method</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('Razorpay')}
                      className={`p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        paymentMethod === 'Razorpay' 
                          ? 'border-purple-600 bg-purple-50/40 text-purple-700 font-bold'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <CreditCard className="w-4.5 h-4.5" />
                      <span className="text-[10px]">Razorpay Sandbox</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('COD')}
                      className={`p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                        paymentMethod === 'COD' 
                          ? 'border-purple-600 bg-purple-50/40 text-purple-700 font-bold'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Landmark className="w-4.5 h-4.5" />
                      <span className="text-[10px]">Cash on Delivery</span>
                    </button>
                  </div>
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
                <span className="text-purple-700 text-sm font-black">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={cart.length === 0 || checkoutLoading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {checkoutLoading 
                ? 'Processing...' 
                : paymentMethod === 'Razorpay' 
                  ? 'Pay & Confirm Order' 
                  : 'Place COD Order'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
