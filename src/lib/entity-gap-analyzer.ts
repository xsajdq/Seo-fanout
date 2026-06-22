import { findWikiTitle, getWikiLinks, getWikiCategories, getWikiSections, getWikiSummary } from './wikipedia-client';
import type { EntityGap, WikiConcept } from '@/types';

const SKIP_PREFIXES = [
  'Wikipedia:', 'Pomoc:', 'Szablon:', 'Help:', 'Template:', 'Portal:',
  'Plik:', 'File:', 'MediaWiki:', 'User:', 'Użytkownik:', 'Dyskusja:', 'Talk:',
  'Kategoria:', 'Category:', 'Specjalna:', 'Special:',
];

function isContentLink(title: string): boolean {
  if (SKIP_PREFIXES.some(p => title.startsWith(p))) return false;
  if (title.length < 3 || title.length > 70) return false;
  // Skip pure numbers or years
  if (/^\d{1,4}$/.test(title)) return false;
  return true;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, ' ').trim();
}

function isCovered(concept: string, bodyLower: string): boolean {
  const n = norm(concept);
  return bodyLower.includes(n);
}

function detectLang(text: string): 'pl' | 'en' {
  const plChars = (text.match(/[ąęółśżźćń]/gi) ?? []).length;
  return plChars > 3 ? 'pl' : 'en';
}

function headingMatches(wikiSection: string, pageHeadings: string[]): boolean {
  const wn = norm(wikiSection);
  return pageHeadings.some(h => {
    const hn = norm(h);
    // Partial match: if 60%+ of wiki section words appear in heading or vice versa
    const wWords = wn.split(/\s+/).filter(w => w.length > 3);
    if (wWords.length === 0) return false;
    const matchCount = wWords.filter(w => hn.includes(w)).length;
    return matchCount / wWords.length >= 0.6 || hn.includes(wn) || wn.includes(hn);
  });
}

export async function analyzeEntityGap(
  topic: string,
  bodyText: string,
  pageHeadings: string[],
): Promise<EntityGap> {
  if (!topic.trim()) {
    return emptyGap(topic);
  }

  const lang = detectLang(bodyText + ' ' + topic);
  const bodyLower = bodyText.toLowerCase();

  // Try primary language, fall back to the other
  let wikiTitle = await findWikiTitle(topic, lang);
  let wikiLang: 'pl' | 'en' = lang;

  if (!wikiTitle) {
    const fallback = lang === 'pl' ? 'en' : 'pl';
    wikiTitle = await findWikiTitle(topic, fallback);
    if (wikiTitle) wikiLang = fallback;
  }

  if (!wikiTitle) return emptyGap(topic);

  // Fetch in parallel
  const [rawLinks, categories, sections, summary] = await Promise.all([
    getWikiLinks(wikiTitle, wikiLang),
    getWikiCategories(wikiTitle, wikiLang),
    getWikiSections(wikiTitle, wikiLang),
    getWikiSummary(wikiTitle, wikiLang),
  ]);

  const contentLinks = rawLinks.filter(isContentLink);

  const coveredConcepts: WikiConcept[] = [];
  const missingConcepts: WikiConcept[] = [];

  for (const title of contentLinks.slice(0, 300)) {
    const concept: WikiConcept = {
      title,
      covered: isCovered(title, bodyLower),
      url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    };
    if (concept.covered) coveredConcepts.push(concept);
    else missingConcepts.push(concept);
  }

  // Section gap — H2-level only (level 2 in Wikipedia parse = H2)
  const h2sections = sections.filter(s => s.level <= 2);
  const coveredSections = h2sections.filter(s => headingMatches(s.title, pageHeadings));
  const missingSections = h2sections
    .filter(s => !headingMatches(s.title, pageHeadings))
    .map(s => s.title);

  const coverageScore = contentLinks.length > 0
    ? Math.min(100, Math.round((coveredConcepts.length / Math.min(contentLinks.length, 300)) * 100))
    : 0;

  return {
    topic,
    wikiArticle: wikiTitle,
    wikiLang,
    wikiSummary: summary,
    categories: categories.slice(0, 8),
    coveredConcepts: coveredConcepts.slice(0, 40),
    missingConcepts: missingConcepts.slice(0, 40),
    coverageScore,
    totalConcepts: Math.min(contentLinks.length, 300),
    allSections: h2sections.map(s => s.title),
    coveredSections: coveredSections.map(s => s.title),
    missingSections: missingSections.slice(0, 15),
  };
}

function emptyGap(topic: string): EntityGap {
  return {
    topic,
    wikiArticle: null,
    wikiLang: null,
    wikiSummary: '',
    categories: [],
    coveredConcepts: [],
    missingConcepts: [],
    coverageScore: 0,
    totalConcepts: 0,
    allSections: [],
    coveredSections: [],
    missingSections: [],
  };
}
