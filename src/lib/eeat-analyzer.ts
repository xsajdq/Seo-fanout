import type { CheerioAPI } from 'cheerio';
import type { EeatData } from '@/types';

const QUESTION_PL = new Set(['co', 'jak', 'czy', 'dlaczego', 'kiedy', 'gdzie', 'kto', 'ile', 'które', 'jaki', 'jaka', 'jakie', 'po', 'skąd', 'skad']);
const QUESTION_EN = new Set(['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'is', 'are', 'do', 'does', 'should', 'will', 'would']);
const ALL_Q = new Set([...QUESTION_PL, ...QUESTION_EN]);

export function analyzeEeat($: CheerioAPI, schemaTypes: Set<string>): EeatData {
  // ── AUTHOR ──
  let authorName: string | null = null;
  let inSchema = false;
  let inHtml = false;
  let profileLink: string | null = null;

  // JSON-LD author
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? '{}');
      const a = json.author ?? json.creator;
      if (a && !authorName) {
        const name = typeof a === 'string' ? a : (a.name ?? null);
        if (name) { authorName = name; inSchema = true; }
      }
    } catch {}
  });

  // <meta name="author">
  const metaAuthor = $('meta[name="author"]').attr('content')?.trim();
  if (metaAuthor && !authorName) authorName = metaAuthor;

  // <a rel="author">
  const relAuthorEl = $('a[rel="author"]').first();
  if (relAuthorEl.length) {
    inHtml = true;
    if (!authorName) authorName = relAuthorEl.text().trim() || null;
    profileLink = relAuthorEl.attr('href') ?? null;
  }

  // class/itemprop
  const byline = $('[class*="author"],[class*="byline"],[itemprop="author"]').first();
  if (byline.length && !authorName) {
    inHtml = true;
    const txt = byline.text().trim().split('\n')[0].trim();
    if (txt.length > 0 && txt.length < 80) authorName = txt;
  }

  // ── DATES ──
  let published: string | null = null;
  let modified: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? '{}');
      if (json.datePublished && !published) published = String(json.datePublished);
      if (json.dateModified && !modified) modified = String(json.dateModified);
    } catch {}
  });
  published ??= $('meta[property="article:published_time"]').attr('content') ?? null;
  modified  ??= $('meta[property="article:modified_time"]').attr('content') ?? null;
  published ??= $('meta[name="date"],meta[name="DC.date"]').first().attr('content') ?? null;
  published ??= $('time[datetime]').first().attr('datetime') ?? null;

  // Normalize: keep only date part if it's ISO
  const dateOnly = (s: string | null) => s ? (s.split('T')[0] ?? s) : null;
  published = dateOnly(published);
  modified  = dateOnly(modified);

  // ── TRUST LINKS ──
  const allHrefs: string[] = [];
  $('a[href]').each((_, el) => { allHrefs.push(($(el).attr('href') ?? '').toLowerCase()); });
  const hasL = (patterns: string[]) => allHrefs.some(h => patterns.some(p => h.includes(p)));

  const trust = {
    about:   hasL(['about', 'o-nas', 'o-firmie', 'about-us', 'o-mnie']),
    contact: hasL(['contact', 'kontakt']),
    privacy: hasL(['privacy', 'prywatno', 'polityka-pry', 'gdpr', 'rodo']),
    terms:   hasL(['terms', 'regulamin', 'warunki']),
  };

  // ── NAP ──
  const bodyText = $('body').text();
  const phone   = bodyText.match(/(\+48[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}|\d{3}[\s-]\d{3}[\s-]\d{3})/)?.[0]?.trim() ?? null;
  const email   = bodyText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0]?.trim() ?? null;
  const address = bodyText.match(/\d{2}-\d{3}\s+\w[\w\s]{2,30}/)?.[0]?.trim() ?? null;

  // ── SCHEMA GAPS ──
  const hasFaq          = schemaTypes.has('faqpage');
  const hasHowTo        = schemaTypes.has('howto');
  const hasBreadcrumb   = schemaTypes.has('breadcrumblist');
  const hasArticle      = schemaTypes.has('article') || schemaTypes.has('blogposting') || schemaTypes.has('newsarticle');
  const hasOrganization = schemaTypes.has('organization') || schemaTypes.has('localbusiness');

  const h2h3 = $('h2,h3').map((_, el) => $(el).text().toLowerCase().trim()).get();
  const questionH = h2h3.filter(t => t.endsWith('?') || ALL_Q.has(t.split(/\s+/)[0]));
  const faqContentDetected    = questionH.length >= 3 || $('[class*="faq"],[id*="faq"]').length > 0;
  const howToContentDetected  = $('ol').length > 0 && h2h3.some(t => t.includes('krok') || t.includes('step') || t.includes('etap'));

  const suggestions: string[] = [];
  if (faqContentDetected && !hasFaq)    suggestions.push('Dodaj FAQPage schema — masz Q&A bez znacznika');
  if (howToContentDetected && !hasHowTo) suggestions.push('Dodaj HowTo schema — wykryto treść instruktażową');
  if (!hasBreadcrumb)                    suggestions.push('Dodaj BreadcrumbList schema');
  if (!hasArticle)                       suggestions.push('Rozważ Article / BlogPosting schema');
  if (!hasOrganization)                  suggestions.push('Dodaj Organization lub LocalBusiness schema');

  // ── SCORE ──
  let score = 0;
  if (authorName)           score += 20;
  if (inSchema)             score += 10;
  if (published)            score += 10;
  if (modified)             score +=  5;
  if (trust.about)          score += 10;
  if (trust.contact)        score += 10;
  if (trust.privacy)        score +=  5;
  if (hasArticle)           score += 10;
  if (hasOrganization)      score += 10;
  if (email || phone)       score += 10;
  score = Math.min(100, score);

  return {
    author: { detected: !!authorName, name: authorName, inSchema, inHtml, profileLink },
    dates:  { published, modified },
    trust,
    nap:    { phone, email, address },
    schemaGaps: { hasFaq, faqContentDetected, hasHowTo, howToContentDetected, hasBreadcrumb, hasArticle, hasOrganization, suggestions },
    score,
  };
}
