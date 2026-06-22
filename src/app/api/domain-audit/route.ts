import { NextRequest } from 'next/server';
import { discoverUrls, quickAuditPage, computeSummary } from '@/lib/domain-auditor';
import { analyzeDomainGaps } from '@/lib/entity-gap-analyzer';
import type { QuickAuditResult } from '@/types';

const CONCURRENCY = 3;
const BATCH_DELAY = 400;

export async function GET(request: NextRequest) {
  const domain   = request.nextUrl.searchParams.get('domain') ?? '';
  const maxPages = Math.min(100, Math.max(5, parseInt(request.nextUrl.searchParams.get('max') ?? '30')));

  if (!domain) return new Response('Missing domain', { status: 400 });

  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      try {
        send({ type: 'status', message: 'Szukam sitemapy i URL-i…' });

        const { urls, source } = await discoverUrls(domain, maxPages);

        if (urls.length === 0) {
          send({ type: 'error', message: 'Nie znaleziono żadnych URL-i. Sprawdź czy domena jest publiczna i ma sitemapę.' });
          return;
        }

        send({ type: 'urls_found', count: urls.length, source });

        const results: QuickAuditResult[] = [];

        for (let i = 0; i < urls.length; i += CONCURRENCY) {
          const batch = urls.slice(i, i + CONCURRENCY);

          const settled = await Promise.allSettled(batch.map(u => quickAuditPage(u)));

          settled.forEach((r, j) => {
            const idx = i + j + 1;
            if (r.status === 'fulfilled') {
              results.push(r.value);
              // Strip bodyText — kept server-side for gap analysis, not sent to client
              const { bodyText: _bt, ...pageData } = r.value;
              send({ type: 'page_done', index: idx, total: urls.length, data: pageData });
            } else {
              send({ type: 'page_error', index: idx, total: urls.length, url: batch[j], error: String(r.reason?.message ?? 'timeout') });
            }
          });

          if (i + CONCURRENCY < urls.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY));
          }
        }

        // Phase 1 complete — send summary
        const summary = computeSummary(domain, results, urls.length);
        send({ type: 'done', summary });

        // Phase 2 — knowledge graph gap analysis (stream stays open)
        await analyzeDomainGaps(results, send);

      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Błąd audytu domeny' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
