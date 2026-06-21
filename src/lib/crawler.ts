import { load, type CheerioAPI } from 'cheerio';

export interface CrawlResult {
  url: string;
  html: string;
  $: CheerioAPI;
  statusCode: number;
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(normalized, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SEOFanoutBot/1.0; +https://github.com/xsajdq/seo-fanout)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);
    const html = await res.text();
    const $ = load(html);

    return { url: res.url, html, $, statusCode: res.status };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Nieznany błąd';
    throw new Error(`Błąd pobierania strony: ${msg}`);
  }
}
