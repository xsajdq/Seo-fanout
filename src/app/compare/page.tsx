'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/types';

const LABELS = ['Twoja strona', 'Konkurent 1', 'Konkurent 2', 'Konkurent 3'];

type State = { result: AnalysisResult | null; loading: boolean; error: string };

type MetricDef = {
  label: string;
  getValue: (r: AnalysisResult) => number | boolean;
  type: 'score' | 'count' | 'bool';
};

const METRICS: MetricDef[] = [
  { label: 'Wynik ogólny',      getValue: r => r.scores.overall,                             type: 'score' },
  { label: 'Techniczny',        getValue: r => r.scores.technical,                            type: 'score' },
  { label: 'E-E-A-T',           getValue: r => r.scores.eeat,                                 type: 'score' },
  { label: 'GEO / AEO',         getValue: r => r.scores.geo,                                  type: 'score' },
  { label: 'Głębokość treści',  getValue: r => r.scores.contentDepth,                         type: 'score' },
  { label: 'Page Experience',   getValue: r => r.scores.pageExperience,                       type: 'score' },
  { label: 'Treść',             getValue: r => r.scores.content,                              type: 'score' },
  { label: 'Liczba słów',       getValue: r => r.technical.wordCount,                         type: 'count' },
  { label: 'Schema.org',        getValue: r => r.technical.schema.length,                     type: 'count' },
  { label: 'Linki wewnętrzne',  getValue: r => r.technical.internalLinks.length,              type: 'count' },
  { label: 'H1 (prawidłowy)',   getValue: r => r.technical.h1.length === 1,                   type: 'bool'  },
  { label: 'Meta opis',         getValue: r => r.technical.metaDescription.text.length > 0,   type: 'bool'  },
  { label: 'HTTPS',             getValue: r => r.technical.hasHttps,                          type: 'bool'  },
  { label: 'Canonical',         getValue: r => !!r.technical.canonical,                       type: 'bool'  },
];

function cellStyle(value: number | boolean, allValues: (number | boolean)[], type: MetricDef['type']): string {
  if (type === 'bool') {
    return value ? 'text-green-700 font-semibold' : 'text-red-600';
  }
  const nums = allValues.filter((v): v is number => typeof v === 'number');
  if (nums.length < 2 || Math.max(...nums) === Math.min(...nums)) return 'text-slate-700';
  const v = value as number;
  if (v === Math.max(...nums)) return 'bg-green-50 text-green-800 font-bold rounded';
  if (v === Math.min(...nums)) return 'bg-red-50 text-red-700 rounded';
  return 'bg-yellow-50 text-yellow-700 rounded';
}

function hostname(url: string) {
  try { return new URL(url).hostname; } catch { return url; }
}

