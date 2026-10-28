// src/components/TripApp.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, BarChart3, List, Settings, Trash2, Plus, X, Edit2, Check 
} from 'lucide-react';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc 
} from 'firebase/firestore';
import { db } from '../services/firebase';

// --- このファイル内で型を直接定義してエクスポートのすれ違いを防ぐ ---
export interface Trip {
  id: string;
  title: string;
  start_date: string;
}

export interface TripExpense {
  id: string;
  trip_id: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  payer: 'AO' | 'MASA';
  memo: string;
}

export interface CategoryItem {
  id: string;
  name: string;
}

export default function TripApp() {
  const [activeTabTrip, setActiveTabTrip] = useState<'input' | 'summary' | 'list' | 'settings'>('input');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [tripExpenses, setTripExpenses] = useState<TripExpense[]>([]);
  const [tripCategories, setTripCategories] = useState<CategoryItem[]>([]);
  const [ratioAO, setRatioAO] = useState<number>(50);
  
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
  const [showNewTripForm, setShowNewTripForm] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripDate, setNewTripDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [newTripCategory, setNewTripCategory] = useState('');

  const [editingTripCategoryId, setEditingTripCategoryId] = useState<string | null>(null);
  const [editingTripCategoryName, setEditingTripCategoryName] = useState('');

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    JPY: 1, USD: 150, EUR: 160, KRW: 0.11, TWD: 4.8
  });
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');
  const [editingCurrencyCode, setEditingCurrencyCode] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');

  const fetchTripData = async () => {
    try {
      const ratioDoc = await getDoc(doc(db, 'ratios', 'current'));
      if (ratioDoc.exists()) {
        setRatioAO(ratioDoc.data().ratio_ao ?? 50);
      }

      const tripSnap = await getDocs(query(collection(db, 'trips'), orderBy('start_date', 'desc')));
      const tripList = tripSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      setTrips(tripList);
      if (tripList.length > 0) {
        setSelectedTripId(prev => (prev && tripList.some(t => t.id === prev) ? prev : tripList[0].id));
      } else {
        setSelectedTripId('');
      }

      const tripCatSnap = await getDocs(collection(db, 'trip_categories'));
      const tripCatList = tripCatSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryItem));
      setTripCategories(tripCatList);
      if (tripCatList.length > 0) {
        setTripCategory(prev => (prev && tripCatList.some(c => c.name === prev) ? prev : tripCatList[0].name));
      }
    } catch (e) {
      console.error('旅行データ取得エラー:', e);
    }
  };

  const fetchTripExpenses = async (tripId: string) => {
    if (!tripId) {
      setTripExpenses([]);
      return;
    }
    try {
      const snap = await getDocs(query(collection(db, 'trip_expenses')));
      const list = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as TripExpense))
        .filter(item => item.trip_id === tripId);
      list.sort((a, b) => b.date.localeCompare(a.date));
      setTripExpenses(list);
    } catch (e) {
      console.error('旅行明細取得エラー:', e);
    }
  };

  useEffect(() => { fetchTripData(); }, []);
  useEffect(() => { if (selectedTripId) fetchTripExpenses(selectedTripId); }, [selectedTripId]);

  const handleAddTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripTitle.trim()) {
      alert('旅行名を入力してください');
      return;
    }
    const newId = Date.now().toString();
    const startDate = newTripDate || new Date().toISOString().split('T')[0];
    try {
      await setDoc(doc(db, 'trips', newId), { title: newTripTitle.trim(), start_date: startDate });
      setNewTripTitle('');
      setShowNewTripForm(false);
      await fetchTripData();
      setSelectedTripId(newId);
    } catch (err) {
      alert('旅行の作成に失敗しました');
      console.error(err);
    }
  };

  const handleSaveTripExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId || !tripAmount || Number(tripAmount) <= 0 || !tripPayer || !tripCategory) return;
    const newId = Date.now().toString();
    const expenseData = {
      trip_id: selectedTripId,
      date: tripDate,
      category: tripCategory,
      amount: Number(tripAmount),
      currency: tripCurrency,
      payer: tripPayer!,
      memo: tripMemo
    };
    try {
      await setDoc(doc(db, 'trip_expenses', newId), expenseData);
      setTripAmount(''); setTripMemo('');
      fetchTripExpenses(selectedTripId);
      setActiveTabTrip('summary');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTripExpense = async (id: string) => {
    if (confirm('この旅の明細を削除しますか？')) {
      try {
        await deleteDoc(doc(db, 'trip_expenses', id));
        fetchTripExpenses(selectedTripId);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddTripCategory = async () => {
    const trimmed = newTripCategory.trim();
    if (!trimmed) return;
    if (tripCategories.some(c => c.name === trimmed)) {
      alert('そのカテゴリーは既に存在します');
      return;
    }
    const newId = Date.now().toString();
    try {
      await setDoc(doc(db, 'trip_categories', newId), { name: trimmed });
      setNewTripCategory('');
      await fetchTripData();
      setTripCategory(trimmed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTripCategory = async (id: string) => {
    const trimmed = editingTripCategoryName.trim();
    if (!trimmed) return;
    try {
      await updateDoc(doc(db, 'trip_categories', id), { name: trimmed });
      setEditingTripCategoryId(null);
      await fetchTripData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTripCategory = async (id: string, name: string) => {
    if (!confirm(`旅行カテゴリー「${name}」を削除しますか？`)) return;
    try {
      await deleteDoc(doc(db, 'trip_categories', id));
      await fetchTripData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExchangeRate = () => {
    const code = newCurrencyCode.trim().toUpperCase();
    const rate = Number(newCurrencyRate);
    if (!code || !rate || rate <= 0) {
      alert('有効な通貨コードとレートを入力してください');
      return;
    }
    setExchangeRates(prev => ({ ...prev, [code]: rate }));
    setNewCurrencyCode(''); setNewCurrencyRate('');
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
      return { currency, rate, totalRaw: val.totalRaw, totalJPY: val.totalJPY };
    });

    return { currencyList, grandTotalJPY, aoTotalJPY, masaTotalJPY, settlementMsg };
  }, [tripExpenses, ratioAO, exchangeRates]);

  return (
    <div className="flex-1 flex flex-col bg-stone-50">
      <div className="bg-rose-50/70 text-stone-700 p-5 pb-6 border-b border-rose-100 space-y-3">
        <div>
          <h1 className="text-xl font-black tracking-wide text-rose-900">旅のお会計</h1>
          <p className="text-xs text-rose-700/70">旅ごと・通貨ごとに、AOとMASAの支払いを記録。</p>
        </div>

        <div className="bg-white/90 p-3.5 rounded-2xl border border-rose-200/60 space-y-3 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xxs font-bold text-rose-700/80 uppercase">対象の旅行</span>
            <button 
              type="button" 
              onClick={() => setShowNewTripForm(!showNewTripForm)} 
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 transition"
            >
              <Plus size={13} /> {showNewTripForm ? '閉じる' : '新規作成'}
            </button>
          </div>

          {showNewTripForm && (
            <form onSubmit={handleAddTrip} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
              <p className="text-xs font-bold text-stone-700">新しい旅行の作成</p>
              <input type="text" placeholder="旅行名 (例: 北海道旅行)" value={newTripTitle} onChange={(e) => setNewTripTitle(e.target.value)} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-xs" />
              <input type="date" value={newTripDate} onChange={(e) => setNewTripDate(e.target.value)} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-xs" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewTripForm(false)} className="flex-1 py-2 bg-stone-200 text-stone-600 font-bold rounded-lg text-xs">キャンセル</button>
                <button type="submit" className="flex-1 py-2 bg-rose-500 text-white font-bold rounded-lg text-xs shadow-xs">作成して選択</button>
              </div>
            </form>
          )}

          <select value={selectedTripId} onChange={(e) => setSelectedTripId(e.target.value)} className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none">
            {trips.length === 0 ? <option value="">旅行がありません。新規作成してください</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title} ({t.start_date})</option>)}
          </select>
        </div>
      </div>

      <nav className="flex justify-around text-xs font-bold border-b border-stone-200/60 bg-white shadow-xs">
        <button type="button" onClick={() => setActiveTabTrip('input')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'input' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><PlusCircle size={15} />入力</button>
        <button type="button" onClick={() => setActiveTabTrip('summary')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'summary' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><BarChart3 size={15} />集計</button>
        <button type="button" onClick={() => setActiveTabTrip('list')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'list' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><List size={15} />明細</button>
        <button type="button" onClick={() => setActiveTabTrip('settings')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTabTrip === 'settings' ? 'text-rose-600 bg-rose-50/40 border-b-2 border-rose-500' : 'text-stone-400'}`}><Settings size={15} />設定</button>
      </nav>

      <div className="flex-1 p-5 overflow-y-auto">
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
                  {Object.keys(exchangeRates).map(cur => <option key={cur} value={cur}>{cur}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xxs font-bold text-stone-400 block mb-1">カテゴリー</label>
                <select value={tripCategory} onChange={(e) => setTripCategory(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium">
                  {tripCategories.length === 0 ? <option value="">設定画面で追加してください</option> : tripCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
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

            <button type="submit" disabled={!selectedTripId || !tripAmount || !tripPayer || !tripCategory} className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:bg-stone-200 text-white font-bold rounded-xl text-sm shadow-xs transition">
              追加して集計を見る
            </button>
          </form>
        )}

        {activeTabTrip === 'summary' && (
          <div className="space-y-4">
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
                          <span className="text-xxs font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">レート: 1 {item.currency} = {item.rate} JPY</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 font-medium">現地支払: {item.totalRaw.toLocaleString()}</p>
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

        {activeTabTrip === 'settings' && (
          <div className="space-y-5">
            <div className="bg-white border border-stone-200/60 rounded-2xl p-4 space-y-3 shadow-xs">
              <h4 className="text-sm font-bold text-stone-600">旅行専用カテゴリー設定</h4>
              <div className="flex gap-2">
                <input type="text" placeholder="例: アクティビティ" value={newTripCategory} onChange={(e) => setNewTripCategory(e.target.value)} className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs" />
                <button type="button" onClick={handleAddTripCategory} className="px-4 bg-stone-700 hover:bg-stone-800 text-white rounded-xl text-xs font-bold">追加</button>
              </div>

              <div className="space-y-1.5 pt-1">
                {tripCategories.length === 0 ? (
                  <p className="text-xs text-stone-400 py-2 text-center">登録されたカテゴリーがありません</p>
                ) : (
                  tripCategories.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl text-xs border border-stone-200/60">
                      {editingTripCategoryId === c.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <input type="text" value={editingTripCategoryName} onChange={(e) => setEditingTripCategoryName(e.target.value)} className="flex-1 p-1.5 bg-white border border-stone-300 rounded-lg text-xs" />
                          <button type="button" onClick={() => handleUpdateTripCategory(c.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={14} /></button>
                          <button type="button" onClick={() => setEditingTripCategoryId(null)} className="p-1.5 bg-stone-200 text-stone-600 rounded-lg"><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-stone-700 font-medium">{c.name}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setEditingTripCategoryId(c.id); setEditingTripCategoryName(c.name); }} className="text-stone-400 hover:text-sky-600 p-1"><Edit2 size={13} /></button>
                            <button type="button" onClick={() => handleDeleteTripCategory(c.id, c.name)} className="text-stone-300 hover:text-rose-500 p-1"><Trash2 size={13} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

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
                        <input type="text" inputMode="numeric" value={editingRateValue} onChange={(e) => setEditingRateValue(e.target.value.replace(/[^0-9.]/g, ''))} className="w-20 p-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-right" />
                        <span className="text-stone-400 text-xxs">JPY</span>
                        <button type="button" onClick={() => handleUpdateExchangeRate(code)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={14} /></button>
                        <button type="button" onClick={() => setEditingCurrencyCode(null)} className="p-1.5 bg-stone-200 text-stone-600 rounded-lg"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-stone-500 font-medium mr-1">1 {code} = {rate} JPY</span>
                        {code !== 'JPY' && (
                          <>
                            <button type="button" onClick={() => { setEditingCurrencyCode(code); setEditingRateValue(String(rate)); }} className="text-stone-400 hover:text-sky-600 p-1"><Edit2 size={13} /></button>
                            <button type="button" onClick={() => handleDeleteExchangeRate(code)} className="text-stone-300 hover:text-rose-500 p-1"><Trash2 size={14} /></button>
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
  );
}