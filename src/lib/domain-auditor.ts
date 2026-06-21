import { load } from 'cheerio';
import type { QuickAuditResult, DomainSummary } from '@/types';

const BOT_UA = 'Mozilla/5.0 (compatible; SEOFanoutBot/1.0)';

// ── Sitemap discovery ─────────────────────────────────────────────────────────

function extractLocs(xml: string): string[] {
  const urls: string[] = [];
  const rx = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = rx.exec(xml)) !== null) {
    const u = m[1].trim();
    if (u) urls.push(u);
  }
  return urls;
}

async function fetchText(url: string, timeoutMs = 10_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BOT_UA, Accept: 'application/xml,text/xml,text/html,*/*' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function discoverUrls(domain: string, maxPages: number): Promise<{ urls: string[]; source: string }> {
  const base   = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const origin = new URL(base).origin;
  const hostname = new URL(base).hostname;

  const sitemapCandidates: string[] = [];

  // 1. robots.txt → Sitemap: lines
  const robots = await fetchText(`${origin}/robots.txt`, 8_000);
  if (robots) {
    for (const m of robots.matchAll(/^Sitemap:\s*(.+)$/gim)) {
      sitemapCandidates.push(m[1].trim());
    }
  }

  // 2. Common locations
  if (sitemapCandidates.length === 0) {
    sitemapCandidates.push(
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/wp-sitemap.xml`,
      `${origin}/sitemap-index.xml`,
      `${origin}/page-sitemap.xml`,
    );
  }

  const allUrls: string[] = [];
  let source = '(sitemap not found)';

  for (const sitemapUrl of sitemapCandidates.slice(0, 6)) {
    const xml = await fetchText(sitemapUrl);
    if (!xml) continue;

    source = sitemapUrl;

    if (xml.includes('<sitemapindex')) {
      // Nested sitemap index
      const childSitemaps = extractLocs(xml).filter(u => u.endsWith('.xml'));
      for (const child of childSitemaps.slice(0, 8)) {
        const childXml = await fetchText(child, 8_000);
        if (!childXml) continue;
        const pageUrls = extractLocs(childXml).filter(u => !u.endsWith('.xml'));
        allUrls.push(...pageUrls);
        if (allUrls.length >= maxPages * 4) break;
      }
    } else {
      // Direct sitemap
      const pageUrls = extractLocs(xml).filter(u => !u.endsWith('.xml'));
      allUrls.push(...pageUrls);
    }

    if (allUrls.length > 0) break;
  }

  // Fallback: just the homepage
  if (allUrls.length === 0) {
    allUrls.push(base);
    source = 'homepage only (no sitemap found)';
  }

  const unique = [...new Set(allUrls)]
    .filter(u => { try { return new URL(u).hostname === hostname; } catch { return false; } })
    .slice(0, maxPages);

  return { urls: unique, source };
}

// ── Single page quick audit ───────────────────────────────────────────────────

export async function quickAuditPage(url: string): Promise<QuickAuditResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BOT_UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  });

  const html = await res.text();
  const $ = load(html);

  const title   = $('title').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const h1Els   = $('h1').toArray();
  const h1      = h1Els[0] ? $(h1Els[0]).text().trim() : null;
  const h1Count = h1Els.length;

  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() ?? '{}');
      const t = json['@type'];
      if (t) schemaTypes.push(Array.isArray(t) ? t.join(',') : String(t));
    } catch {}
  });

  // Word count (clean)
  $('script,style,nav,footer,header,aside').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(' ').filter(w => w.length > 1).length;

  const urlObj    = new URL(url);
  let internalLinks = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    try { if (new URL(href, url).hostname === urlObj.hostname) internalLinks++; } catch {}
  });

  // Issues list
  const issues: string[] = [];
  if (!title)                              issues.push('Brak tytułu');
  else if (title.length < 30)             issues.push(`Tytuł za krótki (${title.length}ch)`);
  else if (title.length > 70)             issues.push(`Tytuł za długi (${title.length}ch)`);
  if (!metaDesc)                           issues.push('Brak meta opisu');
  else if (metaDesc.length < 100)         issues.push('Meta opis za krótki');
  if (!h1)                                 issues.push('Brak H1');
  else if (h1Count > 1)                   issues.push(`Wiele H1 (${h1Count})`);
  if (wordCount < 300)                     issues.push(`Thin content (${wordCount} słów)`);
  if (schemaTypes.length === 0)           issues.push('Brak schema.org');
  if (!url.startsWith('https'))           issues.push('Brak HTTPS');
  if (internalLinks < 2)                  issues.push('Mało linków wewn.');

  // Quick score
  let score = 0;
  if (title) score += (title.length >= 40 && title.length <= 65) ? 20 : 10;
  if (metaDesc && metaDesc.length >= 100) score += 15;
  if (h1 && h1Count === 1) score += 20;
  if (wordCount >= 500) score += 20;
  else if (wordCount >= 300) score += 10;
  if (schemaTypes.length > 0) score += 15;
  if (url.startsWith('https')) score += 10;

  return {
    url,
    statusCode: res.status,
    title,
    h1,
    h1Count,
    wordCount,
    hasMetaDesc: !!metaDesc,
    metaDescLength: metaDesc.length,
    hasSchema: schemaTypes.length > 0,
    schemaTypes,
    internalLinks,
    issues,
    score,
    path: urlObj.pathname,
  };
}

// ── Summary computation ───────────────────────────────────────────────────────

export function computeSummary(domain: string, results: QuickAuditResult[], totalUrls: number): DomainSummary {
  const scores = results.map(r => r.score);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const thinContent = results.filter(r => r.wordCount < 300).length;
  const noH1        = results.filter(r => !r.h1).length;
  const noMetaDesc  = results.filter(r => !r.hasMetaDesc).length;
  const noSchema    = results.filter(r => !r.hasSchema).length;
  const multiH1     = results.filter(r => r.h1Count > 1).length;

  // Issue frequency
  const issueMap: Record<string, number> = {};
  for (const r of results) {
    for (const issue of r.issues) {
      const key = issue.replace(/\(\d+[^)]*\)/g, '').trim();
      issueMap[key] = (issueMap[key] ?? 0) + 1;
    }
  }
  const topIssues = Object.entries(issueMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([issue, count]) => ({ issue, count }));

  // Group by URL path section
  const sections: Record<string, { count: number; avgScore: number; scores: number[] }> = {};
  for (const r of results) {
    const section = r.path.split('/').filter(Boolean)[0] ?? '(root)';
    if (!sections[section]) sections[section] = { count: 0, avgScore: 0, scores: [] };
    sections[section].count++;
    sections[section].scores.push(r.score);
  }
  const sectionsOut: Record<string, { count: number; avgScore: number }> = {};
  for (const [k, v] of Object.entries(sections)) {
    sectionsOut[k] = {
      count: v.count,
      avgScore: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
    };
  }

  const sorted = [...results].sort((a, b) => a.score - b.score);
  const worstPages = sorted.slice(0, 10).map(r => ({ url: r.url, score: r.score, issues: r.issues }));
  const bestPages  = [...results].sort((a, b) => b.score - a.score).slice(0, 5).map(r => ({ url: r.url, score: r.score }));

  return {
    domain,
    totalUrls,
    analyzed: results.length,
    avgScore,
    thinContent,
    noH1,
    noMetaDesc,
    noSchema,
    multiH1,
    topIssues,
    sections: sectionsOut,
    worstPages,
    bestPages,
  };
}
