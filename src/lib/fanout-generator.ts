import type { FanoutNode, FanoutResult } from '@/types';

interface ContentCtx {
  title: string;
  h1: string[];
  meta: string;
  body: string;
  headings: string[];
}

const TEMPLATES: Record<string, string[]> = {
  informational: [
    'co to jest {t}',
    'czym jest {t}',
    'jak działa {t}',
    'jak zacząć z {t}',
    '{t} dla początkujących',
    'dlaczego {t} jest ważne',
    'historia {t}',
    'rodzaje {t}',
    'zasady {t}',
    'przewodnik {t}',
    '{t} krok po kroku',
    'wszystko o {t}',
  ],
  commercial: [
    'najlepszy {t}',
    '{t} ranking {year}',
    '{t} porównanie',
    '{t} recenzja',
    '{t} opinie',
    'alternatywy dla {t}',
    '{t} vs inne rozwiązania',
    'jaki {t} wybrać',
    'polecany {t}',
    '{t} top 10',
    'najlepsze narzędzia {t}',
  ],
  transactional: [
    'kup {t}',
    '{t} cena',
    '{t} cennik',
    'darmowy {t}',
    '{t} za darmo',
    '{t} trial',
    '{t} pobierz',
    '{t} sklep',
    'zamów {t}',
  ],
  navigational: [
    '{t} oficjalna strona',
    '{t} dokumentacja',
    '{t} pomoc',
    '{t} kontakt',
    '{t} logowanie',
  ],
};

const INTENT_LABELS: Record<string, string> = {
  informational: '🔍 Informacyjne',
  commercial:    '🛒 Komercyjne',
  transactional: '💳 Transakcyjne',
  navigational:  '🧭 Nawigacyjne',
};

function fillTemplate(tpl: string, topic: string): string {
  return tpl.replace('{t}', topic).replace('{year}', String(new Date().getFullYear()));
}

function calcCoverage(query: string, ctx: ContentCtx): { score: number; matchedIn: string[] } {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return { score: 0, matchedIn: [] };

  const zones = [
    { name: 'tytuł', text: ctx.title.toLowerCase(), weight: 4 },
    { name: 'H1', text: ctx.h1.join(' ').toLowerCase(), weight: 3.5 },
    { name: 'nagłówki', text: ctx.headings.join(' ').toLowerCase(), weight: 3 },
    { name: 'meta', text: ctx.meta.toLowerCase(), weight: 2 },
    { name: 'treść', text: ctx.body.toLowerCase(), weight: 1 },
  ];

  const matchedIn: string[] = [];
  let totalWeight = 0;
  let hitWeight = 0;

  for (const zone of zones) {
    const hits = words.filter(w => zone.text.includes(w)).length;
    const ratio = hits / words.length;
    totalWeight += zone.weight;
    hitWeight += ratio * zone.weight;
    if (ratio > 0.3 && !matchedIn.includes(zone.name)) matchedIn.push(zone.name);
  }

  const raw = (hitWeight / totalWeight) * 100;
  return { score: Math.round(Math.min(100, raw)), matchedIn };
}

export function generateFanout(topic: string, ctx?: ContentCtx): FanoutResult {
  const tree: FanoutNode[] = [];
  let idx = 0;

  for (const [intent, templates] of Object.entries(TEMPLATES)) {
    const children: FanoutNode[] = templates.map((tpl, i) => {
      const query = fillTemplate(tpl, topic);
      const { score, matchedIn } = ctx ? calcCoverage(query, ctx) : { score: 0, matchedIn: [] };
      return {
        id: `${intent}-${i}`,
        query,
        intent: intent as FanoutNode['intent'],
        coverageScore: score,
        matchedIn,
      };
    });

    const avgScore = ctx
      ? Math.round(children.reduce((s, c) => s + c.coverageScore, 0) / children.length)
      : 0;

    tree.push({
      id: `group-${idx++}`,
      query: INTENT_LABELS[intent],
      intent: intent as FanoutNode['intent'],
      coverageScore: avgScore,
      matchedIn: [],
      children,
    });
  }

  const allChildren = tree.flatMap(n => n.children ?? []);
  const coverageOverall = ctx && allChildren.length > 0
    ? Math.round(allChildren.reduce((s, c) => s + c.coverageScore, 0) / allChildren.length)
    : 0;

  return { topic, tree, coverageOverall };
}
