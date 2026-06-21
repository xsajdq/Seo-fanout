import type { CrawlResult } from './crawler';
import type { TechnicalData, Keyword } from '@/types';

const PL_STOPWORDS = new Set([
  'i', 'w', 'z', 'do', 'na', 'się', 'że', 'to', 'a', 'o', 'jak', 'nie',
  'po', 'przez', 'ale', 'czy', 'tak', 'co', 'go', 'jej', 'jego', 'ich',
  'ten', 'ta', 'te', 'są', 'być', 'jest', 'był', 'była', 'było', 'już',
  'lub', 'dla', 'ze', 'tej', 'tego', 'przy', 'by', 'mi', 'mu', 'za', 'im',
  'the', 'and', 'or', 'in', 'of', 'to', 'is', 'for', 'by', 'with', 'as',
  'at', 'an', 'are', 'was', 'be', 'from', 'this', 'that', 'have', 'it',
  'not', 'on', 'you', 'we', 'they', 'he', 'she', 'but', 'can', 'will',
]);

function scoreRange(val: number, low: number, ideal_lo: number, ideal_hi: number, high: number): number {
  if (val >= ideal_lo && val <= ideal_hi) return 10;
  if (val < low || val > high) return 0;
  if (val < ideal_lo) return Math.round(((val - low) / (ideal_lo - low)) * 5);
  return Math.round(((high - val) / (high - ideal_hi)) * 5);
}

export function analyzeSeo(crawl: CrawlResult) {
  const { $, url } = crawl;
  const baseHostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

  // --- META ---
  const titleText = $('title').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const canonical = $('link[rel="canonical"]').attr('href') ?? null;
  const robots = $('meta[name="robots"]').attr('content') ?? null;

  // Open Graph
  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property')?.slice(3) ?? '';
    const content = $(el).attr('content') ?? '';
    if (prop) og[prop] = content;
  });

  // Schema.org JSON-LD
  const schema: { type: string }[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? '{}');
      const t = json['@type'];
      schema.push({ type: Array.isArray(t) ? t.join(', ') : String(t ?? 'Unknown') });
    } catch {}
  });

  // Hreflang
  const hreflang: { lang: string; url: string }[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang') ?? '';
    const href = $(el).attr('href') ?? '';
    if (lang && href) hreflang.push({ lang, url: href });
  });

  // --- HEADINGS ---
  const headings: { level: number; text: string }[] = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const level = parseInt(el.tagName[1]);
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) headings.push({ level, text });
  });
  const h1 = headings.filter(h => h.level === 1).map(h => h.text);
  const headingsText = headings.map(h => h.text).join(' ');

  // --- CONTENT ---
  $('script,style,nav,footer,header,aside,[aria-hidden="true"]').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // --- IMAGES ---
  const imageCount = $('img').length;
  let imagesWithoutAlt = 0;
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') imagesWithoutAlt++;
  });

  // --- LINKS ---
  const internalLinks: { url: string; text: string }[] = [];
  const externalLinks: { url: string; text: string }[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim().slice(0, 80);
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
    try {
      const abs = new URL(href, url);
      if (abs.hostname === baseHostname) internalLinks.push({ url: abs.href, text });
      else externalLinks.push({ url: abs.href, text });
    } catch {}
  });

  // --- KEYWORDS (TF-like) ---
  const wordFreq: Record<string, number> = {};
  const tokens = bodyText.toLowerCase().match(/\b[a-ząęółśżźćń]{3,}\b/g) ?? [];
  for (const w of tokens) {
    if (!PL_STOPWORDS.has(w)) wordFreq[w] = (wordFreq[w] ?? 0) + 1;
  }
  const keywords: Keyword[] = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word, count]) => ({
      word,
      count,
      density: Math.round((count / Math.max(wordCount, 1)) * 1000) / 10,
      inTitle: titleText.toLowerCase().includes(word),
      inH1: h1.some(h => h.toLowerCase().includes(word)),
      inMeta: metaDesc.toLowerCase().includes(word),
    }));

  // --- SCORES ---
  let technical = 0;
  if (titleText) technical += 10;
  technical += scoreRange(titleText.length, 20, 50, 60, 80);
  if (metaDesc) technical += 10;
  technical += scoreRange(metaDesc.length, 50, 140, 160, 220);
  if (h1.length === 1) technical += 10;
  else if (h1.length > 0) technical += 5;
  if (url.startsWith('https')) technical += 10;
  if (canonical) technical += 10;
  if (schema.length > 0) technical += 15;
  if (Object.keys(og).length >= 2) technical += 10;
  if (headings.some(h => h.level === 2)) technical += 5;
  technical = Math.min(100, technical);

  let content = 0;
  if (wordCount >= 800) content += 30;
  else if (wordCount >= 400) content += Math.round((wordCount / 800) * 30);
  if (headings.filter(h => h.level <= 3).length >= 3) content += 20;
  else if (headings.length > 0) content += 10;
  if (imageCount > 0 && imagesWithoutAlt === 0) content += 15;
  else if (imageCount > 0) content += 7;
  if (internalLinks.length >= 3) content += 15;
  else if (internalLinks.length > 0) content += 7;
  const topDensity = keywords[0]?.density ?? 0;
  if (topDensity > 0 && topDensity < 3) content += 10;
  if (hreflang.length > 0) content += 10;
  content = Math.min(100, content);

  const overall = Math.round((technical + content) / 2);

  const technicalData: TechnicalData = {
    title: { text: titleText, length: titleText.length },
    metaDescription: { text: metaDesc, length: metaDesc.length },
    canonical,
    robots,
    hasHttps: url.startsWith('https'),
    h1,
    headings,
    schema,
    openGraph: og,
    wordCount,
    imageCount,
    imagesWithoutAlt,
    internalLinks: internalLinks.slice(0, 30),
    externalLinks: externalLinks.slice(0, 30),
    hreflang,
  };

  return {
    scores: { overall, technical, content },
    technical: technicalData,
    keywords,
    bodyText: bodyText.slice(0, 6000),
    headingsText,
  };
}
