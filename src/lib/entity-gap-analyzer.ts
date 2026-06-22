import { findWikiTitle, getWikiLinks, getWikiCategories, getWikiSections, getWikiSummary } from './wikipedia-client';
import type { EntityGap, WikiConcept, QuickAuditResult, DomainTopicGap, MissingArticle } from '@/types';

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

// ── Phase 3: domain-level topic map ──────────────────────────────────────────

// Infer the domain's primary topic from URL path slugs (most reliable signal),
// then homepage h1, then domain name.
function inferDomainTopic(pages: QuickAuditResult[], domain: string): string {
  const pathStops = new Set([
    'en', 'pl', 'de', 'fr', 'blog', 'page', 'about', 'contact', 'home', 'index',
    'uslugi', 'services', 'service', 'category', 'tag', 'autor', 'author',
    'kursy', 'oferta', 'sklep', 'shop', 'strona', 'artykul', 'wpis',
  ]);

  // Count frequency of each slug word across all pages
  const segFreq: Record<string, number> = {};
  for (const p of pages) {
    const segs = p.path.split('/').filter(Boolean);
    for (const seg of segs) {
      const words = seg.split('-').filter(w => w.length >= 3 && !pathStops.has(w) && !/^\d+$/.test(w));
      for (const w of words) {
        segFreq[w] = (segFreq[w] ?? 0) + 1;
      }
    }
  }
  const topSeg = Object.entries(segFreq).sort((a, b) => b[1] - a[1]).find(([, c]) => c >= 2);
  if (topSeg) return topSeg[0];

  // Homepage h1
  const homepage = pages.find(p => p.path === '/' || /^\/(en|pl)?\/?(index)?$/i.test(p.path));
  if (homepage) {
    const t = extractTopic(homepage.title, homepage.h1, homepage.path);
    const generic = new Set(['home', 'strona główna', 'witaj', 'main', 'index', 'welcome']);
    if (t.length >= 5 && !generic.has(t.toLowerCase())) return t;
  }

  // Fallback: first segment of domain name
  const raw = domain.replace(/^https?:\/\//i, '').split('.')[0];
  return raw.replace(/[-_]/g, ' ');
}

// A page "dedicates itself" to a topic if its cleaned topic closely matches.
function hasDedicatedPage(topic: string, pages: QuickAuditResult[]): string[] {
  const n = norm(topic);
  const nWords = n.split(/\s+/).filter(w => w.length > 3);

  return pages.filter(p => {
    const pageT = norm(extractTopic(p.title, p.h1, p.path));
    const pathT  = p.path.replace(/[/_-]/g, ' ').toLowerCase();
    if (pageT.includes(n) || n.includes(pageT)) return pageT.length >= 3;
    if (pathT.includes(n)) return true;
    if (nWords.length >= 2) {
      const pWords = pageT.split(/\s+/).filter(w => w.length > 3);
      const hits = nWords.filter(w => pWords.some(pw => pw.includes(w) || w.includes(pw))).length;
      return hits / nWords.length >= 0.7;
    }
    return false;
  }).map(p => p.url);
}

// Topic is "mentioned" if it appears in any page's body text.
function topicMentionedIn(topic: string, pages: QuickAuditResult[]): string[] {
  return pages
    .filter(p => isCovered(topic, (p.bodyText ?? '').toLowerCase()))
    .map(p => p.url)
    .slice(0, 3);
}

export async function analyzeDomainTopicGap(
  pages: QuickAuditResult[],
  domain: string,
  send: (data: unknown) => void,
): Promise<void> {
  const domainTopic = inferDomainTopic(pages, domain);

  send({ type: 'topic_gap_status', message: `Buduję mapę tematyczną: "${domainTopic}"` });

  const wiki = await fetchWikiPageData(domainTopic);

  if (!wiki) {
    send({ type: 'topic_gap_done', gap: null });
    return;
  }

  send({ type: 'topic_gap_status', message: `Wikipedia: "${wiki.title}" · Sprawdzam pokrycie tematów domeny…` });

  const h2Sections = wiki.sections.filter(s => s.level <= 2);
  const conceptLinks = wiki.contentLinks.slice(0, 80);

  const allTopics: { title: string; type: 'section' | 'concept' }[] = [
    ...h2Sections.map(s => ({ title: s.title, type: 'section' as const })),
    ...conceptLinks.map(l => ({ title: l, type: 'concept' as const })),
  ];

  const missingArticles: MissingArticle[] = [];
  const thinArticles:   MissingArticle[] = [];
  const coveredTopics:  { title: string; wikiUrl: string; coveredBy: string[] }[] = [];

  for (const { title, type } of allTopics) {
    const wikiUrl = `https://${wiki.lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const dedicated = hasDedicatedPage(title, pages);
    const mentioned = dedicated.length === 0 ? topicMentionedIn(title, pages) : [];

    if (dedicated.length > 0) {
      coveredTopics.push({ title, wikiUrl, coveredBy: dedicated });
    } else if (mentioned.length > 0) {
      thinArticles.push({
        title, wikiUrl, type, mentionedIn: mentioned,
        priority: type === 'section' ? 'high' : 'medium',
      });
    } else {
      missingArticles.push({
        title, wikiUrl, type, mentionedIn: [],
        priority: type === 'section' ? 'high' : 'low',
      });
    }
  }

  const total = allTopics.length;
  const gap: DomainTopicGap = {
    domainTopic,
    wikiArticle: wiki.title,
    wikiLang: wiki.lang,
    wikiSummary: wiki.summary,
    categories: wiki.categories,
    missingArticles: missingArticles.slice(0, 30),
    thinArticles:   thinArticles.slice(0, 20),
    coveredTopics:  coveredTopics.slice(0, 30),
    domainCoverageScore: total > 0 ? Math.round(coveredTopics.length / total * 100) : 0,
    totalTopics: total,
  };

  send({ type: 'topic_gap_done', gap });
}
