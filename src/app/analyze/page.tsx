'use client';

import { useState, useRef } from 'react';
import type { AnalysisResult, FanoutResult } from '@/types';
import ScoreOverview from '@/components/ScoreOverview';
import TechnicalPanel from '@/components/TechnicalPanel';
import EntitiesPanel from '@/components/EntitiesPanel';
import EeatPanel from '@/components/EeatPanel';
import ContentDepthPanel from '@/components/ContentDepthPanel';
import KeywordsTable from '@/components/KeywordsTable';
import FanoutPanel from '@/components/FanoutPanel';

type Step = 'idle' | 'crawling' | 'nlp' | 'fanout' | 'done' | 'error';

export default function AnalyzePage() {
  const [url, setUrl] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [topic, setTopic] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fanout, setFanout] = useState<FanoutResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAnalysis(null);
    setFanout(null);
    setStep('crawling');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, hfToken: hfToken || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Błąd analizy');

      setAnalysis(data as AnalysisResult);
      setStep('fanout');

      const autoTopic = topic.trim() || data.technical.title.text.split(/\s+/).slice(0, 4).join(' ');
      if (!topic.trim()) setTopic(autoTopic);

      const fanoutRes = await fetch('/api/fanout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: autoTopic, analysis: data }),
      });

      if (fanoutRes.ok) {
        const fd = await fanoutRes.json();
        setFanout(fd as FanoutResult);
      }

      setStep('done');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setStep('error');
    }
  }

  async function handleFanoutRegen() {
    if (!topic.trim()) return;
    const res = await fetch('/api/fanout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, analysis }),
    });
    if (res.ok) setFanout(await res.json());
  }

  const isLoading = step === 'crawling' || step === 'fanout';

  const stepMsg: Record<Step, string> = {
    idle: '',
    crawling: 'Pobieram i analizuję stronę…',
    nlp: 'Wyodrębniam encje i tematy (HF)…',
    fanout: 'Generuję drzewo query fan-out…',
    done: '',
    error: '',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">SEO Fanout Analyzer</h1>
            <p className="text-xs text-slate-400">Analiza SEO + query fan-out + AI encje</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="card">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/strona-do-analizy"
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading} className="btn-primary whitespace-nowrap">
              {isLoading ? '⏳ Analizuję…' : '🔍 Analizuj'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="mt-2.5 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            {showAdvanced ? '▲' : '▼'} Ustawienia zaawansowane
          </button>

          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Hugging Face API Token{' '}
                  <span className="text-slate-400 font-normal">
                    (opcjonalny – poprawia limity i jakość NLP)
                  </span>
                </label>
                <input
                  type="password"
                  value={hfToken}
                  onChange={e => setHfToken(e.target.value)}
                  placeholder="hf_..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Temat / seed keyword dla fan-out{' '}
                  <span className="text-slate-400 font-normal">(domyślnie: tytuł strony)</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="np. narzędzia SEO"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </form>

        {/* Loading state */}
        {isLoading && (
          <div className="card text-center py-10">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <p className="text-slate-500 text-sm">{stepMsg[step]}</p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && error && (
          <div className="card border-red-200 bg-red-50">
            <p className="text-red-700 text-sm font-medium">❌ {error}</p>
            <p className="text-red-500 text-xs mt-1">
              Sprawdź, czy URL jest dostępny publicznie i czy strona zwraca HTML.
            </p>
          </div>
        )}

        {/* Results */}
        {analysis && (
          <div className="space-y-6" ref={resultsRef}>
            <ScoreOverview analysis={analysis} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TechnicalPanel technical={analysis.technical} />
              <EntitiesPanel entities={analysis.entities} topics={analysis.topics} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EeatPanel eeat={analysis.eeat} />
              <ContentDepthPanel contentDepth={analysis.contentDepth} pageExperience={analysis.pageExperience} />
            </div>

            <KeywordsTable keywords={analysis.keywords} />

            {/* Fan-out */}
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <h2 className="section-title mb-0 flex-1">
                  Query Fan-out
                  {fanout && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      dla: „{fanout.topic}"
                    </span>
                  )}
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Zmień temat…"
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                  />
                  <button onClick={handleFanoutRegen} className="btn-secondary">
                    Generuj
                  </button>
                </div>
              </div>
              {fanout ? (
                <FanoutPanel fanout={fanout} />
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">⏳ Generuję drzewo…</p>
              )}
            </div>

            {/* Export */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify({ analysis, fanout }, null, 2)],
                    { type: 'application/json' }
                  );
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `seo-report-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}
                className="btn-secondary"
              >
                ⬇ Eksportuj JSON
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {step === 'idle' && (
          <div className="card text-center py-12 text-slate-400">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-medium">Wpisz URL strony, żeby rozpocząć analizę SEO</p>
            <p className="text-sm mt-1">
              Analizuję meta tagi, nagłówki, słowa kluczowe, encje (AI), linki i query fan-out
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
