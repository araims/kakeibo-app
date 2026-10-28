// src/components/DailyApp.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, BarChart3, List, Settings, ChevronLeft, ChevronRight, 
  Trash2, Edit2, Check, Percent, X 
} from 'lucide-react';
import { 
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc 
} from 'firebase/firestore';
import { db } from '../services/firebase';

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  payer: 'AO' | 'MASA';
  memo: string;
}

export interface CategoryItem {
  id: string;
  name: string;
}

export default function DailyApp() {
  const [activeTabDaily, setActiveTabDaily] = useState<'input' | 'summary' | 'list' | 'settings'>('input');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [ratioAO, setRatioAO] = useState<number>(50);
  
  // 設定画面用入力ステート
  const [newDailyCategory, setNewDailyCategory] = useState('');
  const [editingDailyCategoryId, setEditingDailyCategoryId] = useState<string | null>(null);
  const [editingDailyCategoryName, setEditingDailyCategoryName] = useState('');

  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<'AO' | 'MASA' | null>(null);
  const [memo, setMemo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchDailyData = async () => {
    try {
      const expSnap = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')));
      setExpenses(expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));

      const catSnap = await getDocs(collection(db, 'categories'));
      const catList = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryItem));
      setCategories(catList);
      if (catList.length > 0) {
        setCategory(prev => (prev && catList.some(c => c.name === prev) ? prev : catList[0].name));
      }

      const ratioDoc = await getDoc(doc(db, 'ratios', 'current'));
      if (ratioDoc.exists()) {
        setRatioAO(ratioDoc.data().ratio_ao ?? 50);
      }
    } catch (e) {
      console.error('日常データ取得エラー:', e);
    }
  };

  useEffect(() => { fetchDailyData(); }, []);

  const ymStr = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month]);
  const filteredDaily = useMemo(() => expenses.filter(i => i.date.startsWith(ymStr)), [expenses, ymStr]);

  const handleSaveDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !payer || !category) return;
    const expenseData = { date, category, amount: Number(amount), payer: payer!, memo };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'expenses', editingId), expenseData);
        setEditingId(null);
      } else {
        const newId = Date.now().toString();
        await setDoc(doc(db, 'expenses', newId), expenseData);
      }
      setAmount(''); setMemo(''); fetchDailyData();
    } catch (err) {
      console.error('保存エラー:', err);
    }
  };

  const handleAddDailyCategory = async () => {
    const trimmed = newDailyCategory.trim();
    if (!trimmed) {
      alert('カテゴリー名を入力してください');
      return;
    }
    if (categories.some(c => c.name === trimmed)) {
      alert('そのカテゴリーは既に存在します');
      return;
    }
    const newId = Date.now().toString();
    try {
      await setDoc(doc(db, 'categories', newId), { name: trimmed });
      setNewDailyCategory('');
      await fetchDailyData();
      setCategory(trimmed);
    } catch (err) {
      console.error('日常カテゴリー追加エラー:', err);
    }
  };

  const handleUpdateDailyCategory = async (id: string) => {
    const trimmed = editingDailyCategoryName.trim();
    if (!trimmed) {
      alert('カテゴリー名を入力してください');
      return;
    }
    try {
      await updateDoc(doc(db, 'categories', id), { name: trimmed });
      setEditingDailyCategoryId(null);
      setEditingDailyCategoryName('');
      await fetchDailyData();
    } catch (err) {
      console.error('日常カテゴリー更新エラー:', err);
      alert('カテゴリーの更新に失敗しました');
    }
  };

  const handleDeleteDailyCategory = async (id: string, name: string) => {
    if (!confirm(`日常カテゴリー「${name}」を削除しますか？`)) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
      await fetchDailyData();
    } catch (err) {
      console.error('日常カテゴリー削除エラー:', err);
    }
  };

  const handleRatioChange = async (newRatio: number) => {
    setRatioAO(newRatio);
    try {
      await setDoc(doc(db, 'ratios', 'current'), { ratio_ao: newRatio });
    } catch (err) {
      console.error('比率の保存に失敗しました:', err);
    }
  };

  const dailySummaryData = useMemo(() => {
    let total = 0;
    let aoTotal = 0;
    let masaTotal = 0;
    const categoryMap: Record<string, number> = {};

    filteredDaily.forEach(item => {
      total += item.amount;
      if (item.payer === 'AO') aoTotal += item.amount;
      if (item.payer === 'MASA') masaTotal += item.amount;
      categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount;
    });

    const categoryList = Object.entries(categoryMap).map(([name, amount]) => ({
      name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0
    }));

    const aoTarget = total * (ratioAO / 100);
    const diff = aoTotal - aoTarget;
    const settlementMsg = diff > 0 
      ? `MASA -> AO JPY ${Math.round(diff).toLocaleString()} 支払う` 
      : diff < 0 
      ? `AO -> MASA JPY ${Math.round(Math.abs(diff)).toLocaleString()} 支払う` 
      : 'ぴったり折半です！';

    return { total, aoTotal, masaTotal, settlementMsg, categoryList };
  }, [filteredDaily, ratioAO]);

  return (
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
            <div>
              <label className="font-bold text-stone-400 block mb-1">カテゴリー</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50">
                {categories.length === 0 ? <option value="">設定画面で追加してください</option> : categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="font-bold text-stone-400 block mb-1">金額</label><input type="text" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 text-right font-bold rounded-xl border border-stone-200 bg-stone-50" /></div>
            <div><label className="font-bold text-stone-400 block mb-1">支払った人</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPayer('AO')} className={`py-2 rounded-xl font-bold border ${payer === 'AO' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-stone-50 text-stone-400 border-stone-200'}`}>AO</button><button type="button" onClick={() => setPayer('MASA')} className={`py-2 rounded-xl font-bold border ${payer === 'MASA' ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-stone-50 text-stone-400 border-stone-200'}`}>MASA</button></div></div>
            <div><label className="font-bold text-stone-400 block mb-1">メモ</label><input type="text" placeholder="任意" value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50" /></div>
            <button type="submit" disabled={!amount || !payer || !category} className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-stone-200 text-white font-bold rounded-xl shadow-xs transition">追加する</button>
          </form>
        )}

        {activeTabDaily === 'summary' && (
          <div className="space-y-4 text-xs">
            <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-xs space-y-3 text-center">
              <div>
                <p className="font-bold text-stone-400 mb-1">{year}年{month}月の総支出</p>
                <p className="text-2xl font-black text-stone-700">JPY {dailySummaryData.total.toLocaleString()}</p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-stone-100 text-left">
                <div className="flex justify-between"><span className="text-stone-500">AO 支払合計:</span><span className="font-bold text-rose-700">JPY {dailySummaryData.aoTotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">MASA 支払合計:</span><span className="font-bold text-sky-700">JPY {dailySummaryData.masaTotal.toLocaleString()}</span></div>
                <div className="pt-2 mt-1 border-t border-dashed border-sky-100 text-center font-black text-sky-800 text-sm bg-sky-50/50 py-2.5 rounded-xl border border-sky-100">
                  {dailySummaryData.settlementMsg}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-xs space-y-3">
              <h4 className="font-bold text-stone-600">カテゴリー別集計</h4>
              {dailySummaryData.categoryList.length === 0 ? (
                <p className="text-stone-400 text-center py-4">データがありません</p>
              ) : (
                <div className="space-y-2">
                  {dailySummaryData.categoryList.map(cat => (
                    <div key={cat.name} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/60 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-stone-700">{cat.name}</span>
                        <span className="text-xxs text-stone-400 ml-2">({cat.percentage}%)</span>
                      </div>
                      <span className="font-black text-stone-800">JPY {cat.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTabDaily === 'list' && (
          <div className="space-y-2 text-xs">
            {filteredDaily.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-stone-200/60 text-stone-400">明細がありません</div>
            ) : (
              filteredDaily.map(i => (
                <div key={i.id} className="p-3 border border-stone-200/60 rounded-xl flex justify-between items-center bg-white shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xxs font-bold px-2 py-0.5 rounded-md ${i.payer === 'AO' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-sky-50 text-sky-700 border border-sky-100'}`}>{i.payer}</span>
                      <span className="font-bold text-stone-700">{i.category}</span>
                    </div>
                    <p className="text-xxs text-stone-400 mt-0.5">{i.date} {i.memo && `• ${i.memo}`}</p>
                  </div>
                  <span className="font-bold text-stone-800">JPY {i.amount.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTabDaily === 'settings' && (
          <div className="space-y-5 text-xs">
            <div className="p-4 bg-white border border-stone-200/60 rounded-2xl shadow-xs space-y-3">
              <h4 className="font-bold text-stone-600 flex items-center gap-1.5"><Percent size={15} /> 費用負担比率設定 (スライダー)</h4>
              <p className="text-xxs text-stone-400">スライダーを動かしてAOとMASAの負担比率を調整します（自動保存されます）。</p>
              
              <div className="space-y-2 pt-2">
                <div className="flex justify-between font-bold text-stone-700">
                  <span className="text-rose-600">AO: {ratioAO}%</span>
                  <span className="text-sky-600">MASA: {100 - ratioAO}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={ratioAO} 
                  onChange={(e) => handleRatioChange(Number(e.target.value))} 
                  className="w-full accent-rose-500 cursor-pointer" 
                />
              </div>
            </div>

            <div className="p-4 bg-white border border-stone-200/60 rounded-2xl shadow-xs space-y-3">
              <h4 className="font-bold text-stone-600">日常カテゴリー管理</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="例: 食費、光熱費" 
                  value={newDailyCategory} 
                  onChange={(e) => setNewDailyCategory(e.target.value)} 
                  className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl" 
                />
                <button type="button" onClick={handleAddDailyCategory} className="px-4 bg-stone-700 hover:bg-stone-800 text-white font-bold rounded-xl">追加</button>
              </div>

              <div className="space-y-1.5 pt-1">
                {categories.length === 0 ? (
                  <p className="text-xs text-stone-400 py-2 text-center">登録されたカテゴリーがありません</p>
                ) : (
                  categories.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-2.5 bg-stone-50 rounded-xl border border-stone-200/60">
                      {editingDailyCategoryId === c.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <input 
                            type="text" 
                            value={editingDailyCategoryName} 
                            onChange={(e) => setEditingDailyCategoryName(e.target.value)} 
                            className="flex-1 p-1.5 bg-white border border-stone-300 rounded-lg" 
                          />
                          <button type="button" onClick={() => handleUpdateDailyCategory(c.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={14} /></button>
                          <button type="button" onClick={() => { setEditingDailyCategoryId(null); setEditingDailyCategoryName(''); }} className="p-1.5 bg-stone-200 text-stone-600 rounded-lg"><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-stone-700 font-medium">{c.name}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => { 
                                setEditingDailyCategoryId(c.id); 
                                setEditingDailyCategoryName(c.name); 
                              }} 
                              className="text-stone-400 hover:text-sky-600 p-1"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button type="button" onClick={() => handleDeleteDailyCategory(c.id, c.name)} className="text-stone-300 hover:text-rose-500 p-1"><Trash2 size={13} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}