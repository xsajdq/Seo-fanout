import { findWikiTitle, getWikiLinks, getWikiCategories, getWikiSections, getWikiSummary } from './wikipedia-client';
import type { EntityGap, WikiConcept, QuickAuditResult } from '@/types';

// ── Internal types ────────────────────────────────────────────────────────────

interface WikiPageData {
  title: string;
  lang: 'pl' | 'en';
  summary: string;
  categories: string[];
  contentLinks: string[];
  sections: { title: string; level: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_PREFIXES = [
  'Wikipedia:', 'Pomoc:', 'Szablon:', 'Help:', 'Template:', 'Portal:',
  'Plik:', 'File:', 'MediaWiki:', 'User:', 'Użytkownik:', 'Dyskusja:', 'Talk:',
  'Kategoria:', 'Category:', 'Specjalna:', 'Special:',
];

// Very generic concepts that pollute gap results for almost every topic
const GENERIC_SKIP = new Set([
  'United States', 'United Kingdom', 'Europe', 'World', 'English language',
  'Polska', 'Stany Zjednoczone', 'Język angielski', 'Internet', 'Website',
  'Google', 'Facebook', 'Twitter', 'YouTube', 'Wikipedia',
]);

function isContentLink(t: string): boolean {
  if (SKIP_PREFIXES.some(p => t.startsWith(p))) return false;
  if (t.length < 4 || t.length > 55) return false;
  if (/^\d+$/.test(t)) return false;
  if (GENERIC_SKIP.has(t)) return false;
  return true;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, ' ').trim();
}

function isCovered(concept: string, bodyLower: string): boolean {
  const n = norm(concept);
  if (bodyLower.includes(n)) return true;
  // Multi-word: check all significant words appear individually (handles reordering/hyphenation)
  const words = n.split(/\s+/).filter(w => w.length >= 5);
  if (words.length >= 2) return words.every(w => bodyLower.includes(w));
  return false;
}

function headingMatches(wikiSection: string, pageHeadings: string[]): boolean {
  const wn = norm(wikiSection);
  return pageHeadings.some(h => {
    const hn = norm(h);
    const wWords = wn.split(/\s+/).filter(w => w.length > 3);
    if (!wWords.length) return false;
    const hits = wWords.filter(w => hn.includes(w)).length;
    return hits / wWords.length >= 0.5 || hn.includes(wn) || wn.includes(hn);
  });
}

// Detect language from URL path first (most reliable), then topic text
function detectLang(topic: string, url?: string): 'pl' | 'en' {
  if (url) {
    if (/\/(en|english)\b/i.test(url)) return 'en';
    if (/\/(pl|polski|polish)\b/i.test(url)) return 'pl';
  }
  // Strip brand suffix before detecting — e.g. "Course | Paweł Wiszniewsky" → "Course"
  const cleanTopic = topic.split(/\s*[|–—]\s*/)[0];
  return (cleanTopic.match(/[ąęółśżźćń]/gi) ?? []).length > 1 ? 'pl' : 'en';
}

// Extract the best topic string for Wikipedia lookup:
// prefer h1 (no brand name), then cleaned title, then URL slug
function extractTopic(title: string, h1: string | null, path: string): string {
  const h1c = h1?.trim();
  if (h1c && h1c.length >= 5) return h1c;
  const titleClean = title.split(/\s*[|–—:]\s*/)[0].trim();
  if (titleClean.length >= 5) return titleClean;
  const seg = path.split('/').filter(Boolean).pop() ?? '';
  return seg.replace(/[-_]/g, ' ').trim();
}

// ── Wikipedia fetch ───────────────────────────────────────────────────────────

async function fetchWikiPageData(topic: string, url?: string): Promise<WikiPageData | null> {
  if (!topic.trim()) return null;

  const lang = detectLang(topic, url);
  let wikiTitle = await findWikiTitle(topic, lang);
  let wikiLang: 'pl' | 'en' = lang;

  // Fallback: try other language
  if (!wikiTitle) {
    const fb: 'pl' | 'en' = lang === 'pl' ? 'en' : 'pl';
    wikiTitle = await findWikiTitle(topic, fb);
    if (wikiTitle) wikiLang = fb;
  }

  // Second fallback: shorter query (first 3–4 words)
  if (!wikiTitle) {
    const shorter = topic.replace(/\s*\([^)]*\)/g, '').split(/\s+/).slice(0, 4).join(' ');
    if (shorter !== topic && shorter.length >= 4) {
      wikiTitle = await findWikiTitle(shorter, lang);
      if (wikiTitle) wikiLang = lang;
    }
  }

  if (!wikiTitle) return null;

  const [rawLinks, categories, sections, summary] = await Promise.all([
    getWikiLinks(wikiTitle, wikiLang),
    getWikiCategories(wikiTitle, wikiLang),
    getWikiSections(wikiTitle, wikiLang),
    getWikiSummary(wikiTitle, wikiLang),
  ]);

  return {
    title: wikiTitle,
    lang: wikiLang,
    summary,
    categories: categories.slice(0, 8),
    contentLinks: rawLinks.filter(isContentLink).slice(0, 200),
    sections,
  };
}

