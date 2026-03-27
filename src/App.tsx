import React, { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, LayoutDashboard, Package, CheckCircle, CheckCircle2, Truck, CreditCard, User, MapPin, Phone, Upload, Loader2, ChevronRight, ArrowLeft, LogOut, BarChart3, TrendingUp, Calendar, DollarSign, PieChart as PieChartIcon, Instagram, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfWeek, endOfWeek, subMonths } from 'date-fns';
import { cn } from './lib/utils';

// --- API Service ---
// Hardcoded URL for reliability
const API_URL = 'https://script.google.com/macros/s/AKfycbzxY0bLhbFRHMOOVx2uQlh29T_aUQJQC00ZxJ-AlWV6uJAG-ATsXc87EAAITbugP0zMLA/exec';

const api = {
  async post(data: any) {
    if (!API_URL) throw new Error('API_URL_MISSING');
    
    if (!API_URL.includes('script.google.com')) {
      throw new Error('INVALID_URL_FORMAT');
    }
    
    if (API_URL.endsWith('/dev')) {
      throw new Error('DEV_URL_USED');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('GAS returned non-JSON:', text);
        if (text === 'Social Seller API is running.') {
          throw new Error('REDEPLOY_REQUIRED');
        }
        if (text.includes('<!DOCTYPE')) throw new Error('GAS_SCRIPT_ERROR');
        throw new Error('INVALID_JSON_RESPONSE');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('TIMEOUT');
      if (err.message === 'Failed to fetch') {
        console.error('Network error or CORS issue. Ensure GAS is deployed as "Anyone".');
      }
      throw err;
    }
  },
  async get(action: string, params: Record<string, string> = {}) {
    if (!API_URL) throw new Error('API_URL_MISSING');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const queryParams = new URLSearchParams({ action, ...params }).toString();
      const response = await fetch(`${API_URL}?${queryParams}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('GAS GET returned non-JSON:', text);
        if (text === 'Social Seller API is running.') {
          throw new Error('REDEPLOY_REQUIRED');
        }
        if (text.includes('<!DOCTYPE')) throw new Error('GAS_SCRIPT_ERROR');
        return null;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('TIMEOUT');
      console.error('API Get Error:', err);
      throw err;
    }
  }
};

// --- Components ---

function OrderForm() {
  const { sellerId } = useParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [storeName, setStoreName] = useState<string>('');
  const [redeployRequired, setRedeployRequired] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    item: '',
    quantity: 1,
    size: '',
    phone: '',
    instagramId: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    paymentMethod: 'WhatsApp Pay',
    image: null as string | null,
  });

  useEffect(() => {
    if (!sellerId) return;
    
    const fetchStoreInfo = async () => {
      try {
        const res = await api.get('getStoreInfo', { sellerId });
        if (res && res.success) {
          setStoreName(res.storeName);
        }
      } catch (err: any) {
        if (err.message === 'REDEPLOY_REQUIRED') {
          setRedeployRequired(true);
        }
        console.error('Failed to fetch store info:', err);
      }
    };
    fetchStoreInfo();
  }, [sellerId]);

  useEffect(() => {
    if (success) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            window.location.href = 'about:blank';
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [success]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await api.post({
        action: 'createOrder',
        sellerId,
        timestamp: new Date().toISOString(),
        ...formData
      });
      if (res.success) {
        setSuccess(true);
      } else {
        alert('Order failed: ' + (res.message || 'The Google Script returned an error. Check your sheet headers.'));
      }
    } catch (err: any) {
      if (err.message === 'REDEPLOY_REQUIRED') {
        setRedeployRequired(true);
      }
      const urlPreview = API_URL ? `${API_URL.substring(0, 15)}...` : 'EMPTY';
      if (err.message === 'API_URL_MISSING') {
        alert(`Configuration Error: The URL is empty. Please set VITE_GAS_URL in settings.\n(Current: ${urlPreview})`);
      } else if (err.message === 'DEV_URL_USED') {
        alert(`Deployment Error: You are using a /dev URL. Please use the /exec URL.\n(Current: ${urlPreview})`);
      } else if (err.message === 'INVALID_URL_FORMAT') {
        alert(`URL Error: The link does not look like a Google Script link.\n(Current: ${urlPreview})\n\nIt should start with https://script.google.com/`);
      } else {
        alert(`Network Error: The browser blocked the connection.\n(Current: ${urlPreview})\n\nCheck your script deployment (Anyone can access).`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-[40px] shadow-2xl shadow-zinc-200 border border-zinc-100"
        >
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">{storeName || 'Order Placed!'}</h2>
          <p className="text-zinc-500 mb-8 leading-relaxed">
            The seller will contact you shortly through Instagram or WhatsApp to confirm your order.
          </p>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.href = 'about:blank'}
              className="w-full py-4 bg-zinc-900 text-white rounded-full font-bold hover:bg-zinc-800 transition-all"
            >
              Exit Now
            </button>
            <p className="text-[10px] text-zinc-300 uppercase tracking-widest font-bold">
              Redirecting in {countdown}s...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white overflow-hidden">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 bg-zinc-100 z-50">
        <motion.div 
          className="h-full bg-zinc-900"
          initial={{ width: '0%' }}
          animate={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8 h-screen flex flex-col">
        {redeployRequired && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900 leading-none">Action Required: Re-deploy Script</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                The Google Apps Script needs to be re-deployed to support the new data fetching method. Please follow the instructions in GOOGLE_APPS_SCRIPT.md.
              </p>
            </div>
          </div>
        )}
        <header className="mb-8 space-y-2 shrink-0">
          <div className="flex items-center gap-2 text-zinc-400 mb-1">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">
              {storeName || 'Order Request'}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-zinc-900">
            {step === 1 && "What are you buying?"}
            {step === 2 && "Where should it go?"}
            {step === 3 && "Confirm & Pay"}
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Item Details</label>
                    <input 
                      type="text" 
                      placeholder="Item Name (e.g. Vintage Denim Jacket)"
                      className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors placeholder:text-zinc-200"
                      value={formData.item}
                      onChange={e => setFormData(prev => ({ ...prev, item: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Quantity</label>
                      <input 
                        type="number" 
                        placeholder="Qty"
                        className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors placeholder:text-zinc-200"
                        value={formData.quantity}
                        onChange={e => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-end">
                        <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Size</label>
                        <span className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest">Optional</span>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Size"
                        className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors placeholder:text-zinc-200"
                        value={formData.size}
                        onChange={e => setFormData(prev => ({ ...prev, size: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Reference Image</label>
                    <span className="text-[9px] text-zinc-300 font-bold uppercase tracking-widest">Optional</span>
                  </div>
                  <div 
                    className="relative h-32 border-2 border-dashed border-zinc-200 rounded-[20px] flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 transition-all overflow-hidden group bg-white shadow-sm"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    {formData.image ? (
                      <img src={formData.image} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <>
                        <div className="w-8 h-8 bg-zinc-50 rounded-full flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                          <Upload className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                        </div>
                        <p className="text-zinc-400 text-[10px] font-medium">Upload a screenshot</p>
                      </>
                    )}
                    <input id="file-upload" type="file" className="hidden" onChange={handleImageUpload} />
                  </div>
                </div>

                <button 
                  disabled={!formData.item}
                  onClick={() => setStep(2)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-full font-bold text-base hover:bg-zinc-800 transition-all duration-300 disabled:opacity-20 flex items-center justify-center gap-2 shadow-lg shadow-zinc-200"
                >
                  Next Step <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors"
                      value={formData.customerName}
                      onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">WhatsApp Number</label>
                    <input 
                      type="tel" 
                      className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors"
                      value={formData.phone}
                      onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Instagram ID (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="@username"
                      className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors placeholder:text-zinc-200"
                      value={formData.instagramId}
                      onChange={e => setFormData(prev => ({ ...prev, instagramId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Address</label>
                    <textarea 
                      rows={3}
                      className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors resize-none"
                      value={formData.address}
                      onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">City</label>
                      <input 
                        type="text" 
                        className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors"
                        value={formData.city}
                        onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Pincode</label>
                      <input 
                        type="text" 
                        className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors"
                        value={formData.pincode}
                        onChange={e => setFormData(prev => ({ ...prev, pincode: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">State</label>
                    <input 
                      type="text" 
                      className="w-full bg-transparent border-b-2 border-zinc-200 py-2 text-xl focus:border-zinc-900 outline-none transition-colors"
                      value={formData.state}
                      onChange={e => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 border-2 border-zinc-100 bg-white rounded-full font-bold text-base hover:bg-zinc-50 transition-all duration-300"
                  >
                    Back
                  </button>
                  <button 
                    disabled={!formData.customerName || !formData.phone || !formData.address || !formData.city || !formData.state || !formData.pincode}
                    onClick={() => setStep(3)}
                    className="flex-[2] py-4 bg-zinc-900 text-white rounded-full font-bold text-base hover:bg-zinc-800 transition-all duration-300 disabled:opacity-20 shadow-lg shadow-zinc-200"
                  >
                    Almost Done
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-[32px] p-6 space-y-6 border border-zinc-100 shadow-xl shadow-zinc-200/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-zinc-400 text-[9px] uppercase tracking-widest font-bold mb-1">Item Summary</h3>
                      <p className="text-xl font-bold text-zinc-900">{formData.item}</p>
                      <p className="text-zinc-500 text-xs font-medium mt-0.5">Size: {formData.size || 'N/A'} • Qty: {formData.quantity}</p>
                    </div>
                    {formData.image && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-zinc-100 shadow-sm">
                        <img src={formData.image} className="w-full h-full object-cover" alt="Item" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-zinc-50">
                    <div>
                      <h3 className="text-zinc-400 text-[9px] uppercase tracking-widest font-bold mb-1">Deliver To</h3>
                      <p className="text-xs font-bold text-zinc-900">{formData.customerName}</p>
                      <p className="text-zinc-500 text-[10px] mt-0.5 leading-relaxed whitespace-pre-wrap">
                        {formData.address}, {formData.city}<br />
                        {formData.state} - {formData.pincode}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-zinc-400 text-[9px] uppercase tracking-widest font-bold mb-1">Payment</h3>
                      <select 
                        className="bg-zinc-50 px-3 py-1.5 rounded-lg text-[10px] font-bold outline-none cursor-pointer border border-zinc-100"
                        value={formData.paymentMethod}
                        onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      >
                        <option>WhatsApp Pay</option>
                        <option>Bank Transfer</option>
                        <option>Cash on Delivery</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep(2)}
                    className="flex-1 py-4 border-2 border-zinc-100 bg-white rounded-full font-bold text-base hover:bg-zinc-50 transition-all duration-300"
                  >
                    Back
                  </button>
                  <button 
                    disabled={loading}
                    onClick={handleSubmit}
                    className="flex-[2] py-4 bg-zinc-900 text-white rounded-full font-bold text-base hover:bg-zinc-800 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-zinc-200"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Order"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function BusinessStats({ orders }: { orders: any[] }) {
  const stats = React.useMemo(() => {
    const now = new Date();
    const lastWeek = subDays(now, 7);
    const lastMonth = subMonths(now, 1);

    const totalSales = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    
    const lastWeekSales = orders
      .filter(o => o.createdAt && parseISO(o.createdAt) >= lastWeek)
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      
    const lastMonthSales = orders
      .filter(o => o.createdAt && parseISO(o.createdAt) >= lastMonth)
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

    // Daily sales for the last 30 days
    const dailyData: any[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i);
      const dateStr = format(date, 'MMM dd');
      const daySales = orders
        .filter(o => o.createdAt && format(parseISO(o.createdAt), 'MMM dd') === dateStr)
        .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      dailyData.push({ name: dateStr, sales: daySales });
    }

    // Sales by Item
    const itemSales: { [key: string]: number } = {};
    orders.forEach(o => {
      const item = o.item || 'Unknown';
      itemSales[item] = (itemSales[item] || 0) + (Number(o.amount) || 0);
    });
    const itemData = Object.entries(itemSales)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Order Status Distribution
    const statusCounts: { [key: string]: number } = {};
    orders.forEach(o => {
      const status = o.orderStatus || 'Pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    return { totalSales, lastWeekSales, lastMonthSales, dailyData, statusData };
  }, [orders]);

  const COLORS = ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8'];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center">
              <DollarSign className="text-white w-6 h-6" />
            </div>
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Total Sales</p>
              <h3 className="text-3xl font-bold">₹{stats.totalSales.toLocaleString()}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>Lifetime Revenue</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
              <Calendar className="text-zinc-900 w-6 h-6" />
            </div>
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Last 30 Days</p>
              <h3 className="text-3xl font-bold">₹{stats.lastMonthSales.toLocaleString()}</h3>
            </div>
          </div>
          <p className="text-zinc-500 text-xs">Monthly performance overview</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
              <TrendingUp className="text-zinc-900 w-6 h-6" />
            </div>
            <div>
              <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Last 7 Days</p>
              <h3 className="text-3xl font-bold">₹{stats.lastWeekSales.toLocaleString()}</h3>
            </div>
          </div>
          <p className="text-zinc-500 text-xs">Weekly sales momentum</p>
        </motion.div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm h-[400px] flex flex-col"
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold">Sales Trend</h3>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Last 30 Days</span>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  interval={6}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#a1a1aa' }}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  formatter={(value) => [`₹${value}`, 'Sales']}
                />
                <Area type="monotone" dataKey="sales" stroke="#18181b" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm h-[350px] flex flex-col lg:col-span-1"
        >
          <h3 className="text-lg font-bold mb-8">Order Status</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {stats.statusData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{entry.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm h-[350px] flex flex-col lg:col-span-2"
        >
          <h3 className="text-lg font-bold mb-6">Recent Activity</h3>
          <div className="space-y-4 overflow-y-auto pr-2">
            {orders.slice(0, 5).map((order) => (
              <div key={order.orderId} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-100">
                    <ShoppingBag className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{order.customerName}</p>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{order.item}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">₹{Number(order.amount || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{order.orderStatus}</p>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <Package className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm">No activity recorded</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function AmountInput({ order, onUpdate }: { order: any, onUpdate: (id: string, val: string) => void }) {
  const [value, setValue] = useState(String(order.amount || ''));
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(!!order.amount && Number(order.amount) > 0);

  useEffect(() => {
    const amt = String(order.amount || '');
    setValue(amt);
    setIsConfirmed(!!amt && Number(amt) > 0);
  }, [order.amount]);

  const handleConfirm = async () => {
    if (!value || Number(value) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setIsSaving(true);
    try {
      await onUpdate(order.orderId, value);
      setIsConfirmed(true);
    } catch (err) {
      console.error('Save amount error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isConfirmed) {
    return (
      <div className="pt-2">
        <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Order Amount</p>
        <div className="flex items-center gap-2 text-emerald-600 font-bold">
          <span>₹{value}</span>
          <CheckCircle2 className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Order Amount</p>
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 font-bold">₹</span>
        <input 
          type="number"
          placeholder="0.00"
          className="bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-1.5 text-sm font-bold w-24 outline-none focus:ring-2 ring-zinc-900/5 transition-all"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isSaving}
        />
        <button
          onClick={handleConfirm}
          disabled={isSaving || !value}
          className="bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const { sellerId } = useParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem(`isLoggedIn_${sellerId}`) === 'true');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState(() => localStorage.getItem(`storeName_${sellerId}`) || '');
  const [redeployRequired, setRedeployRequired] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'stats'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoggedIn && sellerId) {
      fetchOrders();
    }
  }, [isLoggedIn, sellerId]);

  const fetchOrders = async () => {
    if (!sellerId) return;
    setLoading(true);
    console.log('Fetching orders for:', sellerId);
    try {
      const data = await api.get('getOrders', { sellerId });
      console.log('Orders data received:', data);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err.message === 'REDEPLOY_REQUIRED') {
        setRedeployRequired(true);
      }
      console.error('Fetch Orders Error:', err);
      setOrders([]);
      setError('Failed to fetch orders. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post({ 
        action: 'sellerLogin', 
        sellerId: sellerId?.trim(), 
        password: password.trim() 
      });
      if (res.success) {
        if (res.status === 'expired') {
          setError('Subscription expired. Renew subscription to view new orders.');
        } else {
          setIsLoggedIn(true);
          setStoreName(res.storeName);
          localStorage.setItem(`isLoggedIn_${sellerId}`, 'true');
          localStorage.setItem(`storeName_${sellerId}`, res.storeName);
          // fetchOrders is called by useEffect
        }
      } else {
        setError('Invalid password');
      }
    } catch (err: any) {
      if (err.message === 'REDEPLOY_REQUIRED') {
        setRedeployRequired(true);
      }
      const urlPreview = API_URL ? `${API_URL.substring(0, 15)}...` : 'EMPTY';
      if (err.message === 'API_URL_MISSING') {
        setError('Configuration Error: The URL is empty.');
      } else if (err.message === 'TIMEOUT') {
        setError('Request Timed Out: Google Sheets is taking too long to respond.');
      } else if (err.message === 'GAS_SCRIPT_ERROR') {
        setError('Script Error: Your Google Apps Script crashed. Check the "Executions" tab in the script editor for errors.');
      } else if (err.message === 'INVALID_JSON_RESPONSE') {
        setError('Data Error: The script returned an invalid response. Check your sheet names.');
      } else {
        setError('Network Error: Could not connect to Google Sheets. Check your deployment.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (orderId: string, type: string, value: string) => {
    try {
      const res = await api.post({ action: 'updateStatus', orderId, type, status: value });
      if (res.success) {
        setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, [type]: value } : o));
      } else {
        alert('Update failed: ' + (res.message || 'Unknown error'));
      }
    } catch (err: any) {
      if (err.message === 'REDEPLOY_REQUIRED') {
        setRedeployRequired(true);
      }
      alert('Network Error: Could not connect to Google Sheets.');
    }
  };

  const updateStatus = (orderId: string, type: 'orderStatus' | 'paymentStatus', status: string) => {
    updateField(orderId, type, status);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[32px] shadow-sm max-w-md w-full border border-zinc-100"
        >
          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6">
            <LayoutDashboard className="text-white w-6 h-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Seller Login</h1>
          <p className="text-zinc-500 text-sm mb-8">Enter your password to access the dashboard for <span className="font-bold text-zinc-900">{sellerId}</span>.</p>
          
          {redeployRequired && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed font-medium">
                Script re-deployment required. Please check GOOGLE_APPS_SCRIPT.md.
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Password"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 outline-none focus:ring-2 ring-zinc-900/5 transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && (
              <div className={cn(
                "p-4 rounded-2xl text-sm font-medium",
                error.includes('expired') ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-red-50 text-red-600 border border-red-100"
              )}>
                {error}
              </div>
            )}
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 text-white rounded-2xl py-4 font-semibold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Access Dashboard"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans">
      <nav className="bg-white border-b border-zinc-100 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <Package className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-none">{storeName}</h2>
            <p className="text-zinc-400 text-xs mt-1 uppercase tracking-widest">{sellerId}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setIsLoggedIn(false);
            localStorage.removeItem(`isLoggedIn_${sellerId}`);
            localStorage.removeItem(`storeName_${sellerId}`);
          }}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        {redeployRequired && (
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-amber-900 leading-none">Action Required: Re-deploy Script</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                The Google Apps Script needs to be re-deployed to support the new data fetching method. Please follow the instructions in GOOGLE_APPS_SCRIPT.md to update your script.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{activeTab === 'orders' ? 'Orders' : 'Statistics'}</h1>
            <p className="text-zinc-500 mt-1">
              {activeTab === 'orders' ? 'Manage your social sales and fulfillment.' : 'Analyze your business performance and growth.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div className="flex bg-white p-1 rounded-2xl border border-zinc-100 shadow-sm">
              <button 
                onClick={() => setActiveTab('orders')}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'orders' ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-900"
                )}
              >
                <Package className="w-4 h-4" /> Orders
              </button>
              <button 
                onClick={() => setActiveTab('stats')}
                className={cn(
                  "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'stats' ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-zinc-900"
                )}
              >
                <BarChart3 className="w-4 h-4" /> Statistics
              </button>
            </div>
            {activeTab === 'orders' && (
              <>
                <div className="bg-white px-6 py-3 rounded-2xl border border-zinc-100 shadow-sm">
                  <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Total Orders</p>
                  <p className="text-2xl font-bold">{orders.length}</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-zinc-100 shadow-sm">
                  <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Pending</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {Array.isArray(orders) ? orders.filter(o => o && o.orderStatus?.toLowerCase() === 'pending').length : 0}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {activeTab === 'orders' && !loading && Array.isArray(orders) && orders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {['all', 'pending', 'confirmed', 'shipped', 'paid', 'unpaid'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
                  statusFilter === status 
                    ? "bg-zinc-900 text-white border-zinc-900" 
                    : "bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Fetching data...</p>
          </div>
        ) : activeTab === 'stats' ? (
          <BusinessStats orders={orders} />
        ) : !Array.isArray(orders) || orders.length === 0 ? (
          <div className="bg-white rounded-[32px] p-20 text-center border border-zinc-100">
            <Package className="w-16 h-16 text-zinc-200 mx-auto mb-6" />
            <h3 className="text-xl font-bold">No orders yet</h3>
            <p className="text-zinc-500 mt-2">Share your order link with customers to get started.</p>
            <p className="text-[10px] text-zinc-300 mt-4 uppercase tracking-widest">Seller ID: {sellerId}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {orders
              .filter(order => {
                if (statusFilter === 'all') return true;
                if (statusFilter === 'paid' || statusFilter === 'unpaid') {
                  return order.paymentStatus?.toLowerCase() === statusFilter;
                }
                return order.orderStatus?.toLowerCase() === statusFilter;
              })
              .map((order) => (
                <motion.div 
                  layout
                  key={order?.orderId || Math.random()}
                  className="bg-white rounded-[32px] p-8 border border-zinc-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-8"
                >
                  {/* Image & Main Info */}
                  <div className="flex gap-6 flex-1">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden border border-zinc-100 bg-zinc-50 flex-shrink-0">
                        {order.image ? (
                          <img src={order.image} className="w-full h-full object-cover" alt="Item" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-100 px-2 py-1 rounded-md mb-2 inline-block">
                              #{order.orderId}
                            </span>
                            <h3 className="text-2xl font-bold leading-tight">{order.item}</h3>
                            <p className="text-zinc-500">Size: {order.size || 'N/A'} • Qty: {order.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Placed On</p>
                            <p className="text-xs font-bold text-zinc-900">
                              {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      <div className="flex flex-wrap gap-2">
                        <div className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                          order.orderStatus?.toLowerCase() === 'pending' && "bg-orange-100 text-orange-600",
                          order.orderStatus?.toLowerCase() === 'confirmed' && "bg-blue-100 text-blue-600",
                          order.orderStatus?.toLowerCase() === 'shipped' && "bg-green-100 text-green-600",
                        )}>
                          {order.orderStatus}
                        </div>
                        <div className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                          order.paymentStatus?.toLowerCase() === 'unpaid' && "bg-zinc-100 text-zinc-500",
                          order.paymentStatus?.toLowerCase() === 'paid' && "bg-emerald-100 text-emerald-600",
                        )}>
                          {order.paymentStatus}
                        </div>
                      </div>
                      
                      <AmountInput 
                        order={order} 
                        onUpdate={(id, val) => updateField(id, 'amount', val)} 
                      />
                    </div>
                </div>

                {/* Customer Info */}
                <div className="w-full md:w-64 space-y-4 pt-8 md:pt-0 md:pl-8 md:border-l border-zinc-100">
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-zinc-400 mt-1" />
                    <div>
                      <p className="text-sm font-bold">{order.customerName}</p>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {order.phone}
                        </p>
                        {order.instagramId && (
                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Instagram className="w-3 h-3" /> {order.instagramId}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-zinc-400 mt-1" />
                    <div className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">
                      <p>{order.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-zinc-400 mt-1" />
                    <p className="text-xs text-zinc-500">{order.paymentMethod}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="w-full md:w-48 flex flex-col gap-2 pt-8 md:pt-0 md:pl-8 md:border-l border-zinc-100">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">Actions</p>
                  
                  {order.orderStatus?.toLowerCase() === 'pending' && (
                    <button 
                      onClick={() => updateStatus(order.orderId, 'orderStatus', 'Confirmed')}
                      className="w-full py-4 px-4 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Confirm Order
                    </button>
                  )}
                  
                  {order.orderStatus?.toLowerCase() === 'confirmed' && (
                    <button 
                      onClick={() => updateStatus(order.orderId, 'orderStatus', 'Shipped')}
                      className="w-full py-4 px-4 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                    >
                      <Truck className="w-4 h-4" /> Mark Shipped
                    </button>
                  )}

                  {order.paymentStatus?.toLowerCase() === 'unpaid' && (
                    <button 
                      onClick={() => updateStatus(order.orderId, 'paymentStatus', 'Paid')}
                      className="w-full py-4 px-4 border border-zinc-200 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" /> Mark Paid
                    </button>
                  )}

                  <a 
                    href={`https://wa.me/${String(order.phone || '').replace(/\D/g, '')}?text=Hi ${order.customerName || 'Customer'}, regarding your order ${order.orderId}...`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-4 border border-zinc-200 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" /> Chat on WhatsApp
                  </a>
                  {order.instagramId && (
                    <a 
                      href={`https://instagram.com/${String(order.instagramId || '').replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-4 border border-zinc-200 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Instagram className="w-4 h-4" /> Chat on Instagram
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/order/:sellerId" element={<OrderForm />} />
        <Route path="/dashboard/:sellerId" element={<Dashboard />} />
        <Route path="*" element={
          <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-4xl font-light mb-4">Social Seller Manager</h1>
            <p className="text-zinc-500 max-w-md">Please use a specific seller link to place an order or access a dashboard.</p>
            <div className="mt-8 space-y-2 text-sm text-zinc-600">
              <p>Example: <code>/order/my-store</code></p>
              <p>Example: <code>/dashboard/my-store</code></p>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}
