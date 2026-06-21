import { NextRequest, NextResponse } from 'next/server';
import { crawlUrl } from '@/lib/crawler';
import { analyzeSeo } from '@/lib/seo-analyzer';
import { analyzeEeat } from '@/lib/eeat-analyzer';
import { extractEntities, classifyTopics } from '@/lib/hf-client';

export async function POST(request: NextRequest) {
  let body: { url?: string; hfToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 });
  }

  const { url, hfToken } = body;
  if (!url) return NextResponse.json({ error: 'URL jest wymagany' }, { status: 400 });

  try {
    const crawl = await crawlUrl(url);
    const seo   = analyzeSeo(crawl);

    // E-E-A-T (uses unmodified $ from crawl)
    const schemaTypes = new Set(seo.technical.schema.map(s => s.type.toLowerCase().split(',')[0].trim()));
    const eeat = analyzeEeat(crawl.$, schemaTypes);

    // Overall: E-E-A-T has highest weight (modern Google)
    const overall = Math.round(
      seo.scores.technical    * 0.20 +
      seo.scores.content      * 0.15 +
      eeat.score              * 0.30 +
      seo.scores.contentDepth * 0.20 +
      seo.scores.pageExperience * 0.15
    );

    // HF NLP
    const nlpInput = [
      seo.technical.title.text,
      seo.technical.metaDescription.text,
      seo.headingsText.slice(0, 300),
      seo.bodyText.slice(0, 400),
    ].filter(Boolean).join(' ');

    const [entities, topics] = await Promise.all([
      extractEntities(nlpInput, hfToken).catch(() => []),
      classifyTopics(nlpInput, hfToken).catch(() => []),
    ]);

    return NextResponse.json({
      url,
      finalUrl:  crawl.url,
      crawledAt: new Date().toISOString(),
      statusCode: crawl.statusCode,
      scores: { overall, ...seo.scores, eeat: eeat.score },
      technical:    seo.technical,
      keywords:     seo.keywords,
      contentDepth: seo.contentDepth,
      pageExperience: seo.pageExperience,
      eeat,
      entities,
      topics,
      bodyText:    seo.bodyText,
      headingsText: seo.headingsText,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Błąd analizy';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
