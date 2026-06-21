import type { Entity, Topic } from '@/types';

const HF_API = 'https://api-inference.huggingface.co/models';

async function hfPost(model: string, body: unknown, token?: string) {
  const res = await fetch(`${HF_API}/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`HF ${model}: ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json();
}

export async function extractEntities(text: string, token?: string): Promise<Entity[]> {
  try {
    const data = await hfPost(
      'Davlan/bert-base-multilingual-cased-ner-hrl',
      { inputs: text.slice(0, 512), parameters: { aggregation_strategy: 'simple' } },
      token
    );

    if (!Array.isArray(data)) return [];

    // deduplicate by text
    const seen = new Set<string>();
    const results: Entity[] = [];
    for (const e of data) {
      const key = String(e.word ?? '').toLowerCase();
      if (seen.has(key) || !key || Number(e.score ?? 0) < 0.6) continue;
      seen.add(key);
      results.push({
        text: String(e.word ?? '').trim(),
        type: String(e.entity_group ?? e.entity ?? 'MISC'),
        score: Math.round(Number(e.score ?? 0) * 100),
      });
    }
    return results.slice(0, 30);
  } catch (err) {
    console.warn('NER failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

const SEO_LABELS = [
  'E-commerce / Sklep',
  'Blog / Artykuł',
  'Strona firmowa / Usługi',
  'News / Aktualności',
  'Poradnik / Tutorial',
  'Produkt / Recenzja',
  'Local SEO',
  'Portfolio',
];

export async function classifyTopics(text: string, token?: string): Promise<Topic[]> {
  try {
    const data = await hfPost(
      'facebook/bart-large-mnli',
      {
        inputs: text.slice(0, 1024),
        parameters: { candidate_labels: SEO_LABELS, multi_label: true },
      },
      token
    );

    if (!data.labels || !data.scores) return [];

    return (data.labels as string[])
      .map((label: string, i: number) => ({
        label,
        score: Math.round((data.scores as number[])[i] * 100),
      }))
      .filter(t => t.score >= 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch (err) {
    console.warn('Classification failed:', err instanceof Error ? err.message : err);
    return [];
  }
}