// ── Gap computation ───────────────────────────────────────────────────────────

function computeEntityGap(
  wiki: WikiPageData,
  topic: string,
  bodyText: string,
  pageHeadings: string[],
): EntityGap {
  const bodyLower = bodyText.toLowerCase();

  const coveredConcepts: WikiConcept[] = [];
  const missingConcepts: WikiConcept[] = [];

  for (const title of wiki.contentLinks) {
    const obj: WikiConcept = {
      title,
      covered: isCovered(title, bodyLower),
      url: `https://${wiki.lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    };
    if (obj.covered) coveredConcepts.push(obj);
    else missingConcepts.push(obj);
  }

  const h2 = wiki.sections.filter(s => s.level <= 2);
  const coveredSections = h2.filter(s => headingMatches(s.title, pageHeadings)).map(s => s.title);
  const missingSections = h2.filter(s => !headingMatches(s.title, pageHeadings)).map(s => s.title);

  const total = wiki.contentLinks.length;
  const coverageScore = total > 0
    ? Math.min(100, Math.round((coveredConcepts.length / total) * 100))
    : 0;

  return {
    topic,
    wikiArticle: wiki.title,
    wikiLang: wiki.lang,
    wikiSummary: wiki.summary,
    categories: wiki.categories,
    coveredConcepts: coveredConcepts.slice(0, 40),
    missingConcepts: missingConcepts.slice(0, 40),
    coverageScore,
    totalConcepts: total,
    allSections: h2.map(s => s.title),
    coveredSections,
    missingSections: missingSections.slice(0, 15),
  };
}

function emptyGap(topic: string): EntityGap {
  return {
    topic, wikiArticle: null, wikiLang: null, wikiSummary: '',
    categories: [], coveredConcepts: [], missingConcepts: [],
    coverageScore: 0, totalConcepts: 0,
    allSections: [], coveredSections: [], missingSections: [],
  };
}

// ── Public: single-page analysis ─────────────────────────────────────────────

export async function analyzeEntityGap(
  topic: string,
  bodyText: string,
  pageHeadings: string[],
  url?: string,
): Promise<EntityGap> {
  if (!topic.trim()) return emptyGap(topic);
  // Apply same topic cleaning as domain analysis
  const cleanTopic = extractTopic(topic, null, '');
  const wiki = await fetchWikiPageData(cleanTopic || topic, url);
  if (!wiki) return emptyGap(topic);
  return computeEntityGap(wiki, topic, bodyText, pageHeadings);
}

// ── Public: domain batch analysis ────────────────────────────────────────────

function isContentPage(url: string, wordCount: number): boolean {
  try {
    const path = new URL(url).pathname;
    if (/\/(category|tag|autor|author|page|feed|sitemap|wp-json)\//i.test(path)) return false;
    if (/\.(xml|rss|atom)$/i.test(path)) return false;
    return wordCount >= 150;
  } catch { return false; }
}

function topicsOverlap(a: string, b: string): boolean {
  const aw = norm(a).split(/\s+/).filter(w => w.length > 3);
  const bw = norm(b).split(/\s+/).filter(w => w.length > 3);
  if (!aw.length) return false;
  return aw.filter(w => bw.some(bwi => bwi.includes(w) || w.includes(bwi))).length / aw.length >= 0.5;
}

export async function analyzeDomainGaps(
  pages: QuickAuditResult[],
  send: (data: unknown) => void,
): Promise<void> {
  const todo = pages.filter(p => isContentPage(p.url, p.wordCount)).slice(0, 50);

  if (todo.length === 0) {
    send({ type: 'gap_complete' });
    return;
  }

  send({ type: 'gap_status', message: `Analizuję luki treści w ${todo.length} artykułach…` });

  const wikiCache = new Map<string, WikiPageData>();

  for (let i = 0; i < todo.length; i++) {
    const page = todo[i];
    const topic = extractTopic(page.title, page.h1, page.path);

    send({ type: 'gap_status', message: `Graf wiedzy ${i + 1}/${todo.length}: ${topic.slice(0, 60)}` });

    try {
      let wiki: WikiPageData | null = null;

      for (const [, cached] of wikiCache) {
        if (topicsOverlap(topic, cached.title)) { wiki = cached; break; }
      }

      if (!wiki) {
        wiki = await fetchWikiPageData(topic, page.url);
        if (wiki) wikiCache.set(wiki.title, wiki);
      }

      const headings = (page.headings && page.headings.length > 0)
        ? page.headings
        : (page.h1 ? [page.h1] : []);

      const entityGap = wiki
        ? computeEntityGap(wiki, topic, page.bodyText ?? '', headings)
        : emptyGap(topic);

      send({ type: 'gap_done', url: page.url, entityGap });
    } catch {
      send({ type: 'gap_done', url: page.url, entityGap: emptyGap(topic) });
    }

    if (i < todo.length - 1) await new Promise(r => setTimeout(r, 350));
  }

  send({ type: 'gap_complete' });
}
