import React, { useState } from 'react';
import { Wallet, Plane } from 'lucide-react';
import DailyApp from './components/DailyApp';
import TripApp from './components/TripApp';

export default function App() {
  const [appMode, setAppMode] = useState<'daily' | 'trip'>('daily');

  return (
    <div className="min-h-screen bg-stone-100 flex justify-center items-start pt-4 px-4 font-sans text-stone-700">
      <div className="w-full max-w-md bg-stone-50 rounded-3xl shadow-xl border border-stone-200/60 flex flex-col min-h-[720px] overflow-hidden mb-8">
        
        {/* === モード切替ヘッダー === */}
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

        {/* === 各モードの表示 === */}
        {appMode === 'daily' ? <DailyApp /> : <TripApp />}

      </div>
    </div>
  );
}