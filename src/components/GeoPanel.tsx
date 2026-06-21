'use client';

import type { GeoData } from '@/types';

function Check({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="flex-shrink-0">{ok ? '✅' : '❌'}</span>
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

function AnswerLengthBadge({ words }: { words: number | null }) {
  if (words === null) return <span className="badge bg-slate-100 text-slate-400">brak akapitu</span>;
  if (words < 20)  return <span className="badge bg-red-100 text-red-600">za krótka ({words}słów)</span>;
  if (words <= 80) return <span className="badge bg-green-100 text-green-700">✓ idealna ({words}słów)</span>;
  if (words <= 150) return <span className="badge bg-yellow-100 text-yellow-700">dobra ({words}słów)</span>;
  return <span className="badge bg-orange-100 text-orange-700">za długa ({words}słów)</span>;
}

export default function GeoPanel({ geo }: { geo: GeoData }) {
  const covered = geo.qaWithDirectAnswer;
  const total   = geo.qaCount;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="section-title mb-0">GEO / AEO</h2>
          <p className="text-xs text-slate-400">Optymalizacja pod AI Overviews, Perplexity, ChatGPT</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
          geo.score >= 70 ? 'bg-green-100 text-green-700' :
          geo.score >= 40 ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-600'
        }`}>
          {geo.score}/100
        </span>
      </div>

      {/* Q&A coverage */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Format Q→A (Direct Answer)
          </p>
          <span className="text-xs text-slate-500">{covered}/{total} pytań ma bezpośrednią odpowiedź</span>
        </div>

        {total === 0 ? (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <p className="text-sm text-red-700 font-medium">❌ Brak pytań w nagłówkach H2/H3</p>
            <p className="text-xs text-red-500 mt-1">
              Zmień nagłówki na pytania (np. "Jak zoptymalizować...?") i dodaj bezpośrednią odpowiedź
              (40-80 słów) w pierwszym akapicie po nagłówku. To format, który AI cytuje najczęściej.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {geo.qaBlocks.map((qa, i) => (
              <div key={i} className="border border-slate-100 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 flex-1">{qa.question}</p>
                  <AnswerLengthBadge words={qa.answerWords} />
                </div>
                {qa.answerPreview && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{qa.answerPreview}</p>
                )}
                {!qa.hasDirectAnswer && qa.answerWords !== null && qa.answerWords > 100 && (
                  <p className="text-xs text-orange-600 mt-1">
                    💡 Skróć odpowiedź do 40-80 słów — AI odcina długie odpowiedzi
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Other GEO signals */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Sygnały cytowania AI</p>
        <Check
          ok={geo.hasSummary}
          label="TL;DR / Podsumowanie"
          note={!geo.hasSummary ? 'Dodaj sekcję „W skrócie" lub „Podsumowanie" — AI wyciąga ją jako odpowiedź' : undefined}
        />
        <Check
          ok={geo.hasStatistics}
          label={`Statystyki i dane (${geo.statisticsDensity}/1000 słów)`}
          note={!geo.hasStatistics ? 'Dodaj liczby, procenty, wyniki badań — AI preferuje cytaty z danymi' : undefined}
        />
        <Check
          ok={geo.hasDefinitions}
          label="Definicje kluczowych pojęć"
          note={!geo.hasDefinitions ? 'Zdefiniuj główne terminy (np. „X to rodzaj…") — AI używa definicji w featured snippets' : undefined}
        />
        <Check
          ok={geo.hasComparisonTable}
          label="Tabela porównawcza"
          note={!geo.hasComparisonTable ? 'Tabele porównawcze (A vs B) są najczęściej cytowanym formatem przez AI' : undefined}
        />
        <Check
          ok={geo.firstParaWords >= 30 && geo.firstParaWords <= 120}
          label={`Intro: ${geo.firstParaWords} słów (opt. 40-100)`}
          note={geo.firstParaWords > 120 ? 'Pierwszy akapit zbyt długi — AI może nie wyciągnąć jako direct answer' :
                geo.firstParaWords < 30 ? 'Pierwszy akapit zbyt krótki — rozwiń do 40-80 słów' : undefined}
        />
      </div>

      {/* Tips box */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <p className="text-xs font-semibold text-blue-700 mb-1">🤖 Jak pisać treści pod AI (2026):</p>
        <ul className="text-xs text-blue-700 space-y-0.5">
          <li>• Każdy H2/H3 = pytanie, pierwszy akapit = bezpośrednia odpowiedź (40-80 słów)</li>
          <li>• 1 statystyka co 150-200 słów zwiększa szansę cytowania o 25%</li>
          <li>• FAQPage + HowTo schema = +58% widoczności w AI Overviews</li>
          <li>• Aktualizuj treść regularnie — AI cytuje świeże treści 3.2× częściej</li>
        </ul>
      </div>
    </div>
  );
}
