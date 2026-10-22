import React, { useState, useMemo, useEffect } from 'react';
import { PlusCircle, BarChart3, List, Settings, ChevronLeft, ChevronRight, Download, Edit2, Trash2, Plus, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Expense { id: string; date: string; category: string; amount: number; payer: 'AO' | 'MASA'; memo: string; }

export default function App() {
  const [activeTab, setActiveTab] = useState<'input' | 'summary' | 'list' | 'settings'>('input');
  
  // 💡年月の初期値を「現在の年月（2026年8月）」に変更し、制限なく動かせるように修正
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(8);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [ratioAO, setRatioAO] = useState<number>(50);

  // 💡入力される日付の初期値も選択された年月に連動するように調整
  const [date, setDate] = useState('2026-08-22');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<'AO' | 'MASA' | null>(null);
  const [memo, setMemo] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // ページ切り替え時に、入力日付の年月の初期値を選択月に合わせる
  useEffect(() => {
    if (!editingId) {
      setDate(`${year}-${String(month).padStart(2, '0')}-01`);
    }
  }, [year, month, editingId]);

  const fetchData = async () => {
    try {
      const { data: expData } = await supabase.from('expenses').select('*').order('date', { ascending: false });
      if (expData) setExpenses(expData);
      const { data: catData } = await supabase.from('categories').select('name').order('id');
      if (catData) {
        const catNames = catData.map(c => c.name);
        setCategories(catNames);
        if (catNames.length > 0 && !category) setCategory(catNames[0]);
      }
      const { data: ratData } = await supabase.from('ratios').select('ratio_ao').eq('id', 'current').single();
      if (ratData) setRatioAO(ratData.ratio_ao);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, []);

  const ymStr = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month]);
  const filtered = useMemo(() => expenses.filter(i => i.date.startsWith(ymStr)), [expenses, ymStr]);
  const isSubmitDisabled = !amount || Number(amount) <= 0 || !payer || !category;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (isSubmitDisabled) return;
    const expenseData = { date, category, amount: Number(amount), payer: payer!, memo };
    try {
      if (editingId) {
        await supabase.from('expenses').update(expenseData).eq('id', editingId);
        setEditingId(null);
      } else {
        await supabase.from('expenses').insert([{ id: Date.now().toString(), ...expenseData }]);
      }
      setAmount(''); setMemo(''); fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('この明細を削除しますか？')) {
      await supabase.from('expenses').delete().eq('id', id);
      fetchData();
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim() || categories.includes(newCategory.trim())) return;
    await supabase.from('categories').insert([{ id: Date.now().toString(), name: newCategory.trim() }]);
    setNewCategory(''); fetchData();
  };

  const handleRatioChange = async (val: number) => {
    setRatioAO(val);
    await supabase.from('ratios').update({ ratio_ao: val }).eq('id', 'current');
  };

  const startEdit = (item: Expense) => {
    setEditingId(item.id); setDate(item.date); setCategory(item.category);
    setAmount(item.amount.toString()); setPayer(item.payer); setMemo(item.memo); setActiveTab('input');
  };

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, item) => sum + item.amount, 0);
    const ao = filtered.filter(i => i.payer === 'AO').reduce((s, i) => s + i.amount, 0);
    const m = filtered.filter(i => i.payer === 'MASA').reduce((s, i) => s + i.amount, 0);
    const aoTarget = total * (ratioAO / 100); const diff = ao - aoTarget;
    const msg = diff > 0 ? `MASA ➔ AO ￥${Math.round(diff).toLocaleString()} 支払う` : diff < 0 ? `AO ➔ MASA ￥${Math.round(Math.abs(diff)).toLocaleString()} 支払う` : 'ぴったり折半です！';
    return { total, ao, m, msg, ratioMasa: 100 - ratioAO };
  }, [filtered, ratioAO]);

  const handleExport = () => {
    if (expenses.length === 0) return alert('データなし');
    const b = new Uint8Array([0xEF, 0xBB, 0xBF]), h = 'ID,日付,カテゴリー,金額,支払者,メモ\n';
    const r = expenses.map(i => `"${i.id}","${i.date}","${i.category}",${i.amount},"${i.payer}","${i.memo}"`).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([b, h + r], { type: 'text/csv;' }));
    link.download = `生活費明細_${year}年${month}月.csv`; link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-start pt-4 px-4 font-sans text-slate-600">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[600px] overflow-hidden">
        
        {/* ヘッダー：月移動のバグを修正 */}
        <header className="pt-6 pb-4 border-b border-slate-100 text-center bg-sky-50/40">
          <h1 className="text-xl font-bold text-sky-800 tracking-wide">AO & MASA 会計</h1>
          <div className="flex justify-center items-center gap-6 mt-3">
            <button type="button" onClick={() => { if (month === 1) { setYear(year - 1); setMonth(12); } else { setMonth(month - 1); } }} className="p-1 text-sky-600 hover:text-sky-800 active:scale-90 transition">◀</button>
            <span className="text-base font-bold text-slate-500">{year}年{month}月</span>
            {/* 💡ここにあった10月以上の進行制限を撤廃し、未来の月へも無限に進めるように修正しました */}
            <button type="button" onClick={() => { if (month === 12) { setYear(year + 1); setMonth(1); } else { setMonth(month + 1); } }} className="p-1 text-sky-600 hover:text-sky-800 active:scale-90 transition">▶</button>
          </div>
        </header>

        <nav className="flex justify-around text-xs font-bold border-b border-slate-100 bg-slate-50">
          <button type="button" onClick={() => setActiveTab('input')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTab === 'input' ? 'text-sky-700 bg-sky-50/50' : 'text-slate-400'}`}><PlusCircle size={16} />入力</button>
          <button type="button" onClick={() => setActiveTab('summary')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTab === 'summary' ? 'text-sky-700 bg-sky-50/50' : 'text-slate-400'}`}><BarChart3 size={16} />集計</button>
          <button type="button" onClick={() => setActiveTab('list')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTab === 'list' ? 'text-sky-700 bg-sky-50/50' : 'text-slate-400'}`}><List size={16} />明細</button>
          <button type="button" onClick={() => setActiveTab('settings')} className={`w-full py-3 flex flex-col items-center gap-1 transition ${activeTab === 'settings' ? 'text-sky-700 bg-sky-50/50' : 'text-slate-400'}`}><Settings size={16} />設定</button>
        </nav>
        <div className="flex-1 p-6 bg-white">
          {/* 【1】入力・編集画面 */}
          {activeTab === 'input' && (
            <form onSubmit={handleSave} className="space-y-4">
              {editingId && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex justify-between items-center text-xs font-bold text-amber-800">
                  <span>📝 クラウド上の明細を【修正中】です</span>
                  <button type="button" onClick={() => { setEditingId(null); setAmount(''); setMemo(''); }} className="p-1 bg-amber-200 rounded hover:bg-amber-300"><X size={14} /></button>
                </div>
              )}
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-400">日付</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none" /></div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400">カテゴリー</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none">
                  {categories.length === 0 ? <option value="">読込中...</option> : categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-400">金額</label><div className="relative"><input type="text" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-3 text-right font-bold rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 pr-12 text-lg focus:outline-none" /><span className="absolute inset-y-0 right-4 flex items-center text-slate-400 font-bold">円</span></div></div>
              
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-400">支払った人</label><div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setPayer('AO')} className={`py-3 rounded-xl font-bold border transition-all text-sm ${payer === 'AO' ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-xs' : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:bg-slate-100/50'}`}>AO</button>
                <button type="button" onClick={() => setPayer('MASA')} className={`py-3 rounded-xl font-bold border transition-all text-sm ${payer === 'MASA' ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-xs' : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:bg-slate-100/50'}`}>MASA</button>
              </div></div>
              
              <div className="flex flex-col gap-1"><label className="text-xs font-bold text-slate-400">メモ</label><input type="text" placeholder="任意" value={memo} onChange={(e) => setMemo(e.target.value)} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 placeholder-slate-300 focus:outline-none" /></div>
              
              <button type="submit" disabled={isSubmitDisabled} className={`w-full mt-4 py-3.5 rounded-xl text-base font-bold tracking-wide transition-all ${isSubmitDisabled ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200/60' : 'bg-slate-700 text-white hover:bg-slate-800 active:scale-98 shadow-xs'}`}>
                {editingId ? '変更を保存する' : '追加する'}
              </button>
            </form>
          )}

          {/* 【2】集計画面 */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              <div className="bg-slate-50 rounded-2xl p-5 text-center border border-slate-100">
                <p className="text-xs font-bold text-slate-400 mb-1">{year}年{month}月の総支出</p>
                <p className="text-3xl font-black text-slate-700">￥{summary.total.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-4 space-y-3 text-sm">
                <div className="text-center font-bold text-xxs text-slate-400 bg-white border border-slate-100 py-1 rounded-md">基準比率 ➔ AO {ratioAO}% : MASA {summary.ratioMasa}%</div>
                <div className="flex justify-between items-center px-1"><span className="font-medium text-slate-400">AO 支払額:</span><span className="font-bold text-pink-600">￥{summary.ao.toLocaleString()}</span></div>
                <div className="flex justify-between items-center px-1"><span className="font-medium text-slate-400">MASA 支払額:</span><span className="font-bold text-sky-600">￥{summary.m.toLocaleString()}</span></div>
                <div className="border-t border-dashed border-slate-200 pt-3 mt-1 text-center text-xs font-bold text-amber-800 bg-amber-50/40 rounded-xl py-2 px-2 border border-amber-100/40">{summary.msg}</div>
              </div>
            </div>
          )}

          {/* 【3】明細画面 */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">{year}年{month}月の明細 ({filtered.length}件)</h3>
              {filtered.length === 0 ? <div className="text-center py-12 bg-slate-50/30 rounded-2xl border border-dashed border-slate-100 text-slate-400 text-sm">データがありません</div> : (
                <div className="space-y-2.5">
                  {filtered.map(i => (
                    <div key={i.id} className="bg-white border border-slate-100 rounded-xl p-4 flex justify-between items-center shadow-xs">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xxs font-bold border px-2 py-0.5 rounded-md ${i.payer === 'AO' ? 'bg-pink-50 text-pink-700 border-pink-100' : 'bg-sky-50 text-sky-700 border-sky-100'}`}>{i.payer}</span>
                          <span className="text-sm font-bold text-slate-600 truncate">{i.category}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 truncate">{i.date} {i.memo && `• ${i.memo}`}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-700 pr-1 text-sm">￥{i.amount.toLocaleString()}</span>
                        <button type="button" onClick={() => startEdit(i)} className="text-slate-300 hover:text-slate-600 p-1"><Edit2 size={14} /></button>
                        <button type="button" onClick={() => handleDelete(i.id)} className="text-slate-300 hover:text-rose-400 p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 【4】設定画面 */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div className="bg-slate-50/40 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <h4 className="text-sm font-bold text-slate-500">精算比率の同期設定</h4>
                <div className="flex justify-between text-xs font-bold text-slate-400"><span>AO: {ratioAO}%</span><span>MASA: {100 - ratioAO}%</span></div>
                <input type="range" min="0" max="100" step="5" value={ratioAO} onChange={(e) => handleRatioChange(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500" />
              </div>

              <div className="bg-slate-50/40 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <h4 className="text-sm font-bold text-slate-500">カテゴリーのクラウド追加</h4>
                <div className="flex gap-2">
                  <input type="text" placeholder="例: 交際費" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="flex-1 p-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 focus:outline-none" />
                  <button type="button" onClick={handleAddCategory} className="px-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"><Plus size={12} />追加</button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map(cat => <span key={cat} className="text-xxs bg-white text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md font-medium">{cat}</span>)}
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2 shadow-xs">
                <h4 className="text-sm font-bold text-slate-500">データ出力</h4>
                <button type="button" onClick={handleExport} className="w-full py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2 text-xs shadow-xs transition-all active:scale-98"><span>明細をCSV出力する</span></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



