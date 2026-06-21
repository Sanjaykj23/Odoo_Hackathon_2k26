import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, DollarSign, ShoppingBag, Percent,
  ArrowUpRight, ArrowDownRight, Coffee, Activity, MapPin
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import type { Order, Shop } from '../../types';

// Register ChartJS plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AdminAnalyticsViewProps {
  orders: Order[];
  shops: Shop[];
  user: any;
}

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({ orders, shops, user }) => {
  const [selectedShopId, setSelectedShopId] = useState<string>('');

  // 1. Filter Orders by Selected Shop
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // SuperAdmin filtering
      if (user?.role === 'SuperAdmin' && selectedShopId) {
        return o.shop_id?.toString() === selectedShopId;
      }
      // Admin filtering (forced)
      if (user?.role !== 'SuperAdmin' && user?.shop_id) {
        return o.shop_id === user.shop_id;
      }
      return true; // Unfiltered for SuperAdmin
    });
  }, [orders, user, selectedShopId]);

  // 2. Compute Top Level Metrics
  const metrics = useMemo(() => {
    let revenue = 0;
    let discounts = 0;
    let completedOrders = 0;
    
    filteredOrders.forEach(o => {
      if (o.orderStatus !== 'Cancelled') {
        revenue += o.total;
        discounts += (o.discount || 0);
        completedOrders += 1;
      }
    });

    const aov = completedOrders > 0 ? revenue / completedOrders : 0;

    return { revenue, completedOrders, aov, discounts };
  }, [filteredOrders]);

  // 3. Compute Data for Charts
  const chartData = useMemo(() => {
    // Group by Date (or Hour if it's all today, but let's do Days for ERP)
    const salesByDate: Record<string, number> = {};
    const ordersByDate: Record<string, number> = {};
    const productFrequency: Record<string, number> = {};

    filteredOrders.forEach(o => {
      if (o.orderStatus === 'Cancelled') return;

      const d = new Date(o.createdAt);
      const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      salesByDate[dateKey] = (salesByDate[dateKey] || 0) + o.total;
      ordersByDate[dateKey] = (ordersByDate[dateKey] || 0) + 1;

      // Count products
      o.items.forEach(item => {
        productFrequency[item.product.name] = (productFrequency[item.product.name] || 0) + item.quantity;
      });
    });

    // Sort Dates chronologically (simplified by relying on key order if sequential, but let's just use keys)
    // Actually, orders are mostly sorted DESC from backend, so reverse it for left-to-right timeline
    const dateKeys = Object.keys(salesByDate).reverse();

    // Hot Items sorting
    const sortedProducts = Object.entries(productFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5); // Top 5

    return {
      dateKeys,
      salesData: dateKeys.map(k => salesByDate[k]),
      ordersData: dateKeys.map(k => ordersByDate[k]),
      topProducts: {
        labels: sortedProducts.map(([name]) => name),
        data: sortedProducts.map(([, qty]) => qty)
      }
    };
  }, [filteredOrders]);

  // Chart configs
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { 
      y: { border: { display: false }, grid: { color: '#f1f5f9' } },
      x: { border: { display: false }, grid: { display: false } }
    },
    elements: {
      line: { tension: 0.4 } // Smooth curves
    }
  };

  const lineData = {
    labels: chartData.dateKeys.length ? chartData.dateKeys : ['No Data'],
    datasets: [{
      label: 'Revenue',
      data: chartData.salesData.length ? chartData.salesData : [0],
      borderColor: '#9333ea', // purple-600
      backgroundColor: 'rgba(147, 51, 234, 0.1)',
      borderWidth: 3,
      fill: true,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: '#9333ea',
      pointBorderWidth: 2,
    }]
  };

  const barData = {
    labels: chartData.dateKeys.length ? chartData.dateKeys : ['No Data'],
    datasets: [{
      label: 'Orders',
      data: chartData.ordersData.length ? chartData.ordersData : [0],
      backgroundColor: '#3b82f6', // blue-500
      borderRadius: 6,
    }]
  };

  const doughnutData = {
    labels: chartData.topProducts.labels.length ? chartData.topProducts.labels : ['No Data'],
    datasets: [{
      data: chartData.topProducts.data.length ? chartData.topProducts.data : [1],
      backgroundColor: ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#cbd5e1'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 10 } } }
    },
    cutout: '70%'
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-[#f8fafc] min-h-full">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-600" />
            Executive Dashboard
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Real-time business analytics and ERP reports.</p>
        </div>

        {user?.role === 'SuperAdmin' && (
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <MapPin className="w-4 h-4 text-slate-400 ml-1" />
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="bg-transparent text-slate-700 text-xs font-bold focus:outline-none pr-2 cursor-pointer"
            >
              <option value="">All Branches / Global</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Gross Revenue</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">₹{metrics.revenue.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-green-600">
            <ArrowUpRight className="w-3.5 h-3.5" /> <span>Stable</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Total Orders</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">{metrics.completedOrders}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <TrendingUp className="w-3.5 h-3.5" /> <span>Volume</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Avg Order Value</p>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">₹{metrics.aov.toFixed(2)}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Coffee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <TrendingUp className="w-3.5 h-3.5" /> <span>Per Ticket</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Discounts Given</p>
              <h3 className="text-2xl font-black text-red-600 tracking-tighter">- ₹{metrics.discounts.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-red-500">
            <ArrowDownRight className="w-3.5 h-3.5" /> <span>Reductions</span>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend (Spans 2 columns on large screens) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Revenue Trend</h3>
            <p className="text-[10px] text-slate-400 font-medium">Daily gross sales over time</p>
          </div>
          <div className="flex-1 min-h-[250px] relative">
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>

        {/* Hot Selling Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Hot Sellers</h3>
            <p className="text-[10px] text-slate-400 font-medium">Top 5 items by volume</p>
          </div>
          <div className="flex-1 min-h-[200px] relative flex items-center justify-center">
            {chartData.topProducts.labels.length > 0 ? (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            ) : (
              <div className="text-center text-slate-400 text-xs font-bold">Not enough data</div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Charts / Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Order Volume Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Order Volume</h3>
            <p className="text-[10px] text-slate-400 font-medium">Number of tickets per day</p>
          </div>
          <div className="flex-1 min-h-[200px] relative">
            <Bar 
              data={barData} 
              options={{ 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { 
                  y: { border: { display: false }, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                  x: { border: { display: false }, grid: { display: false } }
                }
              }} 
            />
          </div>
        </div>

        {/* Top 5 List representation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Hot Selling Foods Menu</h3>
            <p className="text-[10px] text-slate-400 font-medium">Inform staff and customers of these popular items</p>
          </div>
          <div className="space-y-3 mt-4">
            {chartData.topProducts.labels.length > 0 ? (
              chartData.topProducts.labels.map((label, idx) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-purple-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-xs text-slate-700">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{chartData.topProducts.data[idx]} Sold</span>
                    <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[10px] font-black tracking-widest border border-orange-200">
                      🔥 HOT
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 text-xs font-bold py-8">No order data available to compute hot sellers.</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
