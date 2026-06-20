import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, DollarSign, ShoppingBag, Plus, Trash2, 
  Edit3, X, ToggleLeft, ToggleRight, Coffee, 
  Utensils, Percent, Save, Calendar
} from 'lucide-react';
import type { Product, Category, SeatingTable, PromoCode, Order } from '../../types';

interface AdminViewProps {
  products: Product[];
  categories: Category[];
  tables: SeatingTable[];
  promoCodes: PromoCode[];
  orders: Order[];
  onUpdateProducts: (products: Product[]) => void;
  onUpdateCategories: (categories: Category[]) => void;
  onUpdateTables: (tables: SeatingTable[]) => void;
  onUpdatePromoCodes: (promoCodes: PromoCode[]) => void;
  setActiveView: (view: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  products,
  categories,
  tables,
  promoCodes,
  orders,
  onUpdateProducts,
  onUpdateCategories,
  onUpdateTables,
  onUpdatePromoCodes,
  setActiveView
}) => {
  // Tabs management
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'tables' | 'promos'>('products');

  // Stats computed from order history
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);
    const aov = totalOrders > 0 ? (revenue / totalOrders) : 0;
    return { totalOrders, revenue, aov };
  }, [orders]);

  // FORM STATES: Add Product Form
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('meal');
  const [newProdCountry, setNewProdCountry] = useState('India');
  const [newProdImage, setNewProdImage] = useState('');

  // FORM STATES: Add Promo Form
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'fixed'>('percentage');
  const [newPromoValue, setNewPromoValue] = useState('');

  // Editing Category state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryColor, setEditingCategoryColor] = useState('');

  // Handlers for Products
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;
    const priceNum = parseFloat(newProdPrice);
    if (isNaN(priceNum)) return;

    const newProd: Product = {
      id: `p-${Date.now()}`,
      name: newProdName,
      price: priceNum,
      category: newProdCategory,
      image: newProdImage.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60',
      available: true,
      popularity: 4,
      costIndex: 2,
      country: newProdCountry
    };

    onUpdateProducts([...products, newProd]);
    
    // reset form
    setNewProdName('');
    setNewProdPrice('');
    setNewProdImage('');
  };

  const handleDeleteProduct = (id: string) => {
    onUpdateProducts(products.filter(p => p.id !== id));
  };

  const toggleAvailability = (id: string) => {
    onUpdateProducts(products.map(p => 
      p.id === id ? { ...p, available: !p.available } : p
    ));
  };

  // Handlers for Promos
  const handleAddPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoValue) return;
    const valNum = parseFloat(newPromoValue);
    if (isNaN(valNum)) return;

    const newPromo: PromoCode = {
      code: newPromoCode.trim().toUpperCase(),
      discountType: newPromoType,
      value: valNum,
      active: true
    };

    onUpdatePromoCodes([...promoCodes, newPromo]);
    setNewPromoCode('');
    setNewPromoValue('');
  };

  const togglePromo = (code: string) => {
    onUpdatePromoCodes(promoCodes.map(p => 
      p.code === code ? { ...p, active: !p.active } : p
    ));
  };

  const handleDeletePromo = (code: string) => {
    onUpdatePromoCodes(promoCodes.filter(p => p.code !== code));
  };

  // Handlers for Tables
  const updateTableStatus = (id: string, status: SeatingTable['status']) => {
    onUpdateTables(tables.map(t => 
      t.id === id ? { ...t, status } : t
    ));
  };

  // Handlers for Categories
  const handleSaveCategoryColor = (id: string) => {
    onUpdateCategories(categories.map(c => 
      c.id === id ? { ...c, color: editingCategoryColor } : c
    ));
    setEditingCategoryId(null);
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto bg-[#f8fafc] p-6 space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-[#e2e8f0]">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Enterprise Administration Portal</h1>
          <p className="text-xs text-slate-400">Configure catalog options, seating tables, active promotional rates, and monitor financials.</p>
        </div>
        <button
          onClick={() => setActiveView('products')}
          className="text-xs px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all shadow-sm"
        >
          Return to POS Terminal
        </button>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Orders Card */}
        <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Orders</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalOrders}</p>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">${stats.revenue.toFixed(2)}</p>
          </div>
        </div>

        {/* Average Order Value Card */}
        <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-purple-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Order Value</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">${stats.aov.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* TABS CONTROLLERS */}
      <div className="flex border-b border-[#e2e8f0]">
        {[
          { id: 'products', label: 'Product Catalog', icon: Coffee },
          { id: 'categories', label: 'Category Mappings', icon: Utensils },
          { id: 'tables', label: 'Table Arrangements', icon: Calendar },
          { id: 'promos', label: 'Promos & Codes', icon: Percent },
        ].map(tab => {
          const IconC = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs tracking-wide transition-all ${
                isSel
                  ? 'border-odoo text-odoo'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              <IconC className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* DATA SHEETS CONTAINER */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
        
        {/* PRODUCTS SHEET */}
        {activeTab === 'products' && (
          <div className="divide-y divide-[#e2e8f0]">
            {/* Add Product Inline Form */}
            <form onSubmit={handleAddProduct} className="p-5 bg-slate-50/50 grid grid-cols-1 md:grid-cols-5 gap-3.5 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samosa Chaat"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5.99"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Category</label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800"
                >
                  <option value="meal">Meals</option>
                  <option value="beverages">Beverages</option>
                  <option value="dessert">Desserts</option>
                  <option value="chaat">Chaat</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Origin Country</label>
                <input
                  type="text"
                  placeholder="e.g. India"
                  value={newProdCountry}
                  onChange={(e) => setNewProdCountry(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full text-xs py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </form>

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Item Details</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Stock Status</th>
                    <th className="p-4">Popularity</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(product => (
                    <tr key={product.id} className="hover:bg-slate-50/50">
                      <td className="p-4 flex items-center gap-3">
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-10 h-10 object-cover rounded-lg border border-[#e2e8f0]"
                        />
                        <div>
                          <p className="font-bold text-slate-800">{product.name}</p>
                          <span className="text-[10px] text-slate-400">Origin: {product.country}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600">
                          {product.category}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        ${product.price.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleAvailability(product.id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold ${
                            product.available ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {product.available ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-green-500" /> Available
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-slate-300" /> Out of stock
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex text-amber-400 font-bold">
                          {'★'.repeat(product.popularity)}
                          <span className="text-slate-200">{'★'.repeat(5 - product.popularity)}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CATEGORIES SHEET */}
        {activeTab === 'categories' && (
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Category Mappings Table */}
              <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Category Name</th>
                      <th className="p-4">Accent Theme Tag</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.filter(c => c.id !== 'all').map(cat => (
                      <tr key={cat.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-800 uppercase tracking-wide">
                          {cat.name}
                        </td>
                        <td className="p-4">
                          {editingCategoryId === cat.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editingCategoryColor}
                                onChange={(e) => setEditingCategoryColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border border-[#e2e8f0] p-0 bg-transparent"
                              />
                              <span className="text-xs text-slate-500 font-mono uppercase">{editingCategoryColor}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full border border-black/10" 
                                style={{ backgroundColor: cat.color }} 
                              />
                              <span className="text-slate-600 font-mono uppercase">{cat.color}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {editingCategoryId === cat.id ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleSaveCategoryColor(cat.id)}
                                className="p-1 bg-green-50 border border-green-200 text-green-600 rounded-lg hover:bg-green-100"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingCategoryId(null)}
                                className="p-1 bg-red-50 border border-red-200 text-red-500 rounded-lg hover:bg-red-100"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditingCategoryColor(cat.color);
                              }}
                              className="text-xs font-semibold text-odoo hover:underline flex items-center gap-1 ml-auto"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Change Color
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Informative description Box */}
              <div className="bg-slate-50 border border-[#e2e8f0] p-5 rounded-xl space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Theme Settings Overview</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  These category colors set the primary highlights and UI identifiers used across the terminal screens.
                  Using a consistent color palette ensures visual harmony. Choose low-saturation palettes that blend cleanly with the light theme.
                </p>
                <div className="p-3 bg-white border border-[#e2e8f0] rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accent Palette Hint</span>
                  <div className="flex gap-2 mt-2">
                    <span className="w-6 h-6 rounded-full bg-[#714B67]" title="Odoo Aubergine"/>
                    <span className="w-6 h-6 rounded-full bg-[#1e3a8a]" title="Navy Corporate"/>
                    <span className="w-6 h-6 rounded-full bg-[#f8fafc]" title="Slate Base"/>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TABLES ARRANGEMENT SHEET */}
        {activeTab === 'tables' && (
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tables.map(table => {
                const getStatusColor = (status: SeatingTable['status']) => {
                  switch (status) {
                    case 'Occupied': return 'border-red-200 bg-red-50 text-red-700';
                    case 'Reserved': return 'border-amber-200 bg-amber-50 text-amber-700';
                    default: return 'border-green-200 bg-green-50 text-green-700';
                  }
                };
                return (
                  <div 
                    key={table.id}
                    className={`border rounded-xl p-4 flex flex-col justify-between h-36 transition-all bg-white hover:shadow-sm ${
                      table.status === 'Occupied' ? 'border-red-100 hover:border-red-200' :
                      table.status === 'Reserved' ? 'border-amber-100 hover:border-amber-200' :
                      'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-extrabold text-slate-800">Table #{table.number}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">Cap: {table.capacity}</span>
                      </div>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 border ${getStatusColor(table.status)}`}>
                        {table.status}
                      </span>
                    </div>

                    <div className="space-y-1 mt-3 pt-2 border-t border-slate-100">
                      <label className="block text-[8px] text-slate-400 font-bold uppercase">Update Seating</label>
                      <select
                        value={table.status}
                        onChange={(e) => updateTableStatus(table.id, e.target.value as any)}
                        className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded p-1 focus:outline-none font-semibold text-slate-700"
                      >
                        <option value="Available">Available</option>
                        <option value="Occupied">Occupied</option>
                        <option value="Reserved">Reserved</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROMOS SHEET */}
        {activeTab === 'promos' && (
          <div className="divide-y divide-[#e2e8f0]">
            
            {/* Add Promo Code Form */}
            <form onSubmit={handleAddPromo} className="p-5 bg-slate-50/50 grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Promo Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAFE50"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Discount Type</label>
                <select
                  value={newPromoType}
                  onChange={(e) => setNewPromoType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Cash ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Discount Value</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. 10"
                  value={newPromoValue}
                  onChange={(e) => setNewPromoValue(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-odoo focus:border-odoo text-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full text-xs py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Promo Code
              </button>
            </form>

            {/* Promo Codes Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Promo Code</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Discount Value</th>
                    <th className="p-4">Active Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promoCodes.map(promo => (
                    <tr key={promo.code} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-800 uppercase tracking-wide">
                        {promo.code}
                      </td>
                      <td className="p-4 uppercase text-slate-500">
                        {promo.discountType}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {promo.discountType === 'percentage' ? `${promo.value}%` : `$${promo.value.toFixed(2)}`}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => togglePromo(promo.code)}
                          className={`flex items-center gap-1.5 text-xs font-semibold ${
                            promo.active ? 'text-green-600' : 'text-slate-400'
                          }`}
                        >
                          {promo.active ? (
                            <>
                              <ToggleRight className="w-5 h-5 text-green-500" /> Active
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-5 h-5 text-slate-300" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeletePromo(promo.code)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
