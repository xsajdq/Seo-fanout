'use client';

import { useState, useRef, useEffect } from 'react';
import type { QuickAuditResult, DomainSummary, EntityGap, DomainTopicGap } from '@/types';

function ScoreChip({ score }: { score: number }) {
  const cls =
    score >= 75 ? 'bg-green-100 text-green-700' :
    score >= 50 ? 'bg-yellow-100 text-yellow-700' :
    score >= 25 ? 'bg-orange-100 text-orange-700' :
    'bg-red-100 text-red-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{score}</span>;
}

function CoverageChip({ score }: { score: number }) {
  const cls =
    score >= 60 ? 'bg-green-100 text-green-700' :
    score >= 30 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{score}%</span>;
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
  | { type: 'error'; message: string }
  | { type: 'gap_status'; message: string }
  | { type: 'gap_done'; url: string; entityGap: EntityGap }
  | { type: 'gap_complete' }
  | { type: 'topic_gap_status'; message: string }
  | { type: 'topic_gap_done'; gap: DomainTopicGap | null }
  | { type: 'audit_complete' };

export default function DomainPage() {
  const [domain, setDomain]         = useState('');
  const [maxPages, setMaxPages]     = useState(30);
  const [running, setRunning]       = useState(false);
  const [status, setStatus]         = useState('');
  const [progress, setProgress]     = useState(0);
  const [pages, setPages]           = useState<QuickAuditResult[]>([]);
  const [errors, setErrors]         = useState<{ url: string; error: string }[]>([]);
  const [summary, setSummary]       = useState<DomainSummary | null>(null);
  const [globalError, setGlobalError] = useState('');
  const [gaps, setGaps]             = useState<Record<string, EntityGap>>({});
  const [gapPhase, setGapPhase]     = useState(false);
  const [topicPhase, setTopicPhase] = useState(false);
  const [domainTopicGap, setDomainTopicGap] = useState<DomainTopicGap | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => { esRef.current?.close(); }, []);

  function startAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;

    setPages([]);
    setErrors([]);
    setSummary(null);
    setGlobalError('');
    setProgress(0);
    setStatus('');
    setGaps({});
    setGapPhase(false);
    setTopicPhase(false);
    setDomainTopicGap(null);
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
        setProgress(1);
        setGapPhase(true);
        setStatus('Podsumowanie gotowe — analizuję luki treści w artykułach…');
      } else if (msg.type === 'gap_status') {
        setStatus(msg.message);
      } else if (msg.type === 'gap_done') {
        setGaps(g => ({ ...g, [msg.url]: msg.entityGap }));
      } else if (msg.type === 'gap_complete') {
        setGapPhase(false);
        setTopicPhase(true);
        setStatus('Buduję mapę tematyczną całej domeny…');
      } else if (msg.type === 'topic_gap_status') {
        setStatus(msg.message);
      } else if (msg.type === 'topic_gap_done') {
        setDomainTopicGap(msg.gap);
      } else if (msg.type === 'audit_complete') {
        setStatus('Audyt zakończony!');
        setTopicPhase(false);
        setRunning(false);
        es.close();
      } else if (msg.type === 'error') {
        setGlobalError(msg.message);
        setRunning(false);
        setGapPhase(false);
        setTopicPhase(false);
        es.close();
      }
    };

    es.onerror = () => {
      setGlobalError('Połączenie SSE zerwane. Sprawdź konsolę serwera.');
      setRunning(false);
      setGapPhase(false);
      setTopicPhase(false);
      es.close();
    };
  }

  function stopAudit() {
    esRef.current?.close();
    setRunning(false);
    setGapPhase(false);
    setTopicPhase(false);
    setStatus('Zatrzymano przez użytkownika');
  }

  // Derived data for per-article knowledge gap section
  const gapEntries  = Object.entries(gaps);
  const gapsSorted  = gapEntries
    .map(([url, entityGap]) => ({ url, entityGap }))
    .filter(g => g.entityGap.wikiArticle)
    .sort((a, b) => a.entityGap.coverageScore - b.entityGap.coverageScore);

  const allMissing: Record<string, number> = {};
  for (const { entityGap } of gapsSorted) {
    for (const c of entityGap.missingConcepts) {
      allMissing[c.title] = (allMissing[c.title] ?? 0) + 1;
    }
  }
  const topMissing = Object.entries(allMissing)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .filter(([, n]) => n >= 2);

  // Current phase label for progress
  const phaseLabel = topicPhase ? 'Mapa tematyczna' : gapPhase ? 'Graf wiedzy' : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <a href="/analyze" className="text-slate-400 hover:text-slate-600 text-sm">← Analiza strony</a>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">Audyt domeny</h1>
            <p className="text-xs text-slate-400">Crawl · SEO · Graf wiedzy · Mapa tematyczna · live progress</p>
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

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <label className="text-xs text-slate-500 flex-shrink-0">Maks. stron:</label>
            <select
              value={maxPages}
              onChange={e => setMaxPages(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={running}
            >
              {[30, 50, 100, 200, 500].map(n => (
                <option key={n} value={n}>{n} stron</option>
              ))}
              <option value={9999}>Wszystkie (cała sitemap)</option>
            </select>
            {maxPages >= 200 && (
              <span className="text-xs text-amber-600">
                ⚠ Duże domeny mogą zajmować kilka–kilkanaście minut
              </span>
            )}
          </div>
        </form>

        {/* Progress */}
        {(running || status) && (
          <div className="card py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">{status}</p>
              <span className="text-xs text-slate-400">
                {phaseLabel
                  ? `${phaseLabel}: ${gapEntries.length} artykułów`
                  : `${Math.round(progress * 100)}%`}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  topicPhase ? 'bg-emerald-500' : gapPhase ? 'bg-violet-500' : 'bg-blue-500'
                }`}
                style={{ width: (gapPhase || topicPhase) ? '100%' : `${progress * 100}%` }}
              />
            </div>
            {gapPhase && <p className="text-xs text-violet-500 mt-1">Faza 2: luki w artykułach Wikipedia…</p>}
            {topicPhase && <p className="text-xs text-emerald-600 mt-1">Faza 3: mapa tematyczna domeny Wikipedia…</p>}
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

            {summary.cannibalization.length > 0 && (
              <div className="mt-4">
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
                          <span key={j} className="text-xs bg-white text-slate-600 px-1.5 py-0.5 rounded border border-orange-200">{kw}</span>
                        ))}
                      </div>
                      <a href={pair.urlA} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-blue-600 hover:underline truncate block" title={pair.titleA}>↳ {pair.urlA}</a>
                      <a href={pair.urlB} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-blue-600 hover:underline truncate block mt-0.5" title={pair.titleB}>↳ {pair.urlB}</a>
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

        {/* ── Domain Topic Map (Phase 3) ─────────────────────────────────────── */}
        {(domainTopicGap || topicPhase) && (
          <div className="card">
            {topicPhase && !domainTopicGap && (
              <p className="text-sm text-slate-400 text-center py-8 animate-pulse">
                Pobieranie mapy tematycznej z Wikipedii…
              </p>
            )}

            {domainTopicGap && (
              <>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="section-title mb-0">Mapa tematyczna domeny</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Główny temat wykryty:{' '}
                      <strong className="text-slate-700">{domainTopicGap.domainTopic}</strong>
                      {domainTopicGap.wikiArticle && (
                        <> · Wikipedia: &ldquo;{domainTopicGap.wikiArticle}&rdquo;
                          {domainTopicGap.wikiLang === 'en' && ' (EN)'}
                        </>
                      )}
                    </p>
                    {domainTopicGap.wikiSummary && (
                      <p className="text-xs text-slate-400 mt-1 max-w-xl italic">
                        {domainTopicGap.wikiSummary.slice(0, 180)}…
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className={`text-3xl font-bold ${
                      domainTopicGap.domainCoverageScore >= 40 ? 'text-green-600' :
                      domainTopicGap.domainCoverageScore >= 20 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{domainTopicGap.domainCoverageScore}%</div>
                    <div className="text-xs text-slate-400">pokrycia tematów</div>
                    <div className="text-xs text-slate-300 mt-0.5">{domainTopicGap.totalTopics} tematów Wikipedia</div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { n: domainTopicGap.missingArticles.length, label: 'brakujących artykułów', color: 'text-red-600', bg: 'bg-red-50' },
                    { n: domainTopicGap.thinArticles.length,    label: 'do rozbudowania',       color: 'text-amber-600', bg: 'bg-amber-50' },
                    { n: domainTopicGap.coveredTopics.length,   label: 'pokrytych tematów',     color: 'text-green-600', bg: 'bg-green-50' },
                  ].map((s, i) => (
                    <div key={i} className={`${s.bg} rounded-lg p-3 text-center`}>
                      <div className={`text-2xl font-bold ${s.color}`}>{s.n}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Missing articles – high priority (Wikipedia sections) */}
                {domainTopicGap.missingArticles.filter(a => a.priority === 'high').length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                      🔴 Brakujące artykuły – wysoki priorytet (sekcje Wikipedia)
                    </p>
                    <p className="text-xs text-slate-400 mb-2">
                      Wikipedia traktuje te tematy jako kluczowe podrozdziały dla „{domainTopicGap.domainTopic}". Żadna strona domeny ich nie porusza.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {domainTopicGap.missingArticles.filter(a => a.priority === 'high').map((a, i) => (
                        <a key={i} href={a.wikiUrl} target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors">
                          <span className="font-medium">{a.title}</span>
                          <span className="text-red-400 text-xs">→ napisz artykuł</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thin articles – mentioned but no dedicated page */}
                {domainTopicGap.thinArticles.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                      ⚠️ Wspomniane, ale bez dedykowanego artykułu
                    </p>
                    <p className="text-xs text-slate-400 mb-2">
                      Temat pojawia się w treści, ale żadna strona nie jest mu w całości poświęcona. Warto rozbudować lub napisać nowy wpis.
                    </p>
                    <div className="space-y-1.5">
                      {domainTopicGap.thinArticles.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs flex-wrap">
                          <a href={a.wikiUrl} target="_blank" rel="noopener noreferrer"
                             className="font-medium text-amber-700 hover:underline whitespace-nowrap">
                            {a.priority === 'high' ? '📄' : '📝'} {a.title}
                          </a>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400">wspomniane w:</span>
                          {a.mentionedIn.map((url, j) => (
                            <a key={j} href={url} target="_blank" rel="noopener noreferrer"
                               className="text-blue-500 hover:underline truncate max-w-[200px]">
                              {url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                            </a>
                          ))}
                          <span className="ml-auto text-amber-600 flex-shrink-0">→ rozbuduj</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing concepts – low priority */}
                {domainTopicGap.missingArticles.filter(a => a.priority === 'low').length > 0 && (
                  <details className="mb-4">
                    <summary className="text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 mb-2">
                      ⬜ Powiązane encje bez pokrycia ({domainTopicGap.missingArticles.filter(a => a.priority === 'low').length})
                    </summary>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {domainTopicGap.missingArticles.filter(a => a.priority === 'low').map((a, i) => (
                        <a key={i} href={a.wikiUrl} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors">
                          {a.title}
                        </a>
                      ))}
                    </div>
                  </details>
                )}

                {/* Covered topics */}
                {domainTopicGap.coveredTopics.length > 0 && (
                  <details>
                    <summary className="text-xs font-semibold text-green-700 cursor-pointer hover:text-green-800">
                      ✅ Pokryte tematy ({domainTopicGap.coveredTopics.length})
                    </summary>
                    <div className="mt-2 space-y-1">
                      {domainTopicGap.coveredTopics.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-green-700 min-w-[120px]">{t.title}</span>
                          <span className="text-slate-300">·</span>
                          {t.coveredBy.slice(0, 2).map((url, j) => (
                            <a key={j} href={url} target="_blank" rel="noopener noreferrer"
                               className="text-blue-500 hover:underline truncate max-w-[200px]">
                              {url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Per-article knowledge gaps (Phase 2) ──────────────────────────── */}
        {(gapsSorted.length > 0 || gapPhase) && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title mb-0">Luki treści w artykułach</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Graf wiedzy Wikipedia vs. treść każdego artykułu ·{' '}
                  {gapsSorted.length} przeanalizowanych
                  {gapPhase && <span className="text-violet-500"> (analizuję…)</span>}
                </p>
              </div>
            </div>

            {/* Aggregate: concepts missing across many pages */}
            {topMissing.length > 0 && (
              <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-xs font-semibold text-red-700 mb-2">
                  🔴 Encje brakujące w wielu artykułach naraz:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topMissing.map(([concept, count]) => (
                    <span key={concept} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      {concept} <span className="opacity-70">({count}×)</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-red-600 mt-2 opacity-75">
                  Dodanie tych tematów do artykułów może znacząco poprawić pokrycie grafu wiedzy domeny.
                </p>
              </div>
            )}

            {/* Per-page expandable cards */}
            <div className="space-y-2">
              {gapsSorted.map(({ url, entityGap }, i) => (
                <details key={i} className="border border-slate-100 rounded-lg overflow-hidden group">
                  <summary className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 select-none list-none">
                    <CoverageChip score={entityGap.coverageScore} />
                    <div className="flex-1 min-w-0">
                      <a href={url} target="_blank" rel="noopener noreferrer"
                         className="text-xs text-blue-600 hover:underline truncate block"
                         onClick={e => e.stopPropagation()}>
                        {url}
                      </a>
                      {entityGap.wikiArticle && (
                        <p className="text-xs text-slate-400 truncate">
                          Wikipedia: {entityGap.wikiArticle}
                          {entityGap.wikiLang === 'en' && ' (EN)'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                      {entityGap.missingSections.length > 0 && (
                        <span className="text-red-500">{entityGap.missingSections.length} sekcji brakuje</span>
                      )}
                      {entityGap.missingConcepts.length > 0 && (
                        <span className="text-slate-400">{entityGap.missingConcepts.length} encji brakuje</span>
                      )}
                      <span className="text-slate-300 group-open:rotate-180 transition-transform">▼</span>
                    </div>
                  </summary>

                  <div className="px-3 pb-3 pt-2 border-t border-slate-50 space-y-3">
                    {entityGap.missingSections.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 mb-1.5">❌ Brakujące sekcje (vs. Wikipedia):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {entityGap.missingSections.map((s, j) => (
                            <span key={j} className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entityGap.coveredSections.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-700 mb-1.5">✅ Pokryte sekcje:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {entityGap.coveredSections.map((s, j) => (
                            <span key={j} className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {entityGap.missingConcepts.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1.5">
                          Brakujące encje ({entityGap.missingConcepts.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {entityGap.missingConcepts.slice(0, 25).map((c, j) => (
                            <a key={j} href={c.url} target="_blank" rel="noopener noreferrer"
                               className="text-xs bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700 px-1.5 py-0.5 rounded transition-colors">
                              {c.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {entityGap.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entityGap.categories.map((cat, j) => (
                          <span key={j} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{cat}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>

            {gapsSorted.length === 0 && gapPhase && (
              <p className="text-sm text-slate-400 text-center py-6 animate-pulse">Pobieranie danych z Wikipedii…</p>
            )}
          </div>
        )}

        {/* ── Live results table ─────────────────────────────────────────────── */}
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
                    <th className="text-left pb-2 font-medium">Wynik SEO</th>
                    <th className="text-left pb-2 font-medium">Graf wiedzy</th>
                    <th className="text-left pb-2 font-medium">URL</th>
                    <th className="text-left pb-2 font-medium">Tytuł</th>
                    <th className="text-center pb-2 font-medium">Słów</th>
                    <th className="text-left pb-2 font-medium">Problemy</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pages].sort((a, b) => a.score - b.score).map((p, i) => {
                    const gap = gaps[p.url];
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-1.5"><ScoreChip score={p.score} /></td>
                        <td className="py-1.5">
                          {gap ? (
                            <CoverageChip score={gap.coverageScore} />
                          ) : (gapPhase || topicPhase) ? (
                            <span className="text-xs text-slate-300">…</span>
                          ) : null}
                        </td>
                        <td className="py-1.5 max-w-[160px]">
                          <a href={p.url} target="_blank" rel="noopener noreferrer"
                             className="text-blue-600 hover:underline truncate block">{p.url}</a>
                        </td>
                        <td className="py-1.5 max-w-[160px] text-slate-700 truncate">{p.title || '—'}</td>
                        <td className="py-1.5 text-center text-slate-500">{p.wordCount}</td>
                        <td className="py-1.5 text-slate-400">
                          {p.issues.slice(0, 2).join(' · ')}
                          {p.issues.length > 2 && ` +${p.issues.length - 2}`}
                        </td>
                      </tr>
                    );
                  })}
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
              Crawl sitemapy · SEO · Luki artykułów · Mapa tematyczna domeny · Kanibalizacja
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
