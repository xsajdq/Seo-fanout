import { NextRequest, NextResponse } from 'next/server';
import { generateFanout } from '@/lib/fanout-generator';
import type { AnalysisResult } from '@/types';

export async function POST(request: NextRequest) {
  let body: { topic?: string; analysis?: AnalysisResult };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 });
  }

  const { topic, analysis } = body;
  if (!topic) return NextResponse.json({ error: 'Temat jest wymagany' }, { status: 400 });

  const ctx = analysis
    ? {
        title: analysis.technical.title.text,
        h1: analysis.technical.h1,
        meta: analysis.technical.metaDescription.text,
        body: analysis.bodyText ?? '',
        headings: analysis.technical.headings.map(h => h.text),
      }
    : undefined;

  const result = generateFanout(topic, ctx);
  return NextResponse.json(result);
}
