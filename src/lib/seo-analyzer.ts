import { load } from 'cheerio';
import type { CrawlResult } from './crawler';
import type { TechnicalData, Keyword, ContentDepth, PageExperience } from '@/types';
import { analyzeGeo } from './geo-analyzer';

const PL_STOPWORDS = new Set([
  'i', 'w', 'z', 'do', 'na', 'się', 'że', 'to', 'a', 'o', 'jak', 'nie',
  'po', 'przez', 'ale', 'czy', 'tak', 'co', 'go', 'jej', 'jego', 'ich',
  'ten', 'ta', 'te', 'są', 'być', 'jest', 'był', 'była', 'było', 'już',
  'lub', 'dla', 'ze', 'tej', 'tego', 'przy', 'by', 'mi', 'mu', 'za', 'im',
  'the', 'and', 'or', 'in', 'of', 'to', 'is', 'for', 'by', 'with', 'as',
  'at', 'an', 'are', 'was', 'be', 'from', 'this', 'that', 'have', 'it',
  'not', 'on', 'you', 'we', 'they', 'he', 'she', 'but', 'can', 'will',
]);

const QUESTION_STARTERS = new Set([
  'co', 'jak', 'czy', 'dlaczego', 'kiedy', 'gdzie', 'kto', 'ile', 'jaki', 'jaka', 'jakie',
  'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'is', 'are', 'do', 'does',
]);

function scoreRange(val: number, low: number, lo: number, hi: number, high: number): number {
  if (val >= lo && val <= hi) return 10;
  if (val < low || val > high) return 0;
  if (val < lo) return Math.round(((val - low) / (lo - low)) * 5);
  return Math.round(((high - val) / (high - hi)) * 5);
}

// ── Page Experience (needs full DOM, no mutations) ────────────────────────────

function analyzePageExperience(html: string): PageExperience {
  const $ = load(html);

  const hasViewportMeta = $('meta[name="viewport"]').length > 0;
  const hasPreload      = $('link[rel="preload"]').length > 0;
  const hasPreconnect   = $('link[rel="preconnect"]').length > 0;

  // Images
  const imgs = $('img').toArray();
  const total = imgs.length;
  let modernFormat = 0, lazyLoaded = 0, withDimensions = 0;
  for (const el of imgs) {
    const src = ($(el).attr('src') ?? $(el).attr('data-src') ?? '').toLowerCase();
    const ext = src.split('?')[0].split('.').pop() ?? '';
    if (ext === 'webp' || ext === 'avif') modernFormat++;
    if ($(el).attr('loading') === 'lazy') lazyLoaded++;
    if ($(el).attr('width') && $(el).attr('height')) withDimensions++;
  }

  // Scripts (in head = potentially blocking)
  let blocking = 0, asyncCount = 0, deferCount = 0;
  $('head script[src]').each((_, el) => {
    const $el = $(el);
    if ($el.attr('async') !== undefined) asyncCount++;
    else if ($el.attr('defer') !== undefined) deferCount++;
    else blocking++;
  });
  const scriptTotal = $('script').length;

  // Score
  let score = 0;
  if (hasViewportMeta) score += 20;
  if (total === 0 || modernFormat / total >= 0.3) score += 15;
  if (total === 0 || lazyLoaded / total >= 0.5)   score += 15;
  if (total === 0 || withDimensions / total >= 0.5) score += 10;
  score += Math.max(0, 20 - blocking * 5); // -5 per blocking script
  if (hasPreload)    score += 10;
  if (hasPreconnect) score += 10;
  score = Math.min(100, score);

  return {
    hasViewportMeta,
    images:  { total, modernFormat, lazyLoaded, withDimensions },
    scripts: { total: scriptTotal, blocking, asyncCount, deferCount },
    hasPreload,
    hasPreconnect,
    score,
  };
}

// ── Content Depth (needs full DOM, no mutations) ──────────────────────────────

