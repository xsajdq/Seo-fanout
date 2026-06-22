import { NextRequest, NextResponse } from 'next/server';
import { crawlUrl } from '@/lib/crawler';
import { analyzeSeo } from '@/lib/seo-analyzer';
import { analyzeEeat } from '@/lib/eeat-analyzer';
import { extractEntities, classifyTopics } from '@/lib/hf-client';
import { analyzeEntityGap } from '@/lib/entity-gap-analyzer';

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

    const schemaTypes = new Set(
      seo.technical.schema.map(s => s.type.toLowerCase().split(',')[0].trim())
    );
    const eeat = analyzeEeat(crawl.$, schemaTypes);

    // Weighted overall — GEO and E-E-A-T are most important in 2026
    const overall = Math.round(
      seo.scores.technical      * 0.15 +
      seo.scores.content        * 0.10 +
      eeat.score                * 0.25 +
      seo.scores.contentDepth   * 0.15 +
      seo.scores.pageExperience * 0.10 +
      seo.scores.geo            * 0.25
    );

    const nlpInput = [
      seo.technical.title.text,
      seo.technical.metaDescription.text,
      seo.headingsText.slice(0, 300),
      seo.bodyText.slice(0, 400),
    ].filter(Boolean).join(' ');

    const gapTopic = seo.technical.title.text || seo.technical.h1[0] || '';
    const pageHeadings = seo.technical.headings.map(h => h.text);

    const [entities, topics, entityGap] = await Promise.all([
      extractEntities(nlpInput, hfToken).catch(() => []),
      classifyTopics(nlpInput, hfToken).catch(() => []),
      analyzeEntityGap(gapTopic, seo.bodyText, pageHeadings).catch(() => null),
    ]);

    return NextResponse.json({
      url,
      finalUrl:   crawl.url,
      crawledAt:  new Date().toISOString(),
      statusCode: crawl.statusCode,
      scores: {
        overall,
        ...seo.scores,
        eeat: eeat.score,
      },
      technical:     seo.technical,
      keywords:      seo.keywords,
      contentDepth:  seo.contentDepth,
      pageExperience: seo.pageExperience,
      geo:           seo.geo,
      eeat,
      entityGap,
      entities,
      topics,
      bodyText:      seo.bodyText,
      headingsText:  seo.headingsText,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Błąd analizy';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
