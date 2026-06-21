import React, { useState, useEffect } from 'react';
import { Store, MapPin, Phone, Users, Calendar, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { io } from 'socket.io-client';

export const PantryHomeView: React.FC = () => {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);

  useEffect(() => {
    // Initial Fetch
    const fetchShops = async () => {
      try {
        const res = await fetch('/api/public/shops/status');
        const data = await res.json();
        setShops(data);
        if (data.length > 0) {
          setSelectedShopId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load shop statuses', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShops();

    // Setup WebSocket for Real-Time Updates
    const socket = io();
    
    // We join the global broadcast or individual shops if needed. 
    // In our backend, TABLE_UPDATED is broadcasted globally or to rooms.
    socket.emit('join_shop', {}); 

    const handleMessage = (data: any) => {
      try {
        const { type, payload } = data;
        if (type === 'TABLE_UPDATED') {
          // Update the specific table within the specific shop
          setShops(prev => prev.map(shop => {
            const hasTable = shop.tables.some((t: any) => t.id === payload.id);
            if (!hasTable) return shop;
            return {
              ...shop,
              tables: shop.tables.map((t: any) => t.id === payload.id ? {
                ...t,
                status: payload.status,
                seats: payload.seats,
                occupied_seats: payload.occupied_seats
              } : t)
            };
          }));
        }
      } catch (err) {
        console.error('Socket parse error', err);
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
      socket.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Loading Branches...</p>
      </div>
    );
  }

  const selectedShop = shops.find(s => s.id === selectedShopId) || shops[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">Odoo Cafe Pantry</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Live Branch Status</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.href = '/login'}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <Users className="w-4 h-4" /> Staff Login
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Branch Selector */}
        <div className="mb-12">
          <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" /> Select a Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map(shop => {
              const isActive = shop.id === selectedShopId;
              const totalTables = shop.tables.length;
              const availableTables = shop.tables.filter((t: any) => t.status === 'Available' || (t.status === 'Occupied' && (t.occupied_seats || 0) < t.seats)).length;
              
              return (
                <button
                  key={shop.id}
                  onClick={() => setSelectedShopId(shop.id)}
                  className={`relative p-5 rounded-2xl border text-left transition-all cursor-pointer overflow-hidden ${
                    isActive 
                      ? 'bg-purple-600 border-purple-600 text-white shadow-xl shadow-purple-200 translate-y-[-4px]' 
                      : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <h3 className={`font-black text-lg ${isActive ? 'text-white' : 'text-slate-900'}`}>{shop.name}</h3>
                    {isActive && <CheckCircle2 className="w-5 h-5 text-white/90" />}
                  </div>
                  <div className={`text-xs space-y-1.5 relative z-10 ${isActive ? 'text-purple-100' : 'text-slate-500'}`}>
                    <p className="flex items-center gap-2 font-medium">
                      <MapPin className="w-3.5 h-3.5 opacity-70" /> {shop.address || 'Address not provided'}
                    </p>
                    <p className="flex items-center gap-2 font-medium">
                      <Phone className="w-3.5 h-3.5 opacity-70" /> {shop.phone || 'Phone not provided'}
                    </p>
                  </div>
                  <div className={`mt-5 pt-4 border-t flex justify-between items-center relative z-10 ${isActive ? 'border-purple-500/50' : 'border-slate-100'}`}>
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${isActive ? 'text-purple-200' : 'text-slate-400'}`}>Availability</p>
                      <p className={`font-black text-sm ${isActive ? 'text-white' : 'text-slate-800'}`}>
                        {availableTables} / {totalTables} Tables
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Seating for Selected Branch */}
        {selectedShop && (
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedShop.name}</h2>
                <p className="text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                  <Clock className="w-4 h-4" /> Live Seating Status
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {selectedShop.tables.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No tables available in this branch yet</p>
                </div>
              )}
              {selectedShop.tables.sort((a: any, b: any) => a.table_number - b.table_number).map((table: any) => {
                const occupied = table.occupied_seats || 0;
                const capacity = table.seats;
                const availableSeats = capacity - occupied;
                
                // Determine computed status: If availableSeats > 0, it's partially available even if marked occupied
                let badgeColor = 'bg-green-100 text-green-700 border-green-200';
                let badgeText = 'Available';
                
                if (table.status === 'Maintenance') {
                  badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';
                  badgeText = 'Maintenance';
                } else if (availableSeats === 0 || table.status === 'Reserved') {
                  badgeColor = 'bg-red-100 text-red-700 border-red-200';
                  badgeText = 'Full';
                } else if (occupied > 0 && availableSeats > 0) {
                  badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
                  badgeText = 'Partially Open';
                }

                const canBook = table.status !== 'Maintenance' && availableSeats > 0;

                return (
                  <div key={table.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-white rounded-bl-full -z-10" />
                    
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-2xl font-black text-slate-800 tracking-tighter">T-{table.table_number}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-6">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-600">
                          {occupied} / {capacity} Occupied
                        </span>
                      </div>
                    </div>

                    <button
                      disabled={!canBook}
                      onClick={() => window.location.href = `/?customer=true&tableId=${table.id}&token=${table.qr_token || table.id}`}
                      className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        canBook 
                          ? 'bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-200 hover:border-purple-600 cursor-pointer shadow-sm'
                          : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      {canBook ? (
                        <>Scan & Book (Demo) <ArrowRight className="w-3.5 h-3.5" /></>
                      ) : (
                        'Table Unavailable'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
