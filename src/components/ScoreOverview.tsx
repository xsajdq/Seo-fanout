'use client';

import type { AnalysisResult } from '@/types';
import ScoreRing from './ScoreRing';

function Check({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const icon = ok ? '✅' : warn ? '⚠️' : '❌';
  return <span className="text-sm">{icon} {label}</span>;
}

export default function ScoreOverview({ analysis }: { analysis: AnalysisResult }) {
  const { scores, technical, finalUrl, statusCode } = analysis;

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Analizowana strona</p>
          <a
            href={finalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm font-medium truncate block"
          >
            {finalUrl}
          </a>
          <p className="text-xs text-slate-400 mt-0.5">
            Status HTTP: <span className={statusCode === 200 ? 'text-green-600' : 'text-red-600'}>{statusCode}</span>
          </p>
        </div>
        <div className="flex gap-6">
          <ScoreRing score={scores.overall} label="Ogólny" size="lg" />
          <ScoreRing score={scores.technical} label="Techniczny" />
          <ScoreRing score={scores.content} label="Treść" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Check ok={technical.title.length >= 50 && technical.title.length <= 60}
               warn={technical.title.text !== '' && (technical.title.length < 50 || technical.title.length > 60)}
               label={`Tytuł ${technical.title.length}ch`} />
        <Check ok={technical.metaDescription.length >= 140 && technical.metaDescription.length <= 160}
               warn={technical.metaDescription.text !== '' && (technical.metaDescription.length < 140 || technical.metaDescription.length > 160)}
               label={`Meta ${technical.metaDescription.length}ch`} />
        <Check ok={technical.h1.length === 1} warn={technical.h1.length > 1} label={`H1 (${technical.h1.length})`} />
        <Check ok={technical.hasHttps} label="HTTPS" />
        <Check ok={technical.schema.length > 0} label={`Schema.org (${technical.schema.length})`} />
        <Check ok={technical.canonical !== null} label="Canonical" />
      </div>
    </div>
  );
}
