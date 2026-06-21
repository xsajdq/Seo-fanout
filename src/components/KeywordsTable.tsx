'use client';

import { useState } from 'react';
import type { Keyword } from '@/types';

function Tag({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-600 text-xs">✓</span>
    : <span className="text-slate-200 text-xs">–</span>;
}

function DensityBar({ value }: { value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  const color = value > 3.5 ? 'bg-red-400' : value > 1.5 ? 'bg-green-400' : 'bg-slate-300';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{value}%</span>
    </div>
  );
}

export default function KeywordsTable({ keywords }: { keywords: Keyword[] }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? keywords : keywords.slice(0, 12);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title mb-0">Słowa kluczowe</h2>
        <span className="text-xs text-slate-400">{keywords.length} fraz</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left pb-2 font-medium">Fraza</th>
              <th className="text-center pb-2 font-medium">Wystąpień</th>
              <th className="text-left pb-2 font-medium">Gęstość</th>
              <th className="text-center pb-2 font-medium">Tytuł</th>
              <th className="text-center pb-2 font-medium">H1</th>
              <th className="text-center pb-2 font-medium">Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((kw, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-1.5 font-medium text-slate-800">{kw.word}</td>
                <td className="py-1.5 text-center text-slate-500">{kw.count}</td>
                <td className="py-1.5"><DensityBar value={kw.density} /></td>
                <td className="py-1.5 text-center"><Tag ok={kw.inTitle} /></td>
                <td className="py-1.5 text-center"><Tag ok={kw.inH1} /></td>
                <td className="py-1.5 text-center"><Tag ok={kw.inMeta} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {keywords.length > 12 && (
        <button onClick={() => setShowAll(s => !s)} className="mt-2 text-xs text-blue-600 hover:underline">
          {showAll ? 'Pokaż mniej' : `Pokaż wszystkie (${keywords.length})`}
        </button>
      )}
    </div>
  );
}
