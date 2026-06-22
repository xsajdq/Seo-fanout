'use client';

import type { EntityGap, WikiConcept } from '@/types';

// ── SVG Knowledge Graph ───────────────────────────────────────────────────────

function KnowledgeGraphSVG({ covered, missing, topic }: {
  covered: WikiConcept[];
  missing: WikiConcept[];
  topic: string;
}) {
  const W = 560;
  const H = 380;
  const cx = W / 2;
  const cy = H / 2;

  // Show at most 18 of each to keep the graph readable
  const cov = covered.slice(0, 18);
  const mis = missing.slice(0, 18);

  const innerR = 115;
  const outerR = 178;

  function polar(r: number, i: number, n: number, offsetAngle = 0) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2 + offsetAngle;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  function labelPos(pos: { x: number; y: number }, above: boolean, r: number) {
    const offset = above ? -10 : 13;
    return { x: pos.x, y: pos.y + offset };
  }

  function shortTitle(t: string) {
    return t.length > 13 ? t.slice(0, 12) + '…' : t;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-xl mx-auto"
      aria-label={`Graf wiedzy: ${topic}`}
    >
      {/* Rings (decorative) */}
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#fce7f3" strokeWidth="1" strokeDasharray="4 4" />

      {/* Lines to covered */}
      {cov.map((_, i) => {
        const p = polar(innerR, i, cov.length || 1);
        return (
          <line key={`cl-${i}`}
            x1={cx} y1={cy} x2={p.x} y2={p.y}
            stroke="#86efac" strokeWidth="1.2" opacity="0.6"
          />
        );
      })}

      {/* Lines to missing */}
      {mis.map((_, i) => {
        const p = polar(outerR, i, mis.length || 1, Math.PI / (mis.length || 1));
        return (
          <line key={`ml-${i}`}
            x1={cx} y1={cy} x2={p.x} y2={p.y}
            stroke="#fca5a5" strokeWidth="1" opacity="0.45" strokeDasharray="3 3"
          />
        );
      })}

      {/* Covered concept nodes */}
      {cov.map((c, i) => {
        const p = polar(innerR, i, cov.length || 1);
        const above = p.y < cy;
        const lp = labelPos(p, above, innerR);
        return (
          <g key={`cn-${i}`}>
            <circle cx={p.x} cy={p.y} r="5" fill="#22c55e" />
            <text
              x={lp.x} y={lp.y}
              textAnchor="middle" fontSize="7.5" fill="#15803d"
              fontFamily="system-ui, sans-serif"
            >
              {shortTitle(c.title)}
            </text>
          </g>
        );
      })}

      {/* Missing concept nodes */}
      {mis.map((c, i) => {
        const p = polar(outerR, i, mis.length || 1, Math.PI / (mis.length || 1));
        const above = p.y < cy;
        const lp = labelPos(p, above, outerR);
        return (
          <g key={`mn-${i}`}>
            <circle cx={p.x} cy={p.y} r="5" fill="#ef4444" />
            <text
              x={lp.x} y={lp.y}
              textAnchor="middle" fontSize="7.5" fill="#991b1b"
              fontFamily="system-ui, sans-serif"
            >
              {shortTitle(c.title)}
            </text>
          </g>
        );
      })}

      {/* Center node */}
      <circle cx={cx} cy={cy} r="34" fill="#3b82f6" filter="drop-shadow(0 2px 4px rgba(59,130,246,0.4))" />
      <text
        x={cx} y={cy - 5}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="9.5" fill="white" fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        {topic.length > 14 ? topic.slice(0, 13) + '…' : topic}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#bfdbfe" fontFamily="system-ui, sans-serif">
        temat
      </text>

      {/* Legend */}
      <g transform={`translate(12, ${H - 40})`}>
        <circle cx="6" cy="6" r="4" fill="#22c55e" />
        <text x="14" y="10" fontSize="8" fill="#15803d" fontFamily="system-ui, sans-serif">Pokryte</text>
        <circle cx="60" cy="6" r="4" fill="#ef4444" />
        <text x="68" y="10" fontSize="8" fill="#991b1b" fontFamily="system-ui, sans-serif">Brakuje</text>
      </g>
    </svg>
  );
}

// ── Section gap table ─────────────────────────────────────────────────────────