export default function ComparePage() {
  const [urls, setUrls] = useState(['', '']);
  const [states, setStates] = useState<State[]>([
    { result: null, loading: false, error: '' },
    { result: null, loading: false, error: '' },
  ]);
  const [ran, setRan] = useState(false);

  function updateUrl(i: number, val: string) {
    setUrls(u => u.map((v, idx) => idx === i ? val : v));
  }

  function addUrl() {
    if (urls.length >= 4) return;
    setUrls(u => [...u, '']);
    setStates(s => [...s, { result: null, loading: false, error: '' }]);
  }

  function removeUrl(i: number) {
    if (urls.length <= 2) return;
    setUrls(u => u.filter((_, idx) => idx !== i));
    setStates(s => s.filter((_, idx) => idx !== i));
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRan(true);
    setStates(urls.map(() => ({ result: null, loading: true, error: '' })));

    await Promise.all(
      urls.map(async (url, i) => {
        if (!url.trim()) {
          setStates(s => s.map((v, idx) => idx === i ? { ...v, loading: false } : v));
          return;
        }
        try {
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url.trim() }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'Błąd');
          setStates(s => s.map((v, idx) => idx === i
            ? { result: data as AnalysisResult, loading: false, error: '' } : v));
        } catch (err) {
          setStates(s => s.map((v, idx) => idx === i
            ? { result: null, loading: false, error: err instanceof Error ? err.message : 'Błąd analizy' } : v));
        }
      })
    );
  }

  const activeStates = states.filter(s => s.result || s.loading || s.error);
  const anyLoaded = states.some(s => s.result !== null);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <h1 className="text-base font-bold text-slate-900 leading-none">Porównanie z konkurencją</h1>
          <p className="text-xs text-slate-400">Side-by-side analiza SEO do 4 stron jednocześnie</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Form */}
        <form onSubmit={run} className="card space-y-3">
          {urls.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`text-xs font-semibold w-28 flex-shrink-0 ${i === 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                {LABELS[i]}
              </span>
              <input
                type="text"
                value={url}
                onChange={e => updateUrl(i, e.target.value)}
                placeholder={i === 0 ? 'https://twoja-strona.pl/...' : `https://konkurent${i}.pl/...`}
                required={i === 0}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {i >= 2 && (
                <button
                  type="button"
                  onClick={() => removeUrl(i)}
                  className="text-slate-400 hover:text-red-500 text-xl leading-none px-1 flex-shrink-0"
                >×</button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-4 pt-1 border-t border-slate-100">
            {urls.length < 4 && (
              <button type="button" onClick={addUrl} className="text-xs text-blue-600 hover:underline">
                + Dodaj kolejnego konkurenta
              </button>
            )}
            <div className="flex-1" />
            <button
              type="submit"
              disabled={states.some(s => s.loading)}
              className="btn-primary"
            >
              {states.some(s => s.loading) ? '⏳ Analizuję…' : '⚖️ Porównaj'}
            </button>
          </div>
        </form>

        {/* Status chips */}
        {ran && (
          <div className="flex gap-2 flex-wrap">
            {activeStates.map((s, i) => (
              <div key={i} className={`text-xs px-3 py-1.5 rounded-full ${
                s.loading   ? 'bg-blue-100 text-blue-700' :
                s.error     ? 'bg-red-100 text-red-700'   :
                s.result    ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-400'
              }`}>
                {LABELS[i]}: {s.loading ? '⏳ pobieram…' : s.error ? `❌ ${s.error.slice(0, 40)}` : s.result ? `✓ ${hostname(s.result.finalUrl)}` : '–'}
              </div>
            ))}
          </div>
        )}

        {/* Comparison table */}
        {anyLoaded && (
          <div className="card overflow-x-auto">
            <h2 className="section-title mb-4">Porównanie wskaźników</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 pr-6 font-medium text-slate-500 text-xs uppercase tracking-wide w-40">
                    Metryka
                  </th>
                  {states.map((s, i) => s.result && (
                    <th key={i} className={`text-center py-2 px-4 font-medium ${i === 0 ? 'text-blue-700' : 'text-slate-600'}`}>
                      <div className="text-sm">{LABELS[i]}</div>
                      <div className="text-xs font-normal text-slate-400 truncate max-w-[130px]" title={s.result.finalUrl}>
                        {hostname(s.result.finalUrl)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric, mi) => {
                  const vals = states.map(s => s.result ? metric.getValue(s.result) : null);
                  const present = vals.filter((v): v is number | boolean => v !== null);
                  return (
                    <tr key={mi} className={`border-b border-slate-50 ${mi % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                      <td className="py-2 pr-6 text-xs text-slate-600 font-medium">{metric.label}</td>
                      {states.map((s, i) => {
                        if (!s.result) return null;
                        const val = metric.getValue(s.result);
                        const cls = cellStyle(val, present, metric.type);
                        return (
                          <td key={i} className={`py-2 px-4 text-center text-sm ${cls}`}>
                            {metric.type === 'bool'
                              ? (val ? '✓' : '✗')
                              : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-3">
              🟢 Najlepsza wartość · 🟡 Pośrednia · 🔴 Najgorsza
            </p>
          </div>
        )}

        {/* Per-site schema gaps */}
        {anyLoaded && (
          <div className={`grid grid-cols-1 ${states.filter(s => s.result).length >= 2 ? 'md:grid-cols-2' : ''} gap-4`}>
            {states.map((s, i) => !s.result ? null : (
              <div key={i} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {LABELS[i]}
                  </span>
                  <a href={s.result.finalUrl} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-slate-400 hover:underline truncate">
                    {hostname(s.result.finalUrl)}
                  </a>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(['overall', 'eeat', 'geo', 'technical'] as const).map(key => {
                    const val = key === 'overall' ? s.result!.scores.overall :
                                key === 'eeat'    ? s.result!.scores.eeat    :
                                key === 'geo'     ? s.result!.scores.geo     :
                                                    s.result!.scores.technical;
                    const labels: Record<string, string> = { overall: 'Ogólny', eeat: 'E-E-A-T', geo: 'GEO', technical: 'Tech.' };
                    return (
                      <div key={key} className="bg-slate-50 rounded p-2 text-center">
                        <div className={`text-xl font-bold ${val >= 70 ? 'text-green-700' : val >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {val}
                        </div>
                        <div className="text-xs text-slate-500">{labels[key]}</div>
                      </div>
                    );
                  })}
                </div>

                {s.result.eeat.schemaGaps.suggestions.length > 0 && (
                  <div className="p-2 bg-amber-50 border border-amber-100 rounded">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Braki schema.org:</p>
                    {s.result.eeat.schemaGaps.suggestions.map((sg, j) => (
                      <p key={j} className="text-xs text-amber-600">• {sg}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!ran && (
          <div className="card text-center py-12 text-slate-400">
            <div className="text-5xl mb-4">⚖️</div>
            <p className="font-medium">Wpisz URL swojej strony i konkurentów</p>
            <p className="text-sm mt-1">Porównanie do 4 stron: wyniki, E-E-A-T, GEO, schema — wszystko w jednej tabeli</p>
          </div>
        )}
      </main>
    </div>
  );
}
