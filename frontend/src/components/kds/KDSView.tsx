import React, { useState, useEffect } from 'react';
import { 
  Clock, CheckCircle, Flame, CookingPot, RotateCcw, 
  Trash2, User, FileText, Check, ChevronRight
} from 'lucide-react';
import type { Order } from '../../types';

interface KDSViewProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => void;
  onToggleItemFulfillment: (orderId: string, itemIndex: number) => void;
  onClearOrder: (orderId: string) => void;
  setActiveView: (view: string) => void;
}

export const KDSView: React.FC<KDSViewProps> = ({
  orders,
  onUpdateOrderStatus,
  onToggleItemFulfillment,
  onClearOrder,
  setActiveView,
}) => {
  // Filter orders by status
  const toCookOrders = orders.filter(o => o.status === 'To Cook');
  const preparingOrders = orders.filter(o => o.status === 'Preparing');
  const completedOrders = orders.filter(o => o.status === 'Completed');

  // Simple simulation of ticking elapsed minutes
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1);
    }, 60000); // increment virtual clock count every minute
    return () => clearInterval(timer);
  }, []);

  // Sound chime when a new order is added to To Cook lane
  const prevCountRef = React.useRef(toCookOrders.length);

  useEffect(() => {
    if (toCookOrders.length > prevCountRef.current) {
      const chime = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav');
      chime.volume = 0.6;
      chime.play().catch(e => console.log('KDS Audio autoplay block:', e));
    }
    prevCountRef.current = toCookOrders.length;
  }, [toCookOrders.length]);

  // Helper to color-code ticket timing indicators cleanly
  const getElapsedTimeClass = (minutes: number) => {
    if (minutes > 20) return 'text-red-500 bg-red-50 border-red-200';
    if (minutes > 10) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-slate-500 bg-slate-50 border-slate-200';
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#f8fafc]">
      {/* Top Header */}
      <div className="p-4 bg-white border-b border-[#e2e8f0] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-odoo-trans text-odoo rounded-xl">
            <CookingPot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Kitchen Display System (KDS)</h1>
            <p className="text-xs text-slate-400">Real-time dish tracking & status dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 border border-slate-200">
            <Clock className="w-3.5 h-3.5" />
            Active Tickets: {orders.filter(o => o.status !== 'Completed').length}
          </span>
          <button
            onClick={() => setActiveView('products')}
            className="text-xs px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all"
          >
            Back to Terminal
          </button>
        </div>
      </div>

      {/* Kanban Lanes Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
        
        {/* LANE 1: TO COOK */}
        <div className="flex flex-col bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">To Cook</h2>
            </div>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-xs font-bold">
              {toCookOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {toCookOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <Flame className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-xs">No pending orders to cook</p>
              </div>
            ) : (
              toCookOrders.map(order => (
                <div 
                  key={order.id}
                  className="bg-white border border-[#e2e8f0] hover:border-slate-300 rounded-xl p-4 space-y-3 transition-shadow shadow-sm"
                >
                  {/* Ticket Metadata */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{order.ticketNumber}</span>
                        {order.tableNumber !== undefined && (
                          <span className="bg-purple-600/10 text-purple-700 border border-purple-600/20 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide">
                            Table {order.tableNumber}
                          </span>
                        )}
                      </div>
                      {order.customer && (
                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <User className="w-2.5 h-2.5 text-slate-400" /> {order.customer}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getElapsedTimeClass(order.elapsed)}`}>
                      {order.elapsed} min ago
                    </span>
                  </div>

                  {/* Order Items List */}
                  <div className="border-t border-slate-100 pt-2.5 space-y-2">
                    {order.items.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => onToggleItemFulfillment(order.id, idx)}
                        className="w-full flex items-center justify-between text-left group"
                      >
                        <span className={`text-xs select-none transition-colors ${
                          item.fulfilled 
                            ? 'line-through text-slate-300 font-normal' 
                            : 'text-slate-700 font-medium group-hover:text-slate-900'
                        }`}>
                          {item.quantity}x {item.product.name}
                        </span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          item.fulfilled 
                            ? 'bg-green-50 border-green-400 text-green-600' 
                            : 'border-slate-300 group-hover:border-slate-400 bg-white'
                        }`}>
                          {item.fulfilled && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="bg-amber-50/50 border border-amber-100 p-2 rounded-lg text-[10px] text-amber-700 flex items-start gap-1">
                      <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{order.notes}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onUpdateOrderStatus(order.id, 'Preparing')}
                      className="text-xs bg-slate-800 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-1"
                    >
                      Start Preparing
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* LANE 2: PREPARING */}
        <div className="flex flex-col bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Preparing</h2>
            </div>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-xs font-bold">
              {preparingOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {preparingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <Clock className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-xs">No orders in preparation</p>
              </div>
            ) : (
              preparingOrders.map(order => (
                <div 
                  key={order.id}
                  className="bg-white border border-[#e2e8f0] hover:border-slate-300 rounded-xl p-4 space-y-3 shadow-sm"
                >
                  {/* Ticket Metadata */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{order.ticketNumber}</span>
                        {order.tableNumber !== undefined && (
                          <span className="bg-purple-600/10 text-purple-700 border border-purple-600/20 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide">
                            Table {order.tableNumber}
                          </span>
                        )}
                      </div>
                      {order.customer && (
                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <User className="w-2.5 h-2.5 text-slate-400" /> {order.customer}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getElapsedTimeClass(order.elapsed)}`}>
                      {order.elapsed} min ago
                    </span>
                  </div>

                  {/* Order Items List */}
                  <div className="border-t border-slate-100 pt-2.5 space-y-2">
                    {order.items.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => onToggleItemFulfillment(order.id, idx)}
                        className="w-full flex items-center justify-between text-left group"
                      >
                        <span className={`text-xs select-none transition-colors ${
                          item.fulfilled 
                            ? 'line-through text-slate-300 font-normal' 
                            : 'text-slate-700 font-medium group-hover:text-slate-900'
                        }`}>
                          {item.quantity}x {item.product.name}
                        </span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          item.fulfilled 
                            ? 'bg-green-50 border-green-400 text-green-600' 
                            : 'border-slate-300 group-hover:border-slate-400 bg-white'
                        }`}>
                          {item.fulfilled && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="bg-amber-50/50 border border-amber-100 p-2 rounded-lg text-[10px] text-amber-700 flex items-start gap-1">
                      <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{order.notes}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onUpdateOrderStatus(order.id, 'To Cook')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Revert
                    </button>
                    <button
                      onClick={() => onUpdateOrderStatus(order.id, 'Completed')}
                      className="text-xs bg-odoo text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-odoo-dark transition-colors flex items-center gap-1 shadow-sm"
                    >
                      Complete Order
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* LANE 3: COMPLETED */}
        <div className="flex flex-col bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <h2 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Completed</h2>
            </div>
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-md text-xs font-bold">
              {completedOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {completedOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <CheckCircle className="w-8 h-8 mb-2 stroke-1" />
                <p className="text-xs">No orders completed yet</p>
              </div>
            ) : (
              completedOrders.map(order => (
                <div 
                  key={order.id}
                  className="bg-white border border-[#e2e8f0] hover:border-slate-300 rounded-xl p-4 space-y-3 shadow-sm opacity-80 hover:opacity-100 transition-opacity"
                >
                  {/* Ticket Metadata */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 line-through">{order.ticketNumber}</span>
                        {order.tableNumber !== undefined && (
                          <span className="bg-purple-600/10 text-purple-700 border border-purple-600/20 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide">
                            Table {order.tableNumber}
                          </span>
                        )}
                      </div>
                      {order.customer && (
                        <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <User className="w-2.5 h-2.5 text-slate-400" /> {order.customer}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Ready
                    </span>
                  </div>

                  {/* Order Items List */}
                  <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-400">
                        <span className="line-through">{item.quantity}x {item.product.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onUpdateOrderStatus(order.id, 'Preparing')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Re-cook
                    </button>
                    <button
                      onClick={() => onClearOrder(order.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
