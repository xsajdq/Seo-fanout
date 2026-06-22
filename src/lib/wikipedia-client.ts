const WIKI_API = {
  pl: 'https://pl.wikipedia.org/w/api.php',
  en: 'https://en.wikipedia.org/w/api.php',
};

const UA = 'SEOFanoutAnalyzer/1.0 (seo-analysis-tool)';

async function wikiGet(params: Record<string, string>, lang: 'pl' | 'en'): Promise<unknown> {
  const url = new URL(WIKI_API[lang]);
  Object.entries({ ...params, format: 'json', origin: '*' }).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  );
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(9_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function findWikiTitle(query: string, lang: 'pl' | 'en'): Promise<string | null> {
  const data = await wikiGet(
    { action: 'query', list: 'search', srsearch: query, srlimit: '3', srnamespace: '0' },
    lang
  ) as { query?: { search?: { title: string; snippet: string }[] } } | null;
  return data?.query?.search?.[0]?.title ?? null;
}

type PageLinksData = {
  query?: {
    pages?: Record<string, { links?: { title: string }[] }>;
  };
  continue?: { plcontinue?: string };
};

export async function getWikiLinks(title: string, lang: 'pl' | 'en'): Promise<string[]> {
  const links: string[] = [];
  let cont: string | undefined;

  for (let page = 0; page < 4; page++) {
    const params: Record<string, string> = {
      action: 'query', prop: 'links', titles: title,
      pllimit: '500', plnamespace: '0',
    };
    if (cont) params.plcontinue = cont;

    const data = await wikiGet(params, lang) as PageLinksData | null;
    if (!data?.query?.pages) break;

    const pageObj = Object.values(data.query.pages)[0];
    if (!pageObj?.links?.length) break;

    links.push(...pageObj.links.map(l => l.title));
    cont = data.continue?.plcontinue;
    if (!cont) break;
  }

  return links;
}

type PageCatsData = {
  query?: { pages?: Record<string, { categories?: { title: string }[] }> };
};

export async function getWikiCategories(title: string, lang: 'pl' | 'en'): Promise<string[]> {
  const data = await wikiGet(
    { action: 'query', prop: 'categories', titles: title, cllimit: '50', clshow: '!hidden' },
    lang
  ) as PageCatsData | null;

  const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
  return (page?.categories ?? [])
    .map(c => c.title.replace(/^(Kategoria|Category):/, '').trim())
    .filter(c => c.length > 2 && c.length < 60);
}

type ParseSectionsData = {
  parse?: { sections?: { line: string; level: string; toclevel: number }[] };
};

export async function getWikiSections(title: string, lang: 'pl' | 'en'): Promise<{ title: string; level: number }[]> {
  const data = await wikiGet(
    { action: 'parse', prop: 'sections', page: title },
    lang
  ) as ParseSectionsData | null;

  return (data?.parse?.sections ?? []).map(s => ({
    title: s.line.replace(/<[^>]+>/g, '').trim(),
    level: parseInt(s.level),
  }));
}

export async function getWikiSummary(title: string, lang: 'pl' | 'en'): Promise<string> {
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6_000) }
    );
    if (!res.ok) return '';
    const data = await res.json() as { extract?: string };
    return data.extract?.slice(0, 300) ?? '';
  } catch {
    return '';
  }
}