function SectionRow({ title, covered }: { title: string; covered: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
      covered ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
    }`}>
      <span className="text-base flex-shrink-0">{covered ? '✅' : '❌'}</span>
      <span className={`text-sm flex-1 ${covered ? 'text-green-800' : 'text-red-800 font-medium'}`}>
        {title}
      </span>
      {!covered && (
        <span className="text-xs text-red-500 flex-shrink-0">brakuje sekcji</span>
      )}
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function CoverageBar({ score, covered, total }: { score: number; covered: number; total: number }) {
  const color = score >= 60 ? 'bg-green-500' : score >= 35 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-500">Pokrycie grafu wiedzy</span>
        <span className={`text-xs font-bold ${score >= 60 ? 'text-green-700' : score >= 35 ? 'text-yellow-600' : 'text-red-600'}`}>
          {covered}/{total} ({score}%)
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function KnowledgeGapPanel({ gap }: { gap: EntityGap | null }) {
  if (!gap || !gap.wikiArticle) {
    return (
      <div className="card">
        <h2 className="section-title">Graf wiedzy / Luki treści</h2>
        <p className="text-sm text-slate-400 text-center py-6">
          Nie znaleziono artykułu Wikipedii dla tego tematu.
        </p>
      </div>
    );
  }

  const wikiBase = `https://${gap.wikiLang}.wikipedia.org/wiki/${encodeURIComponent(gap.wikiArticle.replace(/ /g, '_'))}`;

  return (
    <div className="card space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="section-title mb-0">Graf wiedzy / Luki treści</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Porównanie z Wikipedią:{' '}
            <a href={wikiBase} target="_blank" rel="noopener noreferrer"
               className="text-blue-500 hover:underline">
              {gap.wikiArticle}
            </a>
            {gap.wikiLang === 'en' && (
              <span className="ml-1 text-slate-400">(EN – brak artykułu PL)</span>
            )}
          </p>
          {gap.wikiSummary && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{gap.wikiSummary}</p>
          )}
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-lg flex-shrink-0 ${
          gap.coverageScore >= 60 ? 'bg-green-100 text-green-700' :
          gap.coverageScore >= 35 ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-600'
        }`}>
          {gap.coverageScore}%
        </span>
      </div>

      {/* Coverage bar */}
      <CoverageBar
        score={gap.coverageScore}
        covered={gap.coveredConcepts.length}
        total={gap.totalConcepts}
      />

      {/* Categories */}
      {gap.categories.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Kategorie tematyczne</p>
          <div className="flex flex-wrap gap-1.5">
            {gap.categories.map((cat, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Graph SVG */}
      {(gap.coveredConcepts.length > 0 || gap.missingConcepts.length > 0) && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Wizualizacja grafu wiedzy
          </p>
          <div className="bg-slate-50 rounded-xl p-3">
            <KnowledgeGraphSVG
              covered={gap.coveredConcepts}
              missing={gap.missingConcepts}
              topic={gap.topic}
            />
          </div>
        </div>
      )}

      {/* Section gap */}
      {gap.allSections.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Sekcje Wikipedia vs. twoja strona
          </p>
          <div className="space-y-1.5">
            {gap.allSections.map((section, i) => (
              <SectionRow
                key={i}
                title={section}
                covered={gap.coveredSections.includes(section)}
              />
            ))}
          </div>
          {gap.missingSections.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                💡 Brakujące sekcje do dodania ({gap.missingSections.length}):
              </p>
              <p className="text-xs text-amber-700">
                {gap.missingSections.join(' · ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Missing concepts list */}
      {gap.missingConcepts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Brakujące encje ({gap.missingConcepts.length} z {gap.totalConcepts} powiązanych tematów)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {gap.missingConcepts.slice(0, 30).map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 px-2 py-0.5 rounded-full transition-colors"
                title={`Wikipedia: ${c.title}`}
              >
                {c.title}
              </a>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Kliknij encję aby zobaczyć artykuł Wikipedia — każda to potencjalny temat do uwzględnienia w treści.
          </p>
        </div>
      )}

      {/* Covered concepts */}
      {gap.coveredConcepts.length > 0 && (
        <details className="group">
          <summary className="text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-600">
            ✓ Pokryte encje ({gap.coveredConcepts.length}) — kliknij aby rozwinąć
          </summary>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {gap.coveredConcepts.map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 px-2 py-0.5 rounded-full transition-colors"
              >
                {c.title}
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
