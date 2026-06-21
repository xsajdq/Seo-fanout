'use client';

import type { Entity, Topic } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  PER: 'bg-purple-100 text-purple-700',
  ORG: 'bg-blue-100 text-blue-700',
  LOC: 'bg-green-100 text-green-700',
  MISC: 'bg-slate-100 text-slate-600',
};

const TYPE_LABELS: Record<string, string> = {
  PER: 'Osoba',
  ORG: 'Organizacja',
  LOC: 'Miejsce',
  MISC: 'Inne',
};

function Bar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{value}%</span>
    </div>
  );
}

interface Props {
  entities: Entity[];
  topics: Topic[];
  hfError?: string;
}

export default function EntitiesPanel({ entities, topics, hfError }: Props) {
  return (
    <div className="card">
      <h2 className="section-title">Encje & Tematy (AI)</h2>

      {hfError && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded p-2 mb-3">{hfError}</p>
      )}

      {entities.length === 0 && topics.length === 0 && (
        <p className="text-sm text-slate-400">
          Brak wyników NLP. Dodaj token Hugging Face lub poczekaj na załadowanie modelu.
        </p>
      )}

      {entities.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Rozpoznane encje</p>
          <div className="flex flex-wrap gap-1.5">
            {entities.map((e, i) => (
              <span key={i} className={`badge ${TYPE_COLORS[e.type] ?? TYPE_COLORS.MISC}`} title={`${TYPE_LABELS[e.type] ?? e.type} · ${e.score}%`}>
                {e.text}
                <span className="ml-1 opacity-60 text-[10px]">{e.type}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(TYPE_LABELS).map(([type, label]) => {
              const count = entities.filter(e => e.type === type).length;
              if (count === 0) return null;
              return (
                <span key={type} className={`badge ${TYPE_COLORS[type]}`}>
                  {label}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {topics.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Klasyfikacja tematyczna</p>
          <div className="space-y-2">
            {topics.map((t, i) => (
              <div key={i}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-sm text-slate-700">{t.label}</span>
                </div>
                <Bar value={t.score} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