function analyzeContentDepth(html: string): ContentDepth {
  const $ = load(html);

  const questionHeadings: string[] = [];
  $('h2,h3').each((_, el) => {
    const text = $(el).text().trim();
    const first = text.toLowerCase().split(/\s+/)[0];
    if (text.endsWith('?') || QUESTION_STARTERS.has(first)) questionHeadings.push(text);
  });

  const hasFaqSection    = $('[class*="faq"],[id*="faq"],.accordion').length > 0 || questionHeadings.length >= 3;
  const hasOrderedList   = $('ol li').length >= 3;
  const hasUnorderedList = $('ul li').length >= 3;
  const hasTable         = $('table').length > 0;
  const hasBlockquote    = $('blockquote').length > 0;
  const hasVideoEmbed    = $('iframe[src*="youtube"],iframe[src*="youtu.be"],iframe[src*="vimeo"]').length > 0;

  const paras = $('p').map((_, el) => $(el).text().trim()).get().filter(t => t.split(/\s+/).length >= 10);
  const wcs   = paras.map(p => p.split(/\s+/).length);
  const paragraphCount    = paras.length;
  const avgParagraphWords = wcs.length > 0
    ? Math.round(wcs.reduce((a, b) => a + b, 0) / wcs.length)
    : 0;

  // Score
  let score = 0;
  score += Math.min(30, questionHeadings.length * 8);
  if (hasFaqSection)    score += 10;
  if (hasOrderedList)   score += 10;
  if (hasUnorderedList) score += 10;
  if (hasTable)         score += 10;
  if (hasBlockquote)    score +=  5;
  if (hasVideoEmbed)    score += 10;
  if (paragraphCount >= 5) score += 5;
  if (avgParagraphWords >= 30 && avgParagraphWords <= 150) score += 10;
  score = Math.min(100, score);

  return {
    questionHeadings,
    hasFaqSection,
    hasOrderedList,
    hasUnorderedList,
    hasTable,
    hasBlockquote,
    hasVideoEmbed,
    paragraphCount,
    avgParagraphWords,
    score,
  };
}

// ── Main SEO analysis ─────────────────────────────────────────────────────────

export function analyzeSeo(crawl: CrawlResult) {
  const { $, html, url } = crawl;
  const baseHostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

  // ── META ──
  const titleText = $('title').first().text().trim();
  const metaDesc  = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const canonical = $('link[rel="canonical"]').attr('href') ?? null;
  const robots    = $('meta[name="robots"]').attr('content') ?? null;

  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property')?.slice(3) ?? '';
    const content = $(el).attr('content') ?? '';
    if (prop) og[prop] = content;
  });

  const schema: { type: string }[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? '{}');
      const t = json['@type'];
      schema.push({ type: Array.isArray(t) ? t.join(', ') : String(t ?? 'Unknown') });
    } catch {}
  });

  const hreflang: { lang: string; url: string }[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang') ?? '';
    const href = $(el).attr('href') ?? '';
    if (lang && href) hreflang.push({ lang, url: href });
  });

  // ── HEADINGS ──
  const headings: { level: number; text: string }[] = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const level = parseInt(el.tagName[1]);
    const text  = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) headings.push({ level, text });
  });
  const h1          = headings.filter(h => h.level === 1).map(h => h.text);
  const headingsText = headings.map(h => h.text).join(' ');

  // ── IMAGES (from original DOM) ──
  const imageCount      = $('img').length;
  let imagesWithoutAlt  = 0;
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') imagesWithoutAlt++;
  });

  // ── LINKS ──
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

  // ── CLEAN BODY TEXT (separate load = no DOM mutation) ──
  const $clean = load(html);
  $clean('script,style,nav,footer,header,aside,[aria-hidden="true"]').remove();
  const bodyText  = $clean('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // ── KEYWORDS ──
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
      inH1:    h1.some(h => h.toLowerCase().includes(word)),
      inMeta:  metaDesc.toLowerCase().includes(word),
    }));

  // ── TECHNICAL SCORE ──
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

  // ── CONTENT SCORE ──
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

  // ── CONTENT DEPTH, PAGE EXPERIENCE & GEO ──
  const contentDepth   = analyzeContentDepth(html);
  const pageExperience = analyzePageExperience(html);
  const geo            = analyzeGeo(html, bodyText);

  const technicalData: TechnicalData = {
    title:           { text: titleText, length: titleText.length },
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
    scores: {
      technical,
      content,
      contentDepth: contentDepth.score,
      pageExperience: pageExperience.score,
      geo: geo.score,
    },
    technical: technicalData,
    keywords,
    contentDepth,
    pageExperience,
    geo,
    bodyText:     bodyText.slice(0, 6000),
    headingsText,
  };
}
