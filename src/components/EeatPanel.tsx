'use client';

import type { EeatData } from '@/types';

function Check({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-base flex-shrink-0">{ok ? '✅' : '❌'}</span>
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {note && <p className="text-xs text-slate-400">{note}</p>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

export default function EeatPanel({ eeat }: { eeat: EeatData }) {
  const { author, dates, trust, nap, schemaGaps } = eeat;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">E-E-A-T</h2>
        <span className={`text-sm font-bold px-2 py-1 rounded ${
          eeat.score >= 70 ? 'bg-green-100 text-green-700' :
          eeat.score >= 40 ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-600'
        }`}>
          {eeat.score}/100
        </span>
      </div>

      <Section title="Autor & Ekspertyza">
        <Check ok={author.detected} label="Autor wykryty" note={author.name ?? undefined} />
        {author.detected && <Check ok={author.inSchema} label="Autor w JSON-LD (schema)" />}
        {author.profileLink && (
          <div className="py-1 text-xs text-blue-600 truncate">
            <a href={author.profileLink} target="_blank" rel="noopener noreferrer">
              🔗 {author.profileLink}
            </a>
          </div>
        )}
      </Section>

      <Section title="Świeżość treści (Freshness)">
        <Check
          ok={!!dates.published}
          label="Data publikacji"
          note={dates.published ?? 'Nie wykryto'}
        />
        <Check
          ok={!!dates.modified}
          label="Data aktualizacji"
          note={dates.modified ?? 'Nie wykryto — ważne dla treści evergreen'}
        />
      </Section>

      <Section title="Autorytatywność & Zaufanie">
        <Check ok={trust.about}   label="Strona About / O nas" />
        <Check ok={trust.contact} label="Strona Kontakt" />
        <Check ok={trust.privacy} label="Polityka prywatności / RODO" />
        <Check ok={trust.terms}   label="Regulamin / Warunki" />
      </Section>

      {(nap.phone || nap.email || nap.address) && (
        <Section title="NAP (Local SEO)">
          {nap.phone   && <div className="text-sm py-1">📞 {nap.phone}</div>}
          {nap.email   && <div className="text-sm py-1">📧 {nap.email}</div>}
          {nap.address && <div className="text-sm py-1">📍 {nap.address}</div>}
        </Section>
      )}

      <Section title="Schema.org — luki i sugestie">
        <Check ok={schemaGaps.hasArticle}      label="Article / BlogPosting schema" />
        <Check ok={schemaGaps.hasOrganization} label="Organization / LocalBusiness schema" />
        <Check ok={schemaGaps.hasBreadcrumb}   label="BreadcrumbList schema" />
        <Check ok={schemaGaps.hasFaq}          label="FAQPage schema"
          note={schemaGaps.faqContentDetected && !schemaGaps.hasFaq ? '⚠️ Wykryto treść FAQ bez schema' : undefined} />
        <Check ok={schemaGaps.hasHowTo}        label="HowTo schema"
          note={schemaGaps.howToContentDetected && !schemaGaps.hasHowTo ? '⚠️ Wykryto treść instruktażową bez schema' : undefined} />
      </Section>

      {schemaGaps.suggestions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
          <p className="text-xs font-semibold text-amber-700 mb-1">💡 Rekomendacje:</p>
          <ul className="space-y-1">
            {schemaGaps.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-amber-700">• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
