import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, BarChart3, List, Settings, ChevronLeft, ChevronRight, 
  Trash2, Plus, X, Plane, Wallet, Edit2, Check 
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Expense { id: string; date: string; category: string; amount: number; payer: 'AO' | 'MASA'; memo: string; }
interface CategoryItem { id: string; name: string; }
interface Trip { id: string; title: string; start_date: string; }
interface TripExpense { id: string; trip_id: string; date: string; category: string; amount: number; currency: string; payer: 'AO' | 'MASA'; memo: string; }

export default function App() {
  const [appMode, setAppMode] = useState<'daily' | 'trip'>('daily');

  // --- 【日常家計簿】用ステート ---
  const [activeTabDaily, setActiveTabDaily] = useState<'input' | 'summary' | 'list' | 'settings'>('input');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [ratioAO, setRatioAO] = useState<number>(50);
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<'AO' | 'MASA' | null>(null);
  const [memo, setMemo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // --- 【旅のお会計】用ステート ---
  const [activeTabTrip, setActiveTabTrip] = useState<'input' | 'summary' | 'list' | 'settings'>('input');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [tripExpenses, setTripExpenses] = useState<TripExpense[]>([]);
  const [tripCategories, setTripCategories] = useState<CategoryItem[]>([]);
  
  // 旅行入力フォーム
  const [tripDate, setTripDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [tripCategory, setTripCategory] = useState('');
  const [tripAmount, setTripAmount] = useState('');
  const [tripCurrency, setTripCurrency] = useState('JPY');
  const [tripPayer, setTripPayer] = useState<'AO' | 'MASA' | null>(null);
  const [tripMemo, setTripMemo] = useState('');
  
  // 新規旅行作成用
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripDate, setNewTripDate] = useState('');
  const [newTripCategory, setNewTripCategory] = useState('');

  // 編集用ステート（カテゴリー & 通貨）
  const [editingTripCategoryId, setEditingTripCategoryId] = useState<string | null>(null);
  const [editingTripCategoryName, setEditingTripCategoryName] = useState('');

  // 通貨・為替レート設定
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    JPY: 1,
    USD: 150,
    EUR: 160,
    KRW: 0.11,
    TWD: 4.8
  });
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');

  // 通貨編集用ステート
  const [editingCurrencyCode, setEditingCurrencyCode] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');

  // --- データ取得 ---
  const fetchData = async () => {
    try {
      const { data: expData } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (expData) setExpenses(expData);

      const { data: catData } = await supabase.from('categories').select('*').order('id');
      if (catData) {
        setCategories(catData);
        if (catData.length > 0 && !category) setCategory(catData[0].name);
      }

      const { data: ratData } = await supabase.from('ratios').select('ratio_ao').eq('id', 'current').single();
      if (ratData) setRatioAO(ratData.ratio_ao);

      const { data: tripData } = await supabase.from('trips').select('*').order('start_date', { ascending: false });
      if (tripData && tripData.length > 0) {
        setTrips(tripData);
        if (!selectedTripId) setSelectedTripId(tripData[0].id);
      }

      const { data: tripCatData } = await supabase.from('trip_categories').select('*').order('id');
      if (tripCatData) {
        setTripCategories(tripCatData);
        if (tripCatData.length > 0 && !tripCategory) setTripCategory(tripCatData[0].name);
      }
    } catch (e) { console.error(e); }
  };

  const fetchTripExpenses = async (tripId: string) => {
    if (!tripId) return;
    const { data } = await supabase.from('trip_expenses').select('*').eq('trip_id', tripId).order('date', { ascending: false });
    if (data) setTripExpenses(data);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (selectedTripId) fetchTripExpenses(selectedTripId); }, [selectedTripId]);

  // --- 【日常】ハンドラー ---
  const ymStr = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month]);
  const filteredDaily = useMemo(() => expenses.filter(i => i.date.startsWith(ymStr)), [expenses, ymStr]);

  const handleSaveDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !payer || !category) return;
    const expenseData = { date, category, amount: Number(amount), payer: payer!, memo };
    if (editingId) {
      await supabase.from('expenses').update(expenseData).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('expenses').insert([{ id: Date.now().toString(), ...expenseData }]);
    }
    setAmount(''); setMemo(''); fetchData();
  };

  // --- 【旅】ハンドラー ---
  const handleAddTrip = async () => {
    if (!newTripTitle.trim()) return;
    const newId = Date.now().toString();
    const startDate = newTripDate || new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('trips').insert([{ id: newId, title: newTripTitle.trim(), start_date: startDate }]);
    if (error) { alert('旅行の作成に失敗しました'); return; }
    setNewTripTitle(''); setNewTripDate('');
    await fetchData();
    setSelectedTripId(newId);
  };

  const handleSaveTripExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId || !tripAmount || Number(tripAmount) <= 0 || !tripPayer || !tripCategory) return;
    const expenseData = {
      id: Date.now().toString(),
      trip_id: selectedTripId,
      date: tripDate,
      category: tripCategory,
      amount: Number(tripAmount),
      currency: tripCurrency,
      payer: tripPayer!,
      memo: tripMemo
    };
    await supabase.from('trip_expenses').insert([expenseData]);
    setTripAmount(''); setTripMemo('');
    fetchTripExpenses(selectedTripId);
    setActiveTabTrip('summary');
  };

  const handleDeleteTripExpense = async (id: string) => {
    if (confirm('この旅の明細を削除しますか？')) {
      await supabase.from('trip_expenses').delete().eq('id', id);
      fetchTripExpenses(selectedTripId);
    }
  };

  const handleAddTripCategory = async () => {
    const trimmed = newTripCategory.trim();
    if (!trimmed || tripCategories.some(c => c.name === trimmed)) return;
    await supabase.from('trip_categories').insert([{ id: Date.now().toString(), name: trimmed }]);
    setNewTripCategory(''); fetchData();
  };

  const handleUpdateTripCategory = async (id: string) => {
    const trimmed = editingTripCategoryName.trim();
    if (!trimmed) return;
    await supabase.from('trip_categories').update({ name: trimmed }).eq('id', id);
    setEditingTripCategoryId(null);
    fetchData();
  };

  const handleDeleteTripCategory = async (id: string, name: string) => {
    if (!confirm(`旅行カテゴリー「${name}」を削除しますか？`)) return;
    await supabase.from('trip_categories').delete().eq('id', id);
    fetchData();
  };

  const handleAddExchangeRate = () => {
    const code = newCurrencyCode.trim().toUpperCase();
    const rate = Number(newCurrencyRate);
    if (!code || !rate || rate <= 0) {
      alert('有効な通貨コードとレートを入力してください');
      return;
    }
    setExchangeRates(prev => ({ ...prev, [code]: rate }));
    setNewCurrencyCode('');
    setNewCurrencyRate('');
  };

  const handleUpdateExchangeRate = (code: string) => {
    const rate = Number(editingRateValue);
    if (!rate || rate <= 0) {
      alert('有効なレートを入力してください');
      return;
    }
    setExchangeRates(prev => ({ ...prev, [code]: rate }));
    setEditingCurrencyCode(null);
  };

  const handleDeleteExchangeRate = (code: string) => {
    if (code === 'JPY') {
      alert('JPYは削除できません');
      return;
    }
    if (confirm(`通貨「${code}」を削除しますか？`)) {
      setExchangeRates(prev => {
        const copy = { ...prev };
        delete copy[code];
        return copy;
      });
      if (tripCurrency === code) setTripCurrency('JPY');
    }
  };

  const selectedTrip = useMemo(() => trips.find(t => t.id === selectedTripId), [trips, selectedTripId]);

  const tripSummaryData = useMemo(() => {
    const currencyMap: Record<string, { totalRaw: number; totalJPY: number }> = {};
    let grandTotalJPY = 0;
    let aoTotalJPY = 0;
    let masaTotalJPY = 0;

    tripExpenses.forEach(exp => {
      const cur = exp.currency || 'JPY';
      const rate = exchangeRates[cur] || 1;
      const amountInJPY = exp.amount * rate;

      if (!currencyMap[cur]) currencyMap[cur] = { totalRaw: 0, totalJPY: 0 };
      currencyMap[cur].totalRaw += exp.amount;
      currencyMap[cur].totalJPY += amountInJPY;

      grandTotalJPY += amountInJPY;
      if (exp.payer === 'AO') aoTotalJPY += amountInJPY;
      if (exp.payer === 'MASA') masaTotalJPY += amountInJPY;
    });

    const aoTargetJPY = grandTotalJPY * (ratioAO / 100);
    const diffJPY = aoTotalJPY - aoTargetJPY;
    const settlementMsg = diffJPY > 0 
      ? `MASA -> AO JPY ${Math.round(diffJPY).toLocaleString()} 支払う` 
      : diffJPY < 0 
      ? `AO -> MASA JPY ${Math.round(Math.abs(diffJPY)).toLocaleString()} 支払う` 
      : 'ぴったり折半です！';

    const currencyList = Object.entries(currencyMap).map(([currency, val]) => {
      const rate = exchangeRates[currency] || 1;
      return {
        currency,
        rate,
        totalRaw: val.totalRaw,
        totalJPY: val.totalJPY
      };
    });

    return {
      currencyList,
      grandTotalJPY,
      aoTotalJPY,
      masaTotalJPY,
      settlementMsg
    };
  }, [tripExpenses, ratioAO, exchangeRates]);

  return (
    <div className="min-h-screen bg-stone-100 flex justify-center items-start pt-4 px-4 font-sans text-stone-700">
      <div className="w-full max-w-md bg-stone-50 rounded-3xl shadow-xl border border-stone-200/60 flex flex-col min-h-[720px] overflow-hidden mb-8">
        
        {/* === モード切替ヘッダー（淡いナチュラルカラー） === */}
        <div className="bg-stone-200/80 text-stone-600 px-4 py-3 flex justify-between items-center text-xs font-bold border-b border-stone-300/50">
          <span className="text-stone-500">表示モード:</span>
          <div className="flex bg-stone-300/60 p-1 rounded-xl gap-1">
            <button 
              type="button" 
              onClick={() => setAppMode('daily')} 
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${appMode === 'daily' ? 'bg-white text-sky-700 font-bold shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <Wallet size={14} /> 日常の家計簿
            </button>
            <button 
              type="button" 
              onClick={() => setAppMode('trip')} 
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${appMode === 'trip' ? 'bg-white text-rose-600 font-bold shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <Plane size={14} /> 旅のお会計
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* モード A: 日常の家計簿                                    */}
        {/* ========================================================= */}
        {appMode === 'daily' && (
          <div className="flex-1 flex flex-col">
            <header className="pt-5 pb-3 border-b border-stone-200/60 text-center bg-sky-50/50">
              <h1 className="text-lg font-bold text-sky-800">AO & MASA 会計 (日常)</h1>
              <div className="flex justify-center items-center gap-6 mt-2">
                <button type="button" onClick={() => { if (month === 1) { setYear(year - 1); setMonth(12); } else { setMonth(month - 1); } }} className="p-1 text-sky-600"><ChevronLeft size={18} /></button>
                <span className="text-sm font-bold text-stone-600">{year}年{month}月</span>
                <button type="button" onClick={() => { if (month === 12) { setYear(year + 1); setMonth(1); } else { setMonth(month + 1); } }} className="p-1 text-sky-600"><ChevronRight size={18} /></button>
              </div>
            </header>

            <nav className="flex justify-around text-xs font-bold border-b border-stone-200/60 bg-stone-100/50">
              <button type="button" onClick={() => setActiveTabDaily('input')} className={`w-full py-2.5 flex flex-col items-center gap-1 ${activeTabDaily === 'input' ? 'text-sky-700 bg-white border-b-2 border-sky-600' : 'text-stone-400'}`}><PlusCircle size={15} />入力</button>
              <button type="button" onClick={() => setActiveTabDaily('summary')} className={`w-full py-2.5 flex flex-col items-center gap-1 ${activeTabDaily === 'summary' ? 'text-sky-700 bg-white border-b-2 border-sky-600' : 'text-stone-400'}`}><BarChart3 size={15} />集計</button>
              <button type="button" onClick={() => setActiveTabDaily('list')} className={`w-full py-2.5 flex flex-col items-center gap-1 ${activeTabDaily === 'list' ? 'text-sky-700 bg-white border-b-2 border-sky-600' : 'text-stone-400'}`}><List size={15} />明細</button>
              <button type="button" onClick={() => setActiveTabDaily('settings')} className={`w-full py-2.5 flex flex-col items-center gap-1 ${activeTabDaily === 'settings' ? 'text-sky-700 bg-white border-b-2 border-sky-600' : 'text-stone-400'}`}><Settings size={15} />設定</button>
            </nav>

            <div className="flex-1 p-5 bg-stone-50 overflow-y-auto">
              {activeTabDaily === 'input' && (
                <form onSubmit={handleSaveDaily} className="space-y-3 text-xs bg-white p-5 rounded-2xl border border-stone-200/60 shadow-xs">
                  <div><label className="font-bold text-stone-400 block mb-1">日付</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50" /></div>
                  <div><label className="font-bold text-stone-400 block mb-1">カテゴリー</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50">{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                  <div><label className="font-bold text-stone-400 block mb-1">金額</label><input type="text" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 text-right font-bold rounded-xl border border-stone-200 bg-stone-50" /></div>
                  <div><label className="font-bold text-stone-400 block mb-1">支払った人</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPayer('AO')} className={`py-2 rounded-xl font-bold border ${payer === 'AO' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-stone-50 text-stone-400 border-stone-200'}`}>AO</button><button type="button" onClick={() => setPayer('MASA')} className={`py-2 rounded-xl font-bold border ${payer === 'MASA' ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-stone-50 text-stone-400 border-stone-200'}`}>MASA</button></div></div>
                  <div><label className="font-bold text-stone-400 block mb-1">メモ</label><input type="text" placeholder="任意" value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50" /></div>
                  <button type="submit" disabled={!amount || !payer} className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl shadow-xs hover:bg-sky-700 transition">追加する</button>
                </form>
              )}

              {activeTabDaily === 'summary' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-white rounded-2xl p-5 text-center border border-stone-200/60 shadow-xs"><p className="font-bold text-stone-400 mb-1">{year}年{month}月の総支出</p><p className="text-2xl font-black text-stone-700">JPY {filteredDaily.reduce((s, i) => s + i.amount, 0).toLocaleString()}</p></div>
                </div>
              )}

              {activeTabDaily === 'list' && (
                <div className="space-y-2 text-xs">
                  {filteredDaily.map(i => (
                    <div key={i.id} className="p-3 border border-stone-200/60 rounded-xl flex justify-between items-center bg-white shadow-xs">
                      <div><span className="font-bold text-stone-700">{i.category}</span><p className="text-xxs text-stone-400">{i.date}</p></div>
                      <span className="font-bold text-stone-800">JPY {i.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTabDaily === 'settings' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-white border border-stone-200/60 rounded-2xl shadow-xs"><h4 className="font-bold text-stone-500 mb-2">日常カテゴリー管理</h4></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* モード B: 旅のお会計（やわらかいウォームローズ調）          */}
        {/* ========================================================= */}
        {appMode === 'trip' && (
          <div className="flex-1 flex flex-col bg-stone-50">
            {/* ヘッダー＆旅行選択 */}
            <div className="bg-rose-50/70 text-stone-700 p-5 pb-6 border-b border-rose-100 space-y-3">
              <div>
                <h1 className="text-xl font-black tracking-wide text-rose-900">旅のお会計</h1>
                <p className="text-xs text-rose-700/70">旅ごと・通貨ごとに、AOとMASAの支払いを記録。</p>
              </div>

              <div className="bg-white/80 p-3 rounded-2xl border border-rose-200/60 space-y-2 shadow-xs">
                <div className="flex justify-between items-center">
                  <span className="text-xxs font-bold text-rose-700/60 uppercase">対象の旅行</span>
                  <details className="text-xs">
                    <summary className="cursor-pointer font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                      <Plus size={12} /> 新規作成
                    </summary>
                    <div className="absolute right-4 mt-2 p-3 bg-white text-stone-700 border border-stone-200 rounded-xl space-y-2 shadow-xl z-20 w-64">
                      <input type="text" placeholder="旅行名 (例: ハワイ旅行)" value={newTripTitle} onChange={(e) => setNewTripTitle(e.target.value)} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs" />
                      <input type="date" value={newTripDate} onChange={(e) => setNewTripDate(e.target.value)} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs" />
                      <button type="button" onClick={handleAddTrip} className="w-full py-2 bg-rose-500 text-white font-bold rounded-lg text-xs">作成する</button>
                    </div>
                  </details>
                </div>

                <select 
                  value={selectedTripId} 
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none"
                >
                  {trips.length === 0 ? <option value="">旅行を作成してください</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title} ({t.start_date})</option>)}
                </select>
              </div>
            </div>

            {/* 4タブナビゲーション */}
            <nav className="flex justify-around text-xs font-bold border-b border-stone-200/60 bg-white shadow-xs">
              <button type="button" onClick={() => setActiveTabTrip('input')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'input' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><PlusCircle size={15} />入力</button>
              <button type="button" onClick={() => setActiveTabTrip('summary')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'summary' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><BarChart3 size={15} />集計</button>
              <button type="button" onClick={() => setActiveTabTrip('list')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'list' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><List size={15} />明細</button>
              <button type="button" onClick={() => setActiveTabTrip('settings')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'settings' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><Settings size={15} />設定</button>
            </nav>

            {/* タブコンテンツ */}
            <div className="flex-1 p-5 overflow-y-auto">
              
              {/* 【1】入力画面 */}
              {activeTabTrip === 'input' && (
                <form onSubmit={handleSaveTripExpense} className="space-y-4 bg-white p-5 rounded-2xl shadow-xs border border-stone-200/60">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">旅行の支出を記録</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xxs font-bold text-stone-400 block mb-1">日付</label>
                      <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium" />
                    </div>
                    <div>
                      <label className="text-xxs font-bold text-stone-400 block mb-1">通貨</label>
                      <select value={tripCurrency} onChange={(e) => setTripCurrency(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold">
                        {Object.keys(exchangeRates).map(cur => (
                          <option key={cur} value={cur}>{cur}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xxs font-bold text-stone-400 block mb-1">カテゴリー</label>
                      <select value={tripCategory} onChange={(e) => setTripCategory(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium">
                        {tripCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xxs font-bold text-stone-400 block mb-1">金額</label>
                      <input type="text" inputMode="numeric" placeholder="0" value={tripAmount} onChange={(e) => setTripAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-right text-base" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xxs font-bold text-stone-400 block mb-1">支払った人</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setTripPayer('AO')} className={`py-3 rounded-xl text-xs font-bold border transition ${tripPayer === 'AO' ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs' : 'bg-stone-50 text-stone-400 border-stone-200'}`}>AO</button>
                      <button type="button" onClick={() => setTripPayer('MASA')} className={`py-3 rounded-xl text-xs font-bold border transition ${tripPayer === 'MASA' ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-xs' : 'bg-stone-50 text-stone-400 border-stone-200'}`}>MASA</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xxs font-bold text-stone-400 block mb-1">メモ</label>
                    <input type="text" placeholder="例: タクシー代、お土産など" value={tripMemo} onChange={(e) => setTripMemo(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs placeholder-stone-300" />
                  </div>

                  <button type="submit" disabled={!selectedTripId || !tripAmount || !tripPayer} className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:bg-stone-200 text-white font-bold rounded-xl text-sm shadow-xs transition">
                    追加して集計を見る
                  </button>
                </form>
              )}

              {/* 【2】集計画面 */}
              {activeTabTrip === 'summary' && (
                <div className="space-y-4">
                  {/* 日本円一括精算カード（淡いベージュグラデーション） */}
                  <div className="bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-stone-200/50 rounded-2xl p-5 border border-rose-200/60 shadow-xs space-y-3">
                    <div className="text-center space-y-1 border-b border-rose-200/60 pb-4">
                      <p className="text-xxs font-bold text-stone-400 uppercase tracking-wider">旅の総支出 (日本円換算合計)</p>
                      <p className="text-3xl font-black text-rose-950">JPY {Math.round(tripSummaryData.grandTotalJPY).toLocaleString()}</p>
                    </div>

                    <div className="space-y-1.5 text-xs pt-1">
                      <div className="flex justify-between"><span className="text-stone-500">AO 支払合計:</span><span className="font-bold text-rose-700">JPY {Math.round(tripSummaryData.aoTotalJPY).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-stone-500">MASA 支払合計:</span><span className="font-bold text-sky-700">JPY {Math.round(tripSummaryData.masaTotalJPY).toLocaleString()}</span></div>
                      <div className="pt-3 mt-2 border-t border-dashed border-rose-200/80 text-center font-black text-amber-800 text-sm bg-white/60 py-2.5 rounded-xl border border-amber-100">
                        {tripSummaryData.settlementMsg}
                      </div>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider px-1">通貨別内訳・適用為替レート</h4>
                  
                  {tripSummaryData.currencyList.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-xs text-stone-400 border border-stone-200/60">まだ支出の記録がありません</div>
                  ) : (
                    <div className="space-y-2">
                      {tripSummaryData.currencyList.map(item => (
                        <div key={item.currency} className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200/60 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-800 text-sm">{item.currency}</span>
                              {item.currency !== 'JPY' && (
                                <span className="text-xxs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                                  レート: 1 {item.currency} = {item.rate} JPY
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-400 font-medium">
                              現地支払: {item.totalRaw.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-stone-400 block font-bold">円換算小計</span>
                            <span className="font-black text-stone-700 text-base">JPY {Math.round(item.totalJPY).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 【3】明細画面 */}
              {activeTabTrip === 'list' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-stone-400 tracking-wider uppercase mb-1">旅の明細一覧 ({tripExpenses.length}件)</h3>
                  {tripExpenses.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-stone-200/60 text-stone-400 text-xs">データがありません</div>
                  ) : (
                    tripExpenses.map(item => (
                      <div key={item.id} className="bg-white border border-stone-200/60 rounded-xl p-4 flex justify-between items-center shadow-xs">
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xxs font-bold px-2 py-0.5 rounded-md ${item.payer === 'AO' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-sky-50 text-sky-700 border border-sky-100'}`}>{item.payer}</span>
                            <span className="text-sm font-bold text-stone-700 truncate">{item.category}</span>
                          </div>
                          <p className="text-xs text-stone-400 truncate">{item.date} {item.memo && `• ${item.memo}`}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-stone-800 text-sm">{item.currency} {item.amount.toLocaleString()}</span>
                          <button type="button" onClick={() => handleDeleteTripExpense(item.id)} className="text-stone-300 hover:text-rose-500 p-1"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 【4】設定画面 */}
              {activeTabTrip === 'settings' && (
                <div className="space-y-5">
                  {/* 旅行専用カテゴリー設定 */}
                  <div className="bg-white border border-stone-200/60 rounded-2xl p-4 space-y-3 shadow-xs">
                    <h4 className="text-sm font-bold text-stone-600">旅行専用カテゴリー設定</h4>
                    <div className="flex gap-2">
                      <input type="text" placeholder="例: アクティビティ" value={newTripCategory} onChange={(e) => setNewTripCategory(e.target.value)} className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs" />
                      <button type="button" onClick={handleAddTripCategory} className="px-4 bg-stone-700 hover:bg-stone-800 text-white rounded-xl text-xs font-bold">追加</button>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {tripCategories.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl text-xs border border-stone-200/60">
                          {editingTripCategoryId === c.id ? (
                            <div className="flex items-center gap-2 w-full">
                              <input 
                                type="text" 
                                value={editingTripCategoryName} 
                                onChange={(e) => setEditingTripCategoryName(e.target.value)} 
                                className="flex-1 p-1.5 bg-white border border-stone-300 rounded-lg text-xs" 
                              />
                              <button type="button" onClick={() => handleUpdateTripCategory(c.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={14} /></button>
                              <button type="button" onClick={() => setEditingTripCategoryId(null)} className="p-1.5 bg-stone-200 text-stone-600 rounded-lg"><X size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <span className="text-stone-700 font-medium">{c.name}</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  type="button" 
                                  onClick={() => { setEditingTripCategoryId(c.id); setEditingTripCategoryName(c.name); }} 
                                  className="text-stone-400 hover:text-sky-600 p-1"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => handleDeleteTripCategory(c.id, c.name)} 
                                  className="text-stone-300 hover:text-rose-500 p-1"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 通貨・為替レート設定 */}
                  <div className="bg-white border border-stone-200/60 rounded-2xl p-4 space-y-3 shadow-xs">
                    <h4 className="text-sm font-bold text-stone-600">利用する通貨と為替レート設定</h4>
                    <p className="text-xxs text-stone-400">1通貨あたり何円（JPY）になるかを入力してください。</p>
                    
                    <div className="flex gap-2">
                      <input type="text" placeholder="通貨コード (例: USD)" value={newCurrencyCode} onChange={(e) => setNewCurrencyCode(e.target.value)} className="w-1/2 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs uppercase" />
                      <input type="text" inputMode="numeric" placeholder="レート (例: 150)" value={newCurrencyRate} onChange={(e) => setNewCurrencyRate(e.target.value.replace(/[^0-9.]/g, ''))} className="w-1/2 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs" />
                    </div>
                    <button type="button" onClick={handleAddExchangeRate} className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs transition">通貨・レートを追加する</button>

                    <div className="space-y-1.5 pt-2">
                      {Object.entries(exchangeRates).map(([code, rate]) => (
                        <div key={code} className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl text-xs border border-stone-200/60">
                          <span className="font-bold text-stone-700">{code}</span>
                          
                          {editingCurrencyCode === code ? (
                            <div className="flex items-center gap-2">
                              <span className="text-stone-400 text-xxs">1 {code} =</span>
                              <input 
                                type="text" 
                                inputMode="numeric"
                                value={editingRateValue} 
                                onChange={(e) => setEditingRateValue(e.target.value.replace(/[^0-9.]/g, ''))} 
                                className="w-20 p-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-right" 
                              />
                              <span className="text-stone-400 text-xxs">JPY</span>
                              <button type="button" onClick={() => handleUpdateExchangeRate(code)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={14} /></button>
                              <button type="button" onClick={() => setEditingCurrencyCode(null)} className="p-1.5 bg-stone-200 text-stone-600 rounded-lg"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-stone-500 font-medium mr-1">1 {code} = {rate} JPY</span>
                              {code !== 'JPY' && (
                                <>
                                  <button 
                                    type="button" 
                                    onClick={() => { setEditingCurrencyCode(code); setEditingRateValue(String(rate)); }} 
                                    className="text-stone-400 hover:text-sky-600 p-1"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeleteExchangeRate(code)} 
                                    className="text-stone-300 hover:text-rose-500 p-1"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}