import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  TrendingUp, DollarSign, ShoppingBag, Plus, Trash2, 
  X, ToggleLeft, ToggleRight, Coffee, 
  Utensils, Percent, Calendar, Users, Key, Shield, User, MapPin, Phone,
  QrCode, Download, ChevronRight, ChevronLeft, Check, ArrowRight
} from 'lucide-react';
import type { Product, Category, SeatingTable, PromoCode, Order } from '../../types';
import { QRCodeSVG } from 'qrcode.react';

interface AdminViewProps {
  token: string | null;
  user: any;
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
  token,
  user,
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
<<<<<<< HEAD
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'tables' | 'promos' | 'users' | 'reports' | 'shops'>('products');
=======
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'tables' | 'promos' | 'users' | 'shops' | 'reports'>('products');
>>>>>>> ff227929a91111fd3e83001011bb6efa4634d10e

  // Backend state for Employees & Shops
  const [employees, setEmployees] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);

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

  // FORM STATES: Add User Account Form
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('Employee');
  const [newUserShopId, setNewUserShopId] = useState('');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // FORM STATES: Add Shop Form (SuperAdmin Only) — 3-step wizard
  const [shopWizardStep, setShopWizardStep] = useState<1 | 2 | 3>(1);
  const [newShopName, setNewShopName] = useState('');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [shopTableCount, setShopTableCount] = useState<string>('');
  const [shopTableCapacities, setShopTableCapacities] = useState<number[]>([]);
  const [shopError, setShopError] = useState('');
  const [shopSuccess, setShopSuccess] = useState('');
  // QR modal state
  const [qrModalTable, setQrModalTable] = useState<any | null>(null);
  const [shopTableQrData, setShopTableQrData] = useState<any[]>([]);


  // Password reset state
  const [passwordResetUserId, setPasswordResetUserId] = useState<number | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Initialize roles based on user role
  useEffect(() => {
    if (user?.role === 'SuperAdmin') {
      setNewUserRole('Admin');
    } else {
      setNewUserRole('Employee');
    }
  }, [user]);

  // Fetch users & shops
  const fetchUsersAndShops = async () => {
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      // Fetch employees
      const empRes = await fetch('/api/auth/employees', { headers });
      const empData = await empRes.json();
      if (Array.isArray(empData)) {
        setEmployees(empData);
      }

      // Fetch shops
      const shopRes = await fetch('/api/shops', { headers });
      const shopData = await shopRes.json();
      if (Array.isArray(shopData)) {
        setShops(shopData);
        if (shopData.length > 0 && !newUserShopId) {
          setNewUserShopId(shopData[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Error loading admin view references:', err);
    }
  };

  useEffect(() => {
    fetchUsersAndShops();
  }, [activeTab, token, user]);

  // Handlers for Products
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice || !token) return;
    const priceNum = parseFloat(newProdPrice);
    if (isNaN(priceNum)) return;

    const payload = {
      id: `p-${Date.now()}`,
      name: newProdName,
      price: priceNum,
      category_id: newProdCategory,
      image_url: newProdImage.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60',
      popularity: 4,
      cost_index: 2,
      country: newProdCountry || 'India',
      shop_id: user.shop_id || (shops.length > 0 ? shops[0].id : 1)
    };

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setNewProdName('');
        setNewProdPrice('');
        setNewProdImage('');
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to add product to database.');
      }
    } catch (err) {
      console.error('Error adding product:', err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!token) return;
    const confirmDelete = window.confirm('Are you sure you want to delete this product?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || 'Failed to delete product.');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  const toggleAvailability = async (id: string) => {
    if (!token) return;
    const product = products.find(p => p.id === id);
    if (!product) return;

    try {
      const response = await fetch(`/api/products/${id}/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_available: !product.available })
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || 'Failed to toggle availability.');
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
    }
  };

  // Handlers for Promos
  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoValue || !token) return;
    const valNum = parseFloat(newPromoValue);
    if (isNaN(valNum)) return;

    const payload = {
      code: newPromoCode.trim().toUpperCase(),
      discountType: newPromoType,
      value: valNum,
      shop_id: user.shop_id || (shops.length > 0 ? shops[0].id : 1)
    };

    try {
      const response = await fetch('/api/promos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setNewPromoCode('');
        setNewPromoValue('');
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to save promo code.');
      }
    } catch (err) {
      console.error('Error adding promo code:', err);
    }
  };

  const togglePromo = async (code: string) => {
    if (!token) return;
    const promo = promoCodes.find(p => p.code === code);
    if (!promo) return;

    try {
      const response = await fetch(`/api/promos/${code}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !promo.active })
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || 'Failed to update promo status.');
      }
    } catch (err) {
      console.error('Error toggling promo:', err);
    }
  };

  const handleDeletePromo = async (code: string) => {
    if (!token) return;
    const confirmDelete = window.confirm('Are you sure you want to delete this promo code?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/promos/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || 'Failed to delete promo code.');
      }
    } catch (err) {
      console.error('Error deleting promo:', err);
    }
  };

  // Handlers for Tables
  const updateTableStatus = async (id: string, status: SeatingTable['status']) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/tables/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || 'Failed to update table status.');
      }
    } catch (err) {
      console.error('Error updating table status:', err);
    }
  };

  const updateTableCapacity = async (id: string, capacity: number) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/tables/${id}/capacity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ capacity })
      });
      if (response.ok) {
        // Optimistically update tables in parent state
        onUpdateTables(tables.map(t => t.id === id ? { ...t, capacity } : t));
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to update table capacity.');
      }
    } catch (err) {
      console.error('Error updating table capacity:', err);
    }
  };

  // Handlers for Categories
  const handleSaveCategoryColor = async (id: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ color: editingCategoryColor })
      });
      if (response.ok) {
        setEditingCategoryId(null);
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to save category color.');
      }
    } catch (err) {
      console.error('Error saving category color:', err);
    }
  };

  // Wizard Step 1 → 2: validate shop details and compute table count
  const handleWizardStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setShopError('');
    if (!newShopName.trim()) { setShopError('Shop name is required.'); return; }
    const count = parseInt(shopTableCount);
    if (isNaN(count) || count < 1 || count > 50) { setShopError('Enter a valid number of tables (1–50).'); return; }
    setShopTableCapacities(Array(count).fill(2));
    setShopWizardStep(2);
  };

  // Wizard Step 2 → 3: submit to API
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopError('');
    setShopSuccess('');
    if (shopTableCapacities.some(c => c < 1)) {
      setShopError('All tables must have at least 1 seat.');
      return;
    }
    try {
      const response = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: newShopName, address: newShopAddress, phone: newShopPhone,
          table_capacities: shopTableCapacities
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create shop.');

      // Fetch the newly created shop's tables to get QR tokens
      const tablesRes = await fetch(`/api/tables?shopId=${data.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const tablesData = await tablesRes.json();
      setShopTableQrData(Array.isArray(tablesData) ? tablesData : []);

      setShopSuccess(`Shop "${data.name}" created with ${shopTableCapacities.length} tables!`);
      setShopWizardStep(3);
      await fetchUsersAndShops();
    } catch (err: any) {
      setShopError(err.message || 'Error occurred.');
    }
  };

  // Reset wizard
  const resetShopWizard = () => {
    setShopWizardStep(1);
    setNewShopName(''); setNewShopAddress(''); setNewShopPhone('');
    setShopTableCount(''); setShopTableCapacities([]);
    setShopError(''); setShopSuccess(''); setShopTableQrData([]);
  };

  // Download QR code as PNG
  const downloadQR = (tableId: string, tableNum: number) => {
    const svg = document.getElementById(`qr-svg-${tableId}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 340;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 340);
      ctx.drawImage(img, 25, 20, 250, 250);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Table #${tableNum}`, 150, 300);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Scan to order', 150, 325);
      const link = document.createElement('a');
      link.download = `table-${tableNum}-qr.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // User Accounts Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    if (!newUserName || !newUserEmail || !newUserPassword) {
      setUserError('All fields are required.');
      return;
    }

    // Role-enforcement: SuperAdmin creates Admin; Admin creates Employee/Chef
    const roleToSend = user.role === 'SuperAdmin' ? 'Admin' : newUserRole;
    const shopIdToSend = user.role === 'SuperAdmin' ? parseInt(newUserShopId) : user.shop_id;

    if (user.role === 'SuperAdmin' && !shopIdToSend) {
      setUserError('Please select a shop to assign this Admin.');
      return;
    }

    const payload = {
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: roleToSend,
      shop_id: shopIdToSend
    };

    const endpoint = roleToSend === 'Admin' 
      ? '/api/auth/create-admin'
      : '/api/auth/create-employee';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account.');
      }

      setUserSuccess(`Account for ${data.name} (${data.role}) registered in database successfully!`);
      
      // Clear form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      
      // Update employee list
      const headers = { 'Authorization': `Bearer ${token}` };
      const empRes = await fetch('/api/auth/employees', { headers });
      const empData = await empRes.json();
      if (Array.isArray(empData)) setEmployees(empData);
    } catch (err: any) {
      setUserError(err.message || 'Error occurred.');
    }
  };

  const handleToggleArchiveUser = async (empId: number) => {
    try {
      const response = await fetch(`/api/auth/employees/${empId}/archive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setEmployees(prev => prev.map(emp => 
          emp.id === empId ? { ...emp, is_active: !emp.is_active } : emp
        ));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to archive user.');
      }
    } catch (err) {
      console.error('Error toggling archive:', err);
    }
  };

  const handleDeleteUser = async (empId: number) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this user account? This will permanently remove them from the database.');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/auth/employees/${empId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setEmployees(prev => prev.filter(emp => emp.id !== empId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUserId || !newResetPassword) return;

    try {
      const response = await fetch(`/api/auth/employees/${passwordResetUserId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: newResetPassword })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Password updated successfully!');
        setPasswordResetUserId(null);
        setNewResetPassword('');
      } else {
        alert(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
    }
  };

  // Compile active tab controllers
  const tabItems = [
    { id: 'products', label: 'Product Catalog', icon: Coffee },
    { id: 'categories', label: 'Category Mappings', icon: Utensils },
    { id: 'tables', label: 'Table Arrangements', icon: Calendar },
    { id: 'promos', label: 'Promos & Codes', icon: Percent },
    { id: 'users', label: 'User & Employees', icon: Users },
    { id: 'reports', label: 'Reports & Analytics', icon: TrendingUp },
  ];

  if (user?.role === 'SuperAdmin') {
    tabItems.push({ id: 'shops', label: 'Shops & Branches', icon: Shield });
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto bg-[#f8fafc] p-6 space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-[#e2e8f0]">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {user?.role === 'SuperAdmin' ? 'Super Admin Platform Portal' : 'Store Administrator Portal'}
          </h1>
          <p className="text-xs text-slate-400">Configure catalog options, seating tables, active promotional rates, and monitor financials.</p>
        </div>
        <button
          onClick={() => setActiveView('products')}
          className="text-xs px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
        >
          Return to POS Terminal
        </button>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Orders</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{stats.totalOrders}</p>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-green-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">₹{stats.revenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-purple-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Order Value</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">₹{stats.aov.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* TABS CONTROLLERS */}
      <div className="flex border-b border-[#e2e8f0]">
        {tabItems.map(tab => {
          const IconC = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs tracking-wide transition-all cursor-pointer ${
                isSel
                  ? 'border-purple-600 text-purple-700'
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
            <form onSubmit={handleAddProduct} className="p-5 bg-slate-50/50 grid grid-cols-1 md:grid-cols-5 gap-3.5 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samosa Chaat"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 599"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Category</label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
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
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full text-xs py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </form>

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
                        ₹{product.price.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleAvailability(product.id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
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
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex cursor-pointer"
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
                                className="p-1 bg-green-50 border border-green-200 text-green-600 rounded-lg hover:bg-green-100 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingCategoryId(null)}
                                className="p-1 bg-red-50 border border-red-200 text-red-500 rounded-lg hover:bg-red-100 cursor-pointer"
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
                              className="text-xs font-semibold text-purple-700 hover:underline flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              Change Color
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                    <span className="w-6 h-6 rounded-full bg-[#0369a1]" title="Sky Corporate"/>
                    <span className="w-6 h-6 rounded-full bg-[#15803d]" title="Forest Base"/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABLES ARRANGEMENT SHEET */}
        {activeTab === 'tables' && (
          <div className="p-5 space-y-4">
            {/* QR Modal */}
            {qrModalTable && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setQrModalTable(null)}>
                <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Table #{qrModalTable.number}</p>
                    <p className="text-lg font-extrabold text-slate-800">{qrModalTable.floor_name || 'Main Floor'}</p>
                    <p className="text-xs text-slate-400">Scan to place your order</p>
                  </div>
                  <div className="p-3 bg-white border-4 border-purple-600 rounded-2xl shadow-sm">
                    <QRCodeSVG
                      id={`qr-svg-modal-${qrModalTable.id}`}
                      value={`/?customer=true&tableId=${qrModalTable.id}&token=${(qrModalTable as any).qr_token || qrModalTable.id}`}
                      size={200}
                      bgColor="#ffffff"
                      fgColor="#1e293b"
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => downloadQR(`modal-${qrModalTable.id}`, qrModalTable.number)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PNG
                    </button>
                    <button
                      onClick={() => setQrModalTable(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {tables.map(table => {
                const statusColors: Record<string, string> = {
                  'Occupied': 'border-red-200 bg-red-50 text-red-700',
                  'Reserved': 'border-amber-200 bg-amber-50 text-amber-700',
                  'Maintenance': 'border-slate-300 bg-slate-100 text-slate-500',
                  'Available': 'border-green-200 bg-green-50 text-green-700'
                };
                const qrValue = `/?customer=true&tableId=${table.id}&token=${(table as any).qr_token || table.id}`;
                return (
                  <div
                    key={table.id}
                    className="border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 bg-white hover:shadow-md transition-all"
                  >
                    {/* Table header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-extrabold text-slate-800">T-{table.number}</span>
                        <p className="text-[9px] text-slate-400">{table.capacity} seats</p>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${statusColors[table.status] || statusColors['Available']}`}>
                        {table.status}
                      </span>
                    </div>

                    {/* Mini QR preview — clickable to open modal */}
                    <button
                      onClick={() => setQrModalTable(table)}
                      className="w-full flex flex-col items-center gap-1 py-2 bg-slate-50 rounded-xl border border-slate-100 hover:bg-purple-50 hover:border-purple-200 transition-all cursor-pointer group"
                    >
                      <QRCodeSVG
                        id={`qr-svg-${table.id}`}
                        value={qrValue}
                        size={72}
                        bgColor="#f8fafc"
                        fgColor="#1e293b"
                        level="M"
                        includeMargin={false}
                      />
                      <span className="text-[8px] font-bold text-slate-400 group-hover:text-purple-600 flex items-center gap-0.5">
                        <QrCode className="w-2.5 h-2.5" /> View QR
                      </span>
                    </button>

                    {/* Controls */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
                      <div>
                        <label className="block text-[7px] text-slate-400 font-bold uppercase mb-0.5">Seats</label>
                        <input
                          type="number"
                          min="1"
                          value={table.capacity}
                          onChange={(e) => updateTableCapacity(table.id, parseInt(e.target.value) || 1)}
                          className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg p-1 focus:outline-none focus:ring-1 focus:ring-purple-400 font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[7px] text-slate-400 font-bold uppercase mb-0.5">Status</label>
                        <select
                          value={table.status}
                          onChange={(e) => updateTableStatus(table.id, e.target.value as SeatingTable['status'])}
                          className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg p-1 focus:outline-none focus:ring-1 focus:ring-purple-400 font-semibold text-slate-700"
                        >
                          <option value="Available">Available</option>
                          <option value="Occupied">Occupied</option>
                          <option value="Reserved">Reserved</option>
                          <option value="Maintenance">Maintenance</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-1 mt-1">
                      {table.status !== 'Available' && (
                        <button
                          onClick={() => updateTableStatus(table.id, 'Available')}
                          className="flex-1 text-[9px] font-bold text-red-600 hover:bg-red-50 py-1 rounded-lg border border-red-100 transition-all flex items-center justify-center cursor-pointer"
                        >
                          End Session
                        </button>
                      )}
                      <button
                        onClick={() => downloadQR(table.id, table.number)}
                        className="flex-1 text-[9px] font-bold text-slate-500 hover:text-purple-600 hover:bg-purple-50 py-1 rounded-lg border border-transparent hover:border-purple-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download className="w-2.5 h-2.5" /> QR
                      </button>
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
            <form onSubmit={handleAddPromo} className="p-5 bg-slate-50/50 grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Promo Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAFE50"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Discount Type</label>
                <select
                  value={newPromoType}
                  onChange={(e) => setNewPromoType(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
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
                  className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                />
              </div>
              <button
                type="submit"
                className="w-full text-xs py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Promo Code
              </button>
            </form>

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
                        {promo.discountType === 'percentage' ? `${promo.value}%` : `₹${promo.value.toFixed(2)}`}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => togglePromo(promo.code)}
                          className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
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
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex cursor-pointer"
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

        {/* USER AND EMPLOYEE ACCOUNTS SHEET */}
        {activeTab === 'users' && (
          <div className="divide-y divide-[#e2e8f0]">
            
            {/* Create Account Form */}
            <div className="p-6 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-purple-600" />
                {user?.role === 'SuperAdmin' ? 'Register New Shop Admin Account' : 'Register New Cashier / Chef'}
              </h3>

              {userError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-semibold">
                  {userError}
                </div>
              )}
              {userSuccess && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-xs font-semibold">
                  {userSuccess}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@odoocafe.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="e.g. secure123"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                  />
                </div>

                {user?.role === 'SuperAdmin' ? (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Account Role</label>
                      <select
                        disabled
                        value="Admin"
                        className="w-full text-xs px-3 py-2 bg-slate-100 border border-[#e2e8f0] rounded-xl text-slate-500"
                      >
                        <option value="Admin">Shop Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Assign Shop</label>
                      <select
                        value={newUserShopId}
                        onChange={(e) => setNewUserShopId(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                      >
                        <option value="">-- Select Branch Shop --</option>
                        {shops.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Account Role</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-800"
                      >
                        <option value="Employee">Cashier (Employee)</option>
                        <option value="Chef">Kitchen Chef</option>
                      </select>
                    </div>
                    <div className="text-slate-500 text-xs py-2 px-1 font-semibold leading-normal">
                      Shop: <span className="text-slate-800 font-bold">{user?.shop_name || 'My Cafe Shop'}</span>
                    </div>
                  </>
                )}

                <div className="md:col-span-5 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Register Account
                  </button>
                </div>
              </form>
            </div>

            {/* Password Reset Modal Box */}
            {passwordResetUserId && (
              <div className="p-6 bg-purple-50/50 border-b border-purple-100 flex items-center justify-between gap-4">
                <form onSubmit={handleResetPassword} className="flex items-end gap-3 flex-1 max-w-lg">
                  <div className="flex-1">
                    <label className="block text-[9px] uppercase tracking-wider font-bold text-purple-600 mb-1">Reset Password for User #{passwordResetUserId}</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter new password"
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-800"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors cursor-pointer"
                  >
                    Save Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPasswordResetUserId(null); setNewResetPassword(''); }}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Accounts Directory */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Assigned Location</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => {
                    const isSuperUser = emp.role === 'SuperAdmin';
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                          {isSuperUser ? (
                            <Shield className="w-3.5 h-3.5 text-amber-500" />
                          ) : emp.role === 'Admin' ? (
                            <Shield className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          {emp.name}
                        </td>
                        <td className="p-4 text-slate-600">{emp.email}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${
                            emp.role === 'SuperAdmin' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            emp.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            emp.role === 'Chef' ? 'bg-green-50 text-green-700 border-green-200' :
                            'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>
                            {emp.role}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-slate-700">
                          {isSuperUser ? 'Global System' : emp.shop_name || `Shop #${emp.shop_id}`}
                        </td>
                        <td className="p-4">
                          <button
                            disabled={isSuperUser}
                            onClick={() => handleToggleArchiveUser(emp.id)}
                            className={`flex items-center gap-1.5 text-xs font-semibold ${
                              isSuperUser ? 'opacity-50 cursor-not-allowed text-slate-400' :
                              emp.is_active ? 'text-green-600 cursor-pointer' : 'text-slate-400 cursor-pointer'
                            }`}
                          >
                            {emp.is_active ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-green-500" /> Active
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-slate-300" /> Archived
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-4 text-right space-x-1.5">
                          <button
                            onClick={() => setPasswordResetUserId(emp.id)}
                            title="Reset Password"
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-flex cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {user?.role === 'SuperAdmin' && !isSuperUser && (
                            <button
                              onClick={() => handleDeleteUser(emp.id)}
                              title="Delete Account"
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* SHOPS MANAGEMENT SHEET (SuperAdmin Only) */}
        {activeTab === 'shops' && user?.role === 'SuperAdmin' && (
          <div className="divide-y divide-[#e2e8f0]">

            {/* ── 3-STEP WIZARD ── */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  Register New Branch / Shop
                </h3>
                {/* Step indicator */}
                <div className="flex items-center gap-2">
                  {[1,2,3].map(s => (
                    <div key={s} className={`flex items-center gap-1.5 ${ s < shopWizardStep ? 'text-green-600' : s === shopWizardStep ? 'text-purple-700' : 'text-slate-300' }`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold border-2 ${
                        s < shopWizardStep ? 'bg-green-50 border-green-400' :
                        s === shopWizardStep ? 'bg-purple-600 border-purple-600 text-white' :
                        'border-slate-200'
                      }`}>
                        {s < shopWizardStep ? <Check className="w-3 h-3" /> : s}
                      </span>
                      {s < 3 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                    </div>
                  ))}
                </div>
              </div>

              {shopError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-semibold">
                  {shopError}
                </div>
              )}

              {/* ── STEP 1: Shop Details + Table Count ── */}
              {shopWizardStep === 1 && (
                <form onSubmit={handleWizardStep1} className="space-y-5">
                  <p className="text-xs text-slate-500 font-medium">Step 1 of 2 — Enter shop details and how many tables this shop has.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Shop / Branch Name *</label>
                      <input type="text" required placeholder="e.g. Odoo Cafe Downtown"
                        value={newShopName} onChange={e => setNewShopName(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Phone Number</label>
                      <input type="text" placeholder="e.g. +91 98765 43210"
                        value={newShopPhone} onChange={e => setNewShopPhone(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Address</label>
                      <input type="text" placeholder="e.g. 12 MG Road, Bengaluru"
                        value={newShopAddress} onChange={e => setNewShopAddress(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Number of Tables in this Shop *</label>
                      <input type="number" required min="1" max="50" placeholder="e.g. 10"
                        value={shopTableCount} onChange={e => setShopTableCount(e.target.value)}
                        className="w-full md:w-48 text-xs px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">You'll set the seat capacity for each table in the next step.</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit"
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      Next: Set Seat Capacities <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 2: Per-Table Seat Capacity ── */}
              {shopWizardStep === 2 && (
                <form onSubmit={handleCreateShop} className="space-y-5">
                  <p className="text-xs text-slate-500 font-medium">Step 2 of 2 — Set how many people can sit at each table.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {shopTableCapacities.map((cap, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
                          <span className="text-xs font-extrabold text-purple-700">{idx + 1}</span>
                        </div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Table {idx + 1}</label>
                        <input
                          type="number" min="1" max="20" required
                          value={cap}
                          onChange={e => {
                            const updated = [...shopTableCapacities];
                            updated[idx] = parseInt(e.target.value) || 1;
                            setShopTableCapacities(updated);
                          }}
                          className="w-full text-center text-sm font-bold px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-800"
                        />
                        <span className="text-[9px] text-slate-400">seats</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <button type="button" onClick={() => setShopWizardStep(1)}
                      className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="submit"
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Shop & Generate QR Codes
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 3: Success — Show QR Codes ── */}
              {shopWizardStep === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-800">{shopSuccess}</p>
                      <p className="text-xs text-green-600">QR codes generated for all tables. Download and print them.</p>
                    </div>
                  </div>

                  {shopTableQrData.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {shopTableQrData.map((t: any) => {
                        const qrVal = `/?customer=true&tableId=${t.id}&token=${t.qr_token || t.id}`;
                        return (
                          <div key={t.id} className="flex flex-col items-center gap-2 border border-slate-200 rounded-xl p-3 bg-white">
                            <p className="text-xs font-extrabold text-slate-700">Table #{t.table_number}</p>
                            <p className="text-[9px] text-slate-400">{t.seats} seats</p>
                            <div className="p-2 bg-white border border-slate-100 rounded-lg">
                              <QRCodeSVG
                                id={`qr-svg-new-${t.id}`}
                                value={qrVal}
                                size={100}
                                bgColor="#ffffff"
                                fgColor="#1e293b"
                                level="H"
                                includeMargin={false}
                              />
                            </div>
                            <button
                              onClick={() => downloadQR(`new-${t.id}`, t.table_number)}
                              className="w-full text-[9px] font-bold text-purple-600 hover:bg-purple-50 py-1 rounded-lg border border-purple-200 hover:border-purple-400 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Download className="w-2.5 h-2.5" /> Download
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button onClick={resetShopWizard}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Register Another Shop
                  </button>
                </div>
              )}
            </div>

            {/* Shops Directory */}
            <div className="overflow-x-auto">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700">Registered Branches</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Shop ID</th>
                    <th className="p-4">Shop Name</th>
                    <th className="p-4">Address</th>
                    <th className="p-4">Phone Number</th>
                    <th className="p-4">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shops.map(sh => (
                    <tr key={sh.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono font-bold text-slate-500">#{sh.id}</td>
                      <td className="p-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-purple-600" />
                          {sh.name}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{sh.address || 'N/A'}</td>
                      <td className="p-4 font-medium text-slate-700">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {sh.phone || 'N/A'}
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">
                        {new Date(sh.created_at || sh.created_date || Date.now()).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* REPORTS & ANALYTICS TAB */}
        {activeTab === 'reports' && (() => {
          // Calculations
          const totalPaidOrders = orders.filter(o => o.orderStatus === 'Paid');
          const totalRevenue = totalPaidOrders.reduce((sum, o) => sum + o.total, 0);
          const totalDiscount = totalPaidOrders.reduce((sum, o) => sum + o.discount, 0);

          // Category sales breakdown calculation
          const categorySales: Record<string, number> = {};
          totalPaidOrders.forEach(o => {
            o.items.forEach(item => {
              const cat = item.product.category || 'other';
              const itemTotal = item.product.price * item.quantity;
              categorySales[cat] = (categorySales[cat] || 0) + itemTotal;
            });
          });

          const totalCategoryRevenue = Object.values(categorySales).reduce((sum, v) => sum + v, 0);

          // SVG Pie Chart calculations
          const catEntries = Object.entries(categorySales);
          let cumulativePercent = 0;
          const donutSlices = catEntries.map(([cat, val], idx) => {
            const pct = totalCategoryRevenue > 0 ? (val / totalCategoryRevenue) : 0;
            const startPct = cumulativePercent;
            cumulativePercent += pct;
            return {
              category: cat,
              value: val,
              pct,
              startPct,
              color: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'][idx % 6]
            };
          });

          // CSV Exporter Trigger
          const exportToCSV = () => {
            const headers = ["Order ID", "Ticket Number", "Customer Name", "Total Amount (INR)", "Discount (INR)", "KDS Prep Status", "Payment Status", "Placed Date"];
            const rows = orders.map(o => [
              o.id,
              o.ticketNumber,
              o.customer,
              o.total.toFixed(2),
              o.discount.toFixed(2),
              o.status,
              o.orderStatus,
              new Date(o.createdAt).toLocaleString()
            ]);
            const csvContent = "data:text/csv;charset=utf-8," 
              + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `odoo_cafe_sales_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };

          return (
            <div className="p-6 space-y-6">
              {/* Controls bar */}
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Financial Reports & Logs</h3>
                  <p className="text-[11px] text-slate-400">Generate statements, export transaction registers, and inspect analytics.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>📊</span> Export Sales CSV
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>🖨️</span> Print PDF Summary
                  </button>
                </div>
              </div>

              {/* Grid of details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* SVG CATEGORY SHARE DONUT */}
                <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Revenue Share by Category</h4>
                    <p className="text-[10px] text-slate-400">Visual share of sales totals across categories</p>
                  </div>
                  
                  {totalCategoryRevenue === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                      <span>No paid category sales logged yet.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-4">
                      {/* SVG Pie Chart */}
                      <svg width="180" height="180" viewBox="0 0 36 36" className="transform -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="3" />
                        {donutSlices.map((slice, idx) => {
                          const strokeDashArray = `${slice.pct * 100} ${100 - slice.pct * 100}`;
                          const strokeDashOffset = 100 - slice.startPct * 100;
                          return (
                            <circle
                              key={idx}
                              cx="18"
                              cy="18"
                              r="15.915"
                              fill="transparent"
                              stroke={slice.color}
                              strokeWidth="3.5"
                              strokeDasharray={strokeDashArray}
                              strokeDashoffset={strokeDashOffset}
                              className="transition-all duration-300"
                            />
                          );
                        })}
                      </svg>

                      {/* Legend */}
                      <div className="space-y-2">
                        {donutSlices.map((slice, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
                            <span className="text-slate-600 capitalize font-medium">{slice.category}:</span>
                            <span className="font-bold text-slate-800">₹{slice.value.toFixed(2)} ({(slice.pct * 100).toFixed(0)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SVG MONTHLY REVENUE BAR CHART */}
                <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Transaction Breakdown</h4>
                    <p className="text-[10px] text-slate-400">Order payment status counts</p>
                  </div>

                  <div className="h-64 flex flex-col justify-end space-y-4">
                    <div className="grid grid-cols-3 gap-4 items-end flex-1 pb-2 border-b border-slate-100">
                      {[
                        { label: 'Paid', val: orders.filter(o => o.orderStatus === 'Paid').length, color: 'bg-emerald-500' },
                        { label: 'Draft', val: orders.filter(o => o.orderStatus === 'Draft').length, color: 'bg-indigo-500' },
                        { label: 'Cancelled', val: orders.filter(o => o.orderStatus === 'Cancelled').length, color: 'bg-rose-500' },
                      ].map((item, idx) => {
                        const maxCount = Math.max(...[orders.filter(o => o.orderStatus === 'Paid').length, orders.filter(o => o.orderStatus === 'Draft').length, orders.filter(o => o.orderStatus === 'Cancelled').length, 1]);
                        const heightPct = (item.val / maxCount) * 80;
                        return (
                          <div key={idx} className="flex flex-col items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-700">{item.val}</span>
                            <div 
                              className={`w-full rounded-t-lg transition-all duration-500 ${item.color}`}
                              style={{ height: `${Math.max(5, heightPct)}%` }}
                            />
                            <span className="text-[10px] font-semibold text-slate-400">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Transaction Register Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Recent Transactions Register</span>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold border border-purple-200">
                    {orders.length} Total Logs
                  </span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-3">Ticket</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">KDS Status</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3 text-right">Total (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 10).map((o, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-600">{o.ticketNumber}</td>
                          <td className="p-3 font-medium text-slate-800">{o.customer}</td>
                          <td className="p-3 text-slate-400">{new Date(o.createdAt).toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              o.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                              o.status === 'Preparing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              o.orderStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              o.orderStatus === 'Cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {o.orderStatus}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-850 text-right">₹{o.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          );
        })()}

      </div>
    </div>
  );
};
