'use client';

import { useState } from 'react';
import type { FanoutNode, FanoutResult } from '@/types';

function coverageColor(score: number) {
  if (score >= 65) return { bg: 'bg-green-500', text: 'text-green-700', label: 'Pokryte' };
  if (score >= 30) return { bg: 'bg-yellow-400', text: 'text-yellow-700', label: 'Częściowe' };
  return { bg: 'bg-red-400', text: 'text-red-600', label: 'Brak' };
}

function MiniBar({ score }: { score: number }) {
  const { bg } = coverageColor(score);
  return (
    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function QueryRow({ node }: { node: FanoutNode }) {
  const { text } = coverageColor(node.coverageScore);
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-1">
      <MiniBar score={node.coverageScore} />
      <span className={`text-xs font-semibold w-6 text-right flex-shrink-0 ${text}`}>
        {node.coverageScore}
      </span>
      <span className="text-sm text-slate-700 flex-1">{node.query}</span>
      {node.matchedIn.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {node.matchedIn.slice(0, 3).map((m, i) => (
            <span key={i} className="badge bg-slate-100 text-slate-500">{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function IntentGroup({ node }: { node: FanoutNode }) {
  const [open, setOpen] = useState(true);
  const { bg, text } = coverageColor(node.coverageScore);

  return (
    <div className="mb-3 border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{node.query}</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${bg}`} style={{ width: `${node.coverageScore}%` }} />
          </div>
          <span className={`text-xs font-bold w-8 ${text}`}>{node.coverageScore}%</span>
        </div>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && node.children && (
        <div className="px-3 py-1">
          {node.children.map(child => <QueryRow key={child.id} node={child} />)}
        </div>
      )}
    </div>
  );
}

export default function FanoutPanel({ fanout }: { fanout: FanoutResult }) {
  const { text, bg } = coverageColor(fanout.coverageOverall);
  const total = fanout.tree.flatMap(n => n.children ?? []).length;
  const covered = fanout.tree.flatMap(n => n.children ?? []).filter(n => n.coverageScore >= 65).length;
  const partial = fanout.tree.flatMap(n => n.children ?? []).filter(n => n.coverageScore >= 30 && n.coverageScore < 65).length;

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
        <div className="text-center">
          <div className={`text-3xl font-bold ${text}`}>{fanout.coverageOverall}%</div>
          <div className="text-xs text-slate-500">Pokrycie ogólne</div>
        </div>
        <div className="flex-1">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${bg}`} style={{ width: `${fanout.coverageOverall}%` }} />
          </div>
          <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
            <span className="text-green-600 font-medium">✅ Pokryte: {covered}</span>
            <span className="text-yellow-600 font-medium">⚠️ Częściowe: {partial}</span>
            <span className="text-red-500 font-medium">❌ Brak: {total - covered - partial}</span>
          </div>
        </div>
      </div>

      {/* Tree */}
      {fanout.tree.map(group => (
        <IntentGroup key={group.id} node={group} />
      ))}

      <p className="text-xs text-slate-400 mt-2">
        * Pokrycie obliczane na podstawie obecności fraz z zapytania w tytule, nagłówkach, meta i treści strony.
      </p>
    </div>
  );
}
