'use client';

import type { ContentDepth, PageExperience } from '@/types';

function Item({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

interface Props {
  contentDepth: ContentDepth;
  pageExperience: PageExperience;
}

export default function ContentDepthPanel({ contentDepth: cd, pageExperience: pe }: Props) {
  const { images, scripts } = pe;
  const modernPct    = images.total > 0 ? Math.round((images.modernFormat / images.total) * 100) : 100;
  const lazyPct      = images.total > 0 ? Math.round((images.lazyLoaded / images.total) * 100) : 100;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">Głębokość treści & Page Exp.</h2>
        <div className="flex gap-2 text-xs">
          <span className={`px-2 py-1 rounded font-bold ${
            cd.score >= 70 ? 'bg-green-100 text-green-700' :
            cd.score >= 40 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-600'
          }`}>Treść {cd.score}/100</span>
          <span className={`px-2 py-1 rounded font-bold ${
            pe.score >= 70 ? 'bg-green-100 text-green-700' :
            pe.score >= 40 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-600'
          }`}>Perf {pe.score}/100</span>
        </div>
      </div>

      <Section title="Struktura treści (Content Depth)">
        <Item
          ok={cd.questionHeadings.length >= 3}
          label={`Pytania w nagłówkach (${cd.questionHeadings.length})`}
          note={cd.questionHeadings.length > 0 ? cd.questionHeadings.slice(0, 2).join(' / ') + (cd.questionHeadings.length > 2 ? '…' : '') : 'Brak — pytania w H2/H3 to kandydaci na featured snippets'}
        />
        <Item ok={cd.hasFaqSection}    label="Sekcja FAQ / Q&A" note="Zwiększa szansę na People Also Ask" />
        <Item ok={cd.hasOrderedList}   label="Listy numerowane (ol)" note="Pomocne dla How-to i stepów" />
        <Item ok={cd.hasUnorderedList} label="Listy punktowane (ul)" />
        <Item ok={cd.hasTable}         label="Tabele" note="Kandydaci na tabelaryczne rich snippets" />
        <Item ok={cd.hasBlockquote}    label="Cytaty / blockquote" note="Sygnał E-E-A-T (zewnętrzne autorytety)" />
        <Item ok={cd.hasVideoEmbed}    label="Wideo (YouTube/Vimeo)" />
        <Item
          ok={cd.avgParagraphWords >= 30 && cd.avgParagraphWords <= 150}
          label={`Śr. długość akapitu: ${cd.avgParagraphWords} słów`}
          note="Optymum: 30-150 słów. Za krótkie = thin content, za długie = trudna czytelność"
        />
        <Item
          ok={cd.paragraphCount >= 5}
          label={`Liczba akapitów: ${cd.paragraphCount}`}
        />
      </Section>

      {cd.questionHeadings.length > 0 && (
        <div className="mb-4 bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">🎯 Pytania w nagłówkach (featured snippet candidates):</p>
          <ul className="space-y-0.5">
            {cd.questionHeadings.map((q, i) => (
              <li key={i} className="text-xs text-blue-700">• {q}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Page Experience (HTML signals)">
        <Item ok={pe.hasViewportMeta}  label="Viewport meta (mobile)" />
        <Item
          ok={scripts.blocking === 0}
          label={`Skrypty blokujące render: ${scripts.blocking}`}
          note={scripts.blocking > 0 ? `${scripts.blocking} skrypt(y) bez async/defer w <head> — spowalniają FCP` : undefined}
        />
        <Item
          ok={modernPct >= 30}
          label={`Obrazy w nowoczesnym formacie: ${modernPct}%`}
          note={modernPct < 30 ? 'Zamień JPEG/PNG na WebP lub AVIF — mniejszy rozmiar, ten sam obraz' : undefined}
        />
        <Item
          ok={lazyPct >= 50 || images.total === 0}
          label={`Lazy loading obrazów: ${lazyPct}%`}
          note={lazyPct < 50 && images.total > 0 ? 'Dodaj loading="lazy" do obrazów poniżej foldu' : undefined}
        />
        <Item ok={pe.hasPreload}    label="Link preload (kluczowe zasoby)" note="<link rel='preload'> dla LCP image, fontu, CSS" />
        <Item ok={pe.hasPreconnect} label="Preconnect do zewnętrznych domen" note="<link rel='preconnect'> dla Google Fonts, CDN" />
      </Section>
    </div>
  );
}
