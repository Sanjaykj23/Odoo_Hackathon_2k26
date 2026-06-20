import React, { useState, useEffect } from 'react';
import { Coffee, ShoppingCart, CheckCircle, CreditCard } from 'lucide-react';

export const CustomerDisplayView: React.FC = () => {
  const [cart, setCart] = useState<any[]>([]);
  const [totals, setTotals] = useState({ subtotal: 0, discount: 0, tax: 0, total: 0 });
  const [customerName, setCustomerName] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');

  // Synchronize cart from localStorage (standard double-monitor storage bridge)
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('customer_display_cart');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCart(parsed.cart || []);
          setTotals(parsed.totals || { subtotal: 0, discount: 0, tax: 0, total: 0 });
          setCustomerName(parsed.customerName || '');
          setAppliedPromo(parsed.appliedPromo || null);
          setCheckoutComplete(parsed.checkoutComplete || false);
          setReceiptNumber(parsed.receiptNumber || '');
        } catch (err) {
          console.error('Error parsing customer display data:', err);
        }
      } else {
        // Clear screen if storage is cleared
        setCart([]);
        setTotals({ subtotal: 0, discount: 0, tax: 0, total: 0 });
        setCustomerName('');
        setAppliedPromo(null);
        setCheckoutComplete(false);
        setReceiptNumber('');
      }
    };

    // Initialize
    handleStorageChange();

    // Listen to changes from POS terminal tab
    window.addEventListener('storage', handleStorageChange);
    
    // Poll storage local state check as helper
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Compute dynamic UPI Payment QR URL
  const upiQrUrl = (() => {
    const upiId = 'odoocafe@ybl';
    const payeeName = 'Odoo Cafe';
    const amount = totals.total.toFixed(2);
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
  })();

  if (checkoutComplete) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Thank You!</h1>
            <p className="text-slate-400 text-sm">Your payment has been successfully validated.</p>
            {receiptNumber && (
              <span className="inline-block bg-slate-800 text-slate-300 font-mono text-xs px-3 py-1.5 rounded-lg border border-slate-700">
                Receipt: {receiptNumber}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Your order has been queued for preparation. Enjoy your meal!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex font-sans overflow-hidden">
      
      {/* LEFT: CART BREAKDOWN */}
      <div className="flex-1 flex flex-col justify-between p-8 border-r border-slate-800">
        <div className="space-y-6 overflow-hidden flex flex-col flex-1">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md">
              <Coffee className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Odoo Cafe POS</h1>
              <p className="text-xs text-slate-500 font-medium">Customer Checkout Monitor</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                <ShoppingCart className="w-14 h-14 stroke-1" />
                <p className="text-sm font-semibold">Welcome! We are ready to take your order.</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{item.product.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">₹{item.product.price.toFixed(2)} x {item.quantity}</p>
                  </div>
                  <span className="text-sm font-black text-white">
                    ₹{(item.product.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic greeting banner */}
        {cart.length > 0 && customerName && (
          <div className="mt-4 p-3.5 bg-purple-600/10 border border-purple-500/20 text-purple-300 rounded-xl text-xs font-semibold">
            Order for: <span className="text-white font-extrabold">{customerName}</span>
          </div>
        )}
      </div>

      {/* RIGHT: PRICING & PAYMENT */}
      <div className="w-[400px] bg-slate-950 p-8 flex flex-col justify-between">
        <div className="space-y-6">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-3">
            Summary Details
          </h2>
          
          <div className="space-y-3.5 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-slate-200 font-semibold">₹{totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Discounts Applied</span>
                <span className="font-semibold">-₹{totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>GST / Tax (5%)</span>
              <span className="text-slate-200 font-semibold">₹{totals.tax.toFixed(2)}</span>
            </div>
            
            <div className="border-t border-slate-850 pt-4 flex justify-between items-end">
              <span className="text-base font-bold text-white">Total Amount</span>
              <span className="text-2xl font-black text-purple-400">₹{totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* QR PAYMENTS PORTAL */}
        {cart.length > 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-center space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400">Scan to Pay Instantly</span>
              <p className="text-xs text-slate-500">Supports all UPI Apps (GPay, PhonePe, BHIM)</p>
            </div>
            
            <div className="w-48 h-48 bg-white rounded-xl p-2.5 mx-auto shadow-lg flex items-center justify-center border border-slate-700">
              <img 
                src={upiQrUrl} 
                alt="UPI Payment QR" 
                className="w-full h-full object-contain"
              />
            </div>
            
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 font-bold bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
              <CreditCard className="w-3.5 h-3.5" />
              UPI ID: odoocafe@ybl
            </span>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-dashed border-slate-800 p-6 rounded-2xl text-center text-slate-600 text-xs py-16">
            Scan and checkout totals will render dynamically on item addition.
          </div>
        )}
      </div>

    </div>
  );
};
