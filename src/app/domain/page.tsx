'use client';

import { useState, useRef, useEffect } from 'react';
import type { QuickAuditResult, DomainSummary } from '@/types';

function ScoreChip({ score }: { score: number }) {
  const cls =
    score >= 75 ? 'bg-green-100 text-green-700' :
    score >= 50 ? 'bg-yellow-100 text-yellow-700' :
    score >= 25 ? 'bg-orange-100 text-orange-700' :
    'bg-red-100 text-red-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{score}</span>;
}

function IssueBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = pct > 50 ? 'bg-red-400' : pct > 25 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-14 text-right flex-shrink-0">
        {count}/{total} ({pct}%)
      </span>
    </div>
  );
}

type SSEMessage =
  | { type: 'status'; message: string }
  | { type: 'urls_found'; count: number; source: string }
  | { type: 'page_done'; index: number; total: number; data: QuickAuditResult }
  | { type: 'page_error'; index: number; total: number; url: string; error: string }
  | { type: 'done'; summary: DomainSummary }
  | { type: 'error'; message: string };

export default function DomainPage() {
  const [domain, setDomain]   = useState('');
  const [maxPages, setMaxPages] = useState(30);
  const [running, setRunning] = useState(false);
  const [status, setStatus]   = useState('');
  const [progress, setProgress] = useState(0);
  const [pages, setPages]     = useState<QuickAuditResult[]>([]);
  const [errors, setErrors]   = useState<{ url: string; error: string }[]>([]);
  const [summary, setSummary] = useState<DomainSummary | null>(null);
  const [globalError, setGlobalError] = useState('');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => { esRef.current?.close(); }, []);

  function startAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;

    // Reset state
    setPages([]);
    setErrors([]);
    setSummary(null);
    setGlobalError('');
    setProgress(0);
    setStatus('');
    setRunning(true);

    const params = new URLSearchParams({ domain: domain.trim(), max: String(maxPages) });
    const es = new EventSource(`/api/domain-audit?${params}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as SSEMessage;

      if (msg.type === 'status') {
        setStatus(msg.message);
      } else if (msg.type === 'urls_found') {
        setStatus(`Znaleziono ${msg.count} URL-i (źródło: ${msg.source})`);
      } else if (msg.type === 'page_done') {
        setPages(p => [...p, msg.data]);
        setProgress(msg.index / msg.total);
        setStatus(`Analizuję stronę ${msg.index}/${msg.total}…`);
      } else if (msg.type === 'page_error') {
        setErrors(p => [...p, { url: msg.url, error: msg.error }]);
        setProgress(msg.index / msg.total);
      } else if (msg.type === 'done') {
        setSummary(msg.summary);
        setStatus('Audyt zakończony!');
        setProgress(1);
        setRunning(false);
        es.close();
      } else if (msg.type === 'error') {
        setGlobalError(msg.message);
        setRunning(false);
        es.close();
      }
    };

    es.onerror = () => {
      if (running) {
        setGlobalError('Połączenie SSE zerwane. Sprawdź konsolę serwera.');
        setRunning(false);
        es.close();
      }
    };
  }

  function stopAudit() {
    esRef.current?.close();
    setRunning(false);
    setStatus('Zatrzymano przez użytkownika');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/analyze" className="text-slate-400 hover:text-slate-600 text-sm">← Analiza strony</a>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">Audyt domeny</h1>
            <p className="text-xs text-slate-400">Crawl całej domeny przez sitemapę · live progress</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Form */}
        <form onSubmit={startAudit} className="card">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="example.com lub https://example.com"
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={running}
            />
            <div className="flex gap-2">
              {running ? (
                <button type="button" onClick={stopAudit} className="btn-secondary whitespace-nowrap">
                  ⏹ Stop
                </button>
              ) : (
                <button type="submit" className="btn-primary whitespace-nowrap">
                  🔍 Audytuj
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs text-slate-500 flex-shrink-0">Maks. stron:</label>
            <input
              type="range" min={5} max={100} step={5}
              value={maxPages}
              onChange={e => setMaxPages(Number(e.target.value))}
              className="flex-1"
              disabled={running}
            />
            <span className="text-sm font-medium text-slate-700 w-10 text-right">{maxPages}</span>
          </div>
        </form>

        {/* Progress */}
        {(running || status) && (
          <div className="card py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">{status}</p>
              <span className="text-xs text-slate-400">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {globalError && (
          <div className="card border-red-200 bg-red-50">
            <p className="text-red-700 text-sm font-medium">❌ {globalError}</p>
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="card">
            <h2 className="section-title">Podsumowanie audytu: {summary.domain}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Przeanalizowano', value: summary.analyzed, sub: `z ${summary.totalUrls} URL` },
                { label: 'Śr. wynik', value: summary.avgScore + '/100', sub: summary.avgScore >= 70 ? 'Dobry' : summary.avgScore >= 50 ? 'Przeciętny' : 'Wymaga pracy' },
                { label: 'Thin content', value: summary.thinContent, sub: `${Math.round(summary.thinContent / summary.analyzed * 100)}% stron` },
                { label: 'Brak schema', value: summary.noSchema, sub: `${Math.round(summary.noSchema / summary.analyzed * 100)}% stron` },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-slate-800">{item.value}</div>
                  <div className="text-xs font-medium text-slate-600 mt-0.5">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.sub}</div>
                </div>
              ))}
            </div>

            {/* Issue breakdown */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Główne problemy</p>
              <div className="space-y-2">
                <IssueBar label="Thin content (<300 słów)"   count={summary.thinContent} total={summary.analyzed} />
                <IssueBar label="Brak meta opisu"            count={summary.noMetaDesc}  total={summary.analyzed} />
                <IssueBar label="Brak H1"                    count={summary.noH1}        total={summary.analyzed} />
                <IssueBar label="Brak schema.org"            count={summary.noSchema}    total={summary.analyzed} />
                <IssueBar label="Wiele H1"                   count={summary.multiH1}     total={summary.analyzed} />
              </div>
            </div>

            {/* Sections */}
            {Object.keys(summary.sections).length > 1 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Sekcje domeny</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(summary.sections).map(([section, data]) => (
                    <div key={section} className="border border-slate-100 rounded-lg p-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700 truncate">/{section}</span>
                        <ScoreChip score={data.avgScore} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{data.count} stron</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Worst pages */}
            {summary.worstPages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Strony wymagające uwagi
                </p>
                <div className="space-y-2">
                  {summary.worstPages.slice(0, 7).map((p, i) => (
                    <div key={i} className="flex items-start gap-3 border border-slate-100 rounded-lg p-2.5">
                      <ScoreChip score={p.score} />
                      <div className="flex-1 min-w-0">
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-blue-600 hover:underline truncate block">{p.url}</a>
                        <p className="text-xs text-slate-400 mt-0.5">{p.issues.join(' · ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cannibalization */}
            {summary.cannibalization.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Kanibalizacja słów kluczowych ({summary.cannibalization.length} {summary.cannibalization.length === 1 ? 'para' : 'par'})
                </p>
                <div className="space-y-2">
                  {summary.cannibalization.slice(0, 10).map((pair, i) => (
                    <div key={i} className="border border-orange-100 bg-orange-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                          {pair.overlap}% zbieżności
                        </span>
                        {pair.sharedKeywords.map((kw, j) => (
                          <span key={j} className="text-xs bg-white text-slate-600 px-1.5 py-0.5 rounded border border-orange-200">
                            {kw}
                          </span>
                        ))}
                      </div>
                      <a href={pair.urlA} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-blue-600 hover:underline truncate block" title={pair.titleA}>
                        ↳ {pair.urlA}
                      </a>
                      <a href={pair.urlB} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-blue-600 hover:underline truncate block mt-0.5" title={pair.titleB}>
                        ↳ {pair.urlB}
                      </a>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  💡 Strony o wysokiej zbieżności fraz konkurują ze sobą w SERP. Rozważ scalenie treści lub przekierowanie słabszej strony na mocniejszą.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Live results table */}
        {pages.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">Wyniki stron ({pages.length})</h2>
              <button
                onClick={() => {
                  const csv = [
                    'URL,Wynik,Tytuł,H1,Słów,Meta,Schema,Problemy',
                    ...pages.map(p =>
                      [p.url, p.score, `"${p.title}"`, `"${p.h1 ?? ''}"`, p.wordCount,
                       p.hasMetaDesc ? 'tak' : 'nie', p.hasSchema ? 'tak' : 'nie',
                       `"${p.issues.join('; ')}"`].join(',')
                    ),
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `domain-audit-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                }}
                className="btn-secondary text-xs"
              >
                ⬇ CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Wynik</th>
                    <th className="text-left pb-2 font-medium">URL</th>
                    <th className="text-left pb-2 font-medium">Tytuł</th>
                    <th className="text-center pb-2 font-medium">Słów</th>
                    <th className="text-left pb-2 font-medium">Problemy</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pages].sort((a, b) => a.score - b.score).map((p, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1.5"><ScoreChip score={p.score} /></td>
                      <td className="py-1.5 max-w-[180px]">
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                           className="text-blue-600 hover:underline truncate block">{p.url}</a>
                      </td>
                      <td className="py-1.5 max-w-[180px] text-slate-700 truncate">{p.title || '—'}</td>
                      <td className="py-1.5 text-center text-slate-500">{p.wordCount}</td>
                      <td className="py-1.5 text-slate-400">
                        {p.issues.slice(0, 2).join(' · ')}
                        {p.issues.length > 2 && ` +${p.issues.length - 2}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!running && pages.length === 0 && !globalError && (
          <div className="card text-center py-12 text-slate-400">
            <div className="text-5xl mb-4">🌐</div>
            <p className="font-medium">Wpisz domenę, żeby rozpocząć audyt</p>
            <p className="text-sm mt-1">
              Aplikacja crawluje sitemapę, analizuje każdą stronę i generuje zbiorczy raport
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
