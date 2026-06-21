'use client';

import { useState } from 'react';
import type { TechnicalData } from '@/types';

function Row({ label, value, ok }: { label: string; value: string | number; ok?: boolean }) {
  const dot = ok === undefined ? '●' : ok ? '✅' : '⚠️';
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{dot} {label}</span>
      <span className="text-sm text-slate-800 font-medium max-w-[55%] truncate text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center text-sm font-semibold text-slate-700 py-1"
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export default function TechnicalPanel({ technical }: { technical: TechnicalData }) {
  return (
    <div className="card">
      <h2 className="section-title">Techniczne SEO</h2>

      <Section title="Meta tagi">
        <Row label="Tytuł" value={technical.title.text || '(brak)'} ok={technical.title.length >= 40} />
        <Row label="Długość tytułu" value={`${technical.title.length} znaków`} ok={technical.title.length >= 50 && technical.title.length <= 60} />
        <Row label="Meta opis" value={technical.metaDescription.text || '(brak)'} ok={technical.metaDescription.text !== ''} />
        <Row label="Długość opisu" value={`${technical.metaDescription.length} znaków`} ok={technical.metaDescription.length >= 140 && technical.metaDescription.length <= 160} />
        <Row label="Canonical" value={technical.canonical ?? '(brak)'} ok={technical.canonical !== null} />
        <Row label="Robots" value={technical.robots ?? 'index, follow (domyślnie)'} />
        <Row label="HTTPS" value={technical.hasHttps ? 'Tak' : 'Nie'} ok={technical.hasHttps} />
      </Section>

      <Section title="Nagłówki">
        {technical.headings.length === 0 ? (
          <p className="text-sm text-slate-400">Brak nagłówków</p>
        ) : (
          technical.headings.map((h, i) => (
            <div key={i} className="flex gap-2 py-1 border-b border-slate-50 last:border-0">
              <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${
                h.level === 1 ? 'bg-blue-100 text-blue-700' :
                h.level === 2 ? 'bg-purple-100 text-purple-700' :
                'bg-slate-100 text-slate-600'
              }`}>H{h.level}</span>
              <span className="text-sm text-slate-700 truncate">{h.text}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Dane strukturalne & OG">
        {technical.schema.length > 0 ? (
          technical.schema.map((s, i) => (
            <div key={i} className="badge bg-green-50 text-green-700 mr-1 mb-1">{s.type}</div>
          ))
        ) : (
          <p className="text-sm text-slate-400">Brak schema.org</p>
        )}
        {Object.entries(technical.openGraph).length > 0 && (
          <div className="mt-2">
            {Object.entries(technical.openGraph).slice(0, 4).map(([k, v]) => (
              <Row key={k} label={`og:${k}`} value={v} />
            ))}
          </div>
        )}
        {technical.hreflang.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {technical.hreflang.map((h, i) => (
              <span key={i} className="badge bg-blue-50 text-blue-700">{h.lang}</span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Linki & Media">
        <Row label="Linki wewnętrzne" value={technical.internalLinks.length} ok={technical.internalLinks.length >= 3} />
        <Row label="Linki zewnętrzne" value={technical.externalLinks.length} />
        <Row label="Obrazy" value={technical.imageCount} />
        <Row label="Obrazy bez alt" value={technical.imagesWithoutAlt} ok={technical.imagesWithoutAlt === 0} />
        <Row label="Liczba słów" value={technical.wordCount} ok={technical.wordCount >= 400} />
      </Section>
    </div>
  );
}
