//import React from 'react';
//import { Trash2, Download } from 'lucide-react';
import type{ Expense } from './types';

// 集計画面
export function SummaryView({ data, year, month }: { data: any, year: number, month: number }) {
  return (
    <div className="space-y-5">
      <div className="bg-blue-600 rounded-2xl p-5 text-center shadow-sm">
        <p className="text-xs font-bold text-blue-100 mb-1">{year}年{month}月の総支出</p>
        <p className="text-3xl font-black text-white">￥{data.total.toLocaleString()}</p>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 text-sm">
        <div className="flex justify-between"><span>AO 支払額:</span><span className="font-bold">￥{data.ao.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>MASA 支払額:</span><span className="font-bold">￥{data.masa.toLocaleString()}</span></div>
        <div className="border-t border-dashed border-gray-300 pt-3 mt-2 text-center text-xs font-bold text-amber-800 bg-amber-100 rounded-xl py-2">{data.msg}</div>
      </div>
    </div>
  );
}

// 明細画面
export function ListView({ filtered, year, month }: { filtered: Expense[], year: number, month: number }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-500 mb-1">{year}年{month}月の明細 ({filtered.length}件)</h3>
      {filtered.length === 0 ? <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-400 text-sm">明細がありません</div> : (
        <div className="space-y-2.5">
          {filtered.map(i => (
            <div key={i.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <div className="flex items-center gap-2"><span className="text-xs font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{i.payer}</span><span className="text-sm font-bold text-gray-800">{i.category}</span></div>
                <p className="text-xs text-gray-500 mt-1">{i.date} {i.memo && `• ${i.memo}`}</p>
              </div>
              <span className="font-black text-gray-900">￥{i.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 設定画面
export function SettingsView({ onExport }: { onExport: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex justify-between items-center text-sm"><span>精算比率:</span><span className="text-blue-600 font-black">5 : 5 (折半)</span></div>
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700">データ出力</h4>
        <button type="button" onClick={onExport} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm"><Download size={18} /><span>明細をCSV出力する</span></button>
      </div>
    </div>
  );
}
