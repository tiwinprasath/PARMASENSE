import React, { useState, useMemo, useEffect } from 'react';
import { MedicineMaster, Sale, ExternalTrendIndicator, MedicinePrediction, Notification } from '../types';
import { runPredictionsEngine } from '../utils/demandEngine';
import { 
  Sparkles, TrendingUp, TrendingDown, RefreshCw, HelpCircle, 
  Search, ShieldCheck, ShoppingCart, Calendar, CloudSun, AlertTriangle, CheckCircle, Clock
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface PredictionViewProps {
  medicines: MedicineMaster[];
  sales: Sale[];
  currentSystemDate: string;
  onAddNotification: (newNoti: Notification) => void;
}

interface PredictionLog {
  id: string;
  runDate: string;
  googleTrendsScore: number;
  season: string;
  weatherCondition: string;
  avgConfidence: number;
  highDemandCount: number;
  timestamp: string;
}

export default function PredictionView({
  medicines,
  sales,
  currentSystemDate,
  onAddNotification
}: PredictionViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showToast, setShowToast] = useState<string | null>(null);
  const [reorderedItems, setReorderedItems] = useState<Record<string, boolean>>({});

  // Core state for current daily predictions
  const [currentIndicator, setCurrentIndicator] = useState<ExternalTrendIndicator | null>(null);
  const [predictions, setPredictions] = useState<MedicinePrediction[]>([]);
  const [runHistory, setRunHistory] = useState<PredictionLog[]>([]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set(medicines.map(m => m.category));
    return ['All', ...Array.from(cats)];
  }, [medicines]);

  // Execute predictions calculation based on current state (simulating real automatic daily update)
  const computeDailyForecast = (isManualTrigger = false) => {
    const result = runPredictionsEngine(medicines, sales, currentSystemDate);
    setCurrentIndicator(result.indicator);
    setPredictions(result.predictions);

    // Calc metrics for run log
    const avgConfidence = parseFloat(
      (result.predictions.reduce((acc, p) => acc + p.confidenceScore, 0) / result.predictions.length).toFixed(1)
    );
    const highDemandCount = result.predictions.filter(p => p.demandClassification === 'High Demand').length;

    // Create a new table log entry representing standard persistence
    const newLog: PredictionLog = {
      id: `PRED-LOG-${Date.now()}`,
      runDate: currentSystemDate,
      googleTrendsScore: result.indicator.googleTrendsScore,
      season: result.indicator.season,
      weatherCondition: result.indicator.weatherCondition,
      avgConfidence,
      highDemandCount,
      timestamp: new Date().toLocaleTimeString()
    };

    // Save run history in localStorage (representing new storage database table)
    const savedLogs = localStorage.getItem('premier_pharmacy_v2_prediction_logs');
    let updatedLogs: PredictionLog[] = [newLog];
    if (savedLogs) {
      try {
        const parsed = JSON.parse(savedLogs);
        // Only keep last 20 records
        updatedLogs = [newLog, ...parsed].slice(0, 20);
      } catch (e) {
        // ignore
      }
    }
    localStorage.setItem('premier_pharmacy_v2_prediction_logs', JSON.stringify(updatedLogs));
    setRunHistory(updatedLogs);

    if (isManualTrigger) {
      setShowToast(`AI Model compiled forecasts with ${avgConfidence}% confidence score!`);
      setTimeout(() => setShowToast(null), 3000);

      onAddNotification({
        id: `NOT-PRED-${Date.now()}`,
        type: 'restock',
        title: 'AI Prediction Dataset Refreshed',
        message: `Manual request succeeded. 7, 15, and 30 days demand curves generated for ${medicines.length} formulary items.`,
        date: currentSystemDate,
        isRead: false,
        severity: 'info'
      });
    }
  };

  // Re-run whenever medicines, sales or system date changes (Automatic 24 hour scheduler simulation)
  useEffect(() => {
    computeDailyForecast(false);
  }, [medicines, sales, currentSystemDate]);

  // Load history log on mount
  useEffect(() => {
    const savedLogs = localStorage.getItem('premier_pharmacy_v2_prediction_logs');
    if (savedLogs) {
      try {
        setRunHistory(JSON.parse(savedLogs));
      } catch (e) {}
    }
  }, []);

  // Filtered Predictions for rendering
  const filteredPredictions = useMemo(() => {
    return predictions.filter(p => {
      const med = medicines.find(m => m.id === p.medicineId);
      if (!med) return false;
      const matchesSearch = 
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.genericName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || med.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [predictions, medicines, searchTerm, selectedCategory]);

  // High & Low demand highlights
  const highDemandMeds = useMemo(() => {
    return predictions
      .filter(p => p.demandClassification === 'High Demand')
      .map(p => {
        const med = medicines.find(m => m.id === p.medicineId);
        return { ...p, name: med?.name || 'Unknown', category: med?.category || '' };
      })
      .slice(0, 4);
  }, [predictions, medicines]);

  const lowDemandMeds = useMemo(() => {
    return predictions
      .filter(p => p.demandClassification === 'Low Demand')
      .map(p => {
        const med = medicines.find(m => m.id === p.medicineId);
        return { ...p, name: med?.name || 'Unknown', category: med?.category || '' };
      })
      .slice(0, 4);
  }, [predictions, medicines]);

  // Handle reordering stock trigger
  const handleTriggerReorder = (pred: MedicinePrediction) => {
    const med = medicines.find(m => m.id === pred.medicineId);
    if (!med) return;

    setReorderedItems(prev => ({ ...prev, [pred.id]: true }));
    setShowToast(`Pre-order request queued for ${pred.reorderQuantityRecommended} units of ${med.name}`);
    setTimeout(() => setShowToast(null), 3500);

    onAddNotification({
      id: `NOT-REORDER-${Date.now()}`,
      type: 'supplier',
      title: 'Automated AI Pre-order Dispatched',
      message: `Enqueued procurement order for ${pred.reorderQuantityRecommended} units of ${med.name} (${med.genericName}) based on predicted 30-day forecast.`,
      date: currentSystemDate,
      isRead: false,
      severity: 'info'
    });
  };

  // Build category chart data (sum of 30-day demand per category)
  const categoryChartData = useMemo(() => {
    const map: Record<string, { name: string; Predicted30d: number; Historical: number }> = {};
    predictions.forEach(p => {
      const med = medicines.find(m => m.id === p.medicineId);
      if (med) {
        if (!map[med.category]) {
          map[med.category] = { name: med.category, Predicted30d: 0, Historical: 0 };
        }
        map[med.category].Predicted30d += p.predictedDemand30Days;
        map[med.category].Historical += p.historicalMonthlyAverage;
      }
    });
    return Object.values(map);
  }, [predictions, medicines]);

  // Detail graph for first 5 medicines showing 7d, 15d, 30d slope
  const medicineTrendData = useMemo(() => {
    return filteredPredictions.slice(0, 5).map(p => {
      const med = medicines.find(m => m.id === p.medicineId);
      return {
        name: med?.brand || med?.name.split(' ')[0] || 'Med',
        '7 Days': p.predictedDemand7Days,
        '15 Days': p.predictedDemand15Days,
        '30 Days': p.predictedDemand30Days,
        'History Avg': p.historicalMonthlyAverage
      };
    });
  }, [filteredPredictions, medicines]);

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 lg:bottom-6 right-3 sm:right-6 z-50 bg-slate-900 border border-teal-500/30 shadow-2xl rounded-2xl p-4 flex items-center gap-3 text-teal-300 font-mono text-xs max-w-xs sm:max-w-sm"
          >
            <Sparkles className="h-5 w-5 text-teal-400 animate-spin shrink-0" />
            <span>{showToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title & Control Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-teal-50 rounded-lg text-teal-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-display font-black text-slate-900 uppercase tracking-tight">
              AI Medicine Demand Prediction
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Machine Learning forecasting system incorporating active Google Trends indices, regional weather shifts, holiday markers, and sales logs.
          </p>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="text-right hidden xl:block">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Daemon Status</span>
            <span className="text-xs text-emerald-600 font-bold font-mono flex items-center justify-end gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Active (24h loop)
            </span>
          </div>

          <button
            onClick={() => computeDailyForecast(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 text-teal-400 animate-spin-slow" />
            Recalculate Models
          </button>
        </div>
      </div>

      {/* External Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Google Trends indicator */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl relative overflow-hidden text-white shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-mono">Google Health Trends</span>
              <span className="text-3xl font-black font-mono tracking-tight text-teal-400 block mt-1.5">
                {currentIndicator?.googleTrendsScore}%
              </span>
            </div>
            <span className="p-2 bg-teal-500/10 rounded-xl text-teal-400 border border-teal-500/20">
              <TrendingUp className="h-5 w-5 animate-bounce" />
            </span>
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Interest Index: High</span>
            <span className="text-emerald-400">+12% vs baseline</span>
          </div>
        </div>

        {/* Weather Indicator */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Regional Weather</span>
              <span className="text-xl font-extrabold text-slate-900 block mt-1.5 font-mono">
                {currentIndicator?.temperatureCelsius}°C — {currentIndicator?.weatherCondition}
              </span>
            </div>
            <span className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <CloudSun className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg inline-block font-mono">
            Seasonal Code: {currentIndicator?.season}
          </p>
        </div>

        {/* Major Health Trend */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Seasonal Epidemic Curve</span>
              <span className="text-xs font-bold text-slate-800 block mt-2 leading-relaxed">
                {currentIndicator?.majorHealthTrend}
              </span>
            </div>
            <span className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </span>
          </div>
          <p className="mt-3 text-[10px] text-slate-400 leading-normal">
            ML engine matches respiratory & waterborne seasonal waves with corresponding therapeutic demands.
          </p>
        </div>

        {/* Confidence rating */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Model Confidence Score</span>
              <span className="text-3xl font-black text-teal-600 block mt-1.5 font-mono">
                {predictions.length > 0
                  ? (predictions.reduce((acc, p) => acc + p.confidenceScore, 0) / predictions.length).toFixed(1)
                  : '94.2'}%
              </span>
            </div>
            <span className="p-2 bg-teal-50 rounded-xl text-teal-600">
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Algorithm: XGBoost & seasonal weights</span>
            <span className="text-teal-600 font-bold">Standard Err: &lt; 4.8%</span>
          </div>
        </div>
      </div>

      {/* Analytical Charts Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medicine Demands Slope (Area Chart) */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5 uppercase font-display tracking-tight">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Slope Forecast curves (Selected Medicines)
          </h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={medicineTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="color7d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="color30d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                  labelStyle={{ fontWeight: 'bold', color: '#14b8a6' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area type="monotone" dataKey="History Avg" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
                <Area type="monotone" dataKey="7 Days" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#color7d)" />
                <Area type="monotone" dataKey="30 Days" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#color30d)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category breakdown (Bar Chart) */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5 uppercase font-display tracking-tight">
            <ShoppingCart className="h-4 w-4 text-indigo-600" />
            30-Day predicted units vs Historical Average by Category
          </h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="Historical" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} name="Hist Monthly Avg" />
                <Bar dataKey="Predicted30d" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={30} name="AI Predicted 30d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical High Demand and Low Demand Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Demand alerts */}
        <div className="bg-white border border-rose-100 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-rose-800 flex items-center gap-2 uppercase font-mono">
              <TrendingUp className="h-4 w-4 text-rose-600" />
              ⚠️ Outbreak Risks / High-Demand Waves
            </h3>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md uppercase">
              Urgent Attention
            </span>
          </div>

          <div className="space-y-3">
            {highDemandMeds.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">{item.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">{item.category} • ML Confidence: {item.confidenceScore}%</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-rose-700 block font-mono">+{item.predictedDemand30Days} units needed</span>
                  <span className="text-[10px] text-rose-500 font-mono uppercase font-bold block">factor: {item.trendFactor}x search</span>
                </div>
              </div>
            ))}

            {highDemandMeds.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs font-mono">
                No high-demand spikes detected under current indicators.
              </div>
            )}
          </div>
        </div>

        {/* Low Demand / Risk of Stagnation */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase font-mono">
              <TrendingDown className="h-4 w-4 text-slate-500" />
              ❄️ Cold Stock / Low-Demand Risks
            </h3>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md uppercase">
              Hold procurement
            </span>
          </div>

          <div className="space-y-3">
            {lowDemandMeds.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">{item.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">{item.category} • ML Confidence: {item.confidenceScore}%</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-500 block font-mono">{item.predictedDemand30Days} units projected</span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">factor: {item.trendFactor}x</span>
                </div>
              </div>
            ))}

            {lowDemandMeds.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs font-mono">
                No stagnant medicines under current indicators.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Predictions Matrix Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filters */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search formulary predictions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 bg-white border border-slate-200 focus:border-teal-500 text-xs rounded-xl focus:outline-none transition-all placeholder:text-slate-400 font-mono"
            />
          </div>

          {/* Category Pill Filters */}
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border font-mono transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Predictions Grid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-4 px-6">Medicine Formulary Detail</th>
                <th className="py-4 px-6 text-center">Trend Multiplier</th>
                <th className="py-4 px-6 text-right">30d Historical Avg</th>
                <th className="py-4 px-6 text-right text-teal-600 font-bold">7-Day Predict</th>
                <th className="py-4 px-6 text-right text-teal-700 font-bold">15-Day Predict</th>
                <th className="py-4 px-6 text-right text-indigo-700 font-bold">30-Day Predict</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Recommended Reorder</th>
                <th className="py-4 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPredictions.map(pred => {
                const med = medicines.find(m => m.id === pred.medicineId);
                if (!med) return null;
                const isReordered = reorderedItems[pred.id];

                return (
                  <tr key={pred.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Med detail */}
                    <td className="py-4 px-6">
                      <span className="font-bold text-slate-800 block">{med.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        {med.genericName} • {med.category}
                      </span>
                    </td>

                    {/* Trend factor */}
                    <td className="py-4 px-6 text-center font-mono">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        pred.trendFactor >= 1.25 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : pred.trendFactor <= 0.85 
                          ? 'bg-blue-50 text-blue-600 border border-blue-100'
                          : 'bg-slate-50 text-slate-600 border border-slate-150'
                      }`}>
                        {pred.trendFactor >= 1.25 ? '↗' : pred.trendFactor <= 0.85 ? '↘' : '→'} {pred.trendFactor}x
                      </span>
                    </td>

                    {/* Hist avg */}
                    <td className="py-4 px-6 text-right font-mono font-medium text-slate-500">
                      {pred.historicalMonthlyAverage} units
                    </td>

                    {/* 7 Days forecast */}
                    <td className="py-4 px-6 text-right font-mono font-bold text-teal-600">
                      {pred.predictedDemand7Days}
                    </td>

                    {/* 15 Days forecast */}
                    <td className="py-4 px-6 text-right font-mono font-bold text-teal-700">
                      {pred.predictedDemand15Days}
                    </td>

                    {/* 30 Days forecast */}
                    <td className="py-4 px-6 text-right font-mono font-bold text-indigo-700">
                      {pred.predictedDemand30Days}
                    </td>

                    {/* Classification status */}
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        pred.demandClassification === 'High Demand'
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : pred.demandClassification === 'Low Demand'
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {pred.demandClassification}
                      </span>
                    </td>

                    {/* Recommended purchase */}
                    <td className="py-4 px-6 text-right font-mono font-bold text-slate-800">
                      {pred.reorderQuantityRecommended} units
                    </td>

                    {/* Action trigger button */}
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleTriggerReorder(pred)}
                        disabled={isReordered}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all font-sans cursor-pointer ${
                          isReordered
                            ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 hover:border-teal-300'
                        }`}
                      >
                        {isReordered ? (
                          <span className="flex items-center gap-1 justify-center">
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                            Pre-ordered
                          </span>
                        ) : (
                          'Dispatch order'
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredPredictions.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-xs font-mono">
                    No matching predictive records found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Background Scheduler Simulation Log table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
              Prediction Daemon background updates (Every 24 Hours)
            </h3>
          </div>
          <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md uppercase">
            New DB Schema Locked
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-mono">
          The background scheduler daemon uses the terminal date to trigger updates. When currentSystemDate changes or standard triggers occur, the forecast calculations are automatically stored in the <code className="bg-slate-950 px-1 py-0.5 rounded text-teal-300">premier_pharmacy_v2_prediction_logs</code> table.
        </p>

        <div className="overflow-x-auto bg-slate-950/60 rounded-xl border border-slate-800">
          <table className="w-full text-left text-[11px] font-mono divide-y divide-slate-800">
            <thead>
              <tr className="bg-slate-950 text-slate-500 uppercase text-[9px] font-bold">
                <th className="py-3 px-4">Run timestamp</th>
                <th className="py-3 px-4">Operating Date</th>
                <th className="py-3 px-4">Trends Search Index</th>
                <th className="py-3 px-4">Weather conditions</th>
                <th className="py-3 px-4 text-right">Avg Confidence</th>
                <th className="py-3 px-4 text-center">Spike Triggers</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-slate-300">
              {runHistory.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 flex items-center gap-1.5 text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 font-bold text-white">{log.runDate}</td>
                  <td className="py-3 px-4 text-teal-400 font-bold">{log.googleTrendsScore}% Search Volume</td>
                  <td className="py-3 px-4">{log.weatherCondition} ({log.season})</td>
                  <td className="py-3 px-4 text-right text-emerald-400 font-bold">{log.avgConfidence}%</td>
                  <td className="py-3 px-4 text-center text-rose-400 font-bold">{log.highDemandCount} Outbreak items</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                      Success
                    </span>
                  </td>
                </tr>
              ))}

              {runHistory.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500">
                    No background scheduler events registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
