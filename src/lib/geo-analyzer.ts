import { load } from 'cheerio';
import type { GeoData, QABlock } from '@/types';

const Q_PL = new Set([
  'co', 'jak', 'czy', 'dlaczego', 'kiedy', 'gdzie', 'kto', 'ile', 'jaki', 'jaka',
  'jakie', 'skąd', 'po', 'które', 'który', 'która', 'czym', 'komu', 'czego',
]);
const Q_EN = new Set([
  'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'is', 'are',
  'do', 'does', 'should', 'will', 'would', 'have', 'has', 'was', 'were',
]);

function isQuestion(text: string): boolean {
  if (text.trim().endsWith('?')) return true;
  const first = text.toLowerCase().split(/\s+/)[0];
  return Q_PL.has(first) || Q_EN.has(first);
}

// Ideal direct answer: 40-80 words (per GEO research)
function scoreAnswerLength(words: number): boolean {
  return words >= 20 && words <= 100;
}

export function analyzeGeo(html: string, bodyText: string): GeoData {
  const $ = load(html);

  // ── Q&A blocks ────────────────────────────────────────────────────────────
  const qaBlocks: QABlock[] = [];

  $('h2,h3').each((_, el) => {
    const question = $(el).text().trim();
    if (!isQuestion(question)) return;

    // Find next paragraph — could be direct sibling or inside a wrapper div
    let nextP = $(el).next('p');
    if (!nextP.length) nextP = $(el).nextAll('p').first();
    if (!nextP.length) {
      // Look inside next sibling div
      const nextDiv = $(el).next('div,section');
      if (nextDiv.length) nextP = nextDiv.find('p').first();
    }

    if (!nextP.length) {
      qaBlocks.push({ question, answerWords: null, hasDirectAnswer: false, answerPreview: null });
      return;
    }

    const pText = nextP.text().trim();
    const answerWords = pText.split(/\s+/).filter(w => w.length > 0).length;
    const hasDirectAnswer = scoreAnswerLength(answerWords);
    const answerPreview = pText.length > 120 ? pText.slice(0, 120) + '…' : pText;

    qaBlocks.push({ question, answerWords, hasDirectAnswer, answerPreview });
  });

  // ── TL;DR / Podsumowanie ──────────────────────────────────────────────────
  const summaryKeywords = ['podsumowanie', 'w skrócie', 'tl;dr', 'summary', 'kluczowe punkty',
                           'key takeaways', 'najważniejsze', 'wnioski', 'conclusion'];
  const hasSummary =
    $('[class*="summary"],[class*="tldr"],[class*="podsumowanie"],[id*="summary"],[id*="tldr"],[id*="podsumowanie"]').length > 0 ||
    $('h2,h3,h4').toArray().some(el => {
      const t = $(el).text().toLowerCase();
      return summaryKeywords.some(k => t.includes(k));
    });

  // ── Statistics density ────────────────────────────────────────────────────
  // Research: 1 stat per 150-200 words = optimal for AI citation
  const statsRegex = /\d+[\s.,]?\d*\s*%|\b\d{4,}\b|\bwedług\b|\bwg\b|\bbadania\b|\bźródło:\b|\bstudy\b|\baccording to\b|\breport\b|\bstatystyki\b/gi;
  const statsMatches = bodyText.match(statsRegex) ?? [];
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;
  const statisticsDensity = wordCount > 0
    ? Math.round((statsMatches.length / wordCount) * 1000) / 10 // per 1000 words
    : 0;
  const hasStatistics = statsMatches.length >= 2;

  // ── Definitions ───────────────────────────────────────────────────────────
  const defPatterns = [
    /\b\w{3,}\s+to\s+(?:rodzaj|typ|forma|metoda|narzędzie|sposób|system|platforma|technika|strategia|proces|technologia)/gi,
    /\b\w{3,}\s+(?:jest|oznacza|definiuje się)\s+(?:to\s+)?(?:jako|przez|narzędziem|metodą|procesem)/gi,
    /\(ang\.\s|\(z\s+ang\./gi,
    /\bto\s+(?:skrót|akronim)\s+od\b/gi,
    /\bdefined as\b|\bterm(?:s)? refers? to\b/gi,
  ];
  const hasDefinitions = defPatterns.some(p => { p.lastIndex = 0; return p.test(bodyText); });

  // ── Comparison table ──────────────────────────────────────────────────────
  // Comparison tables get highly cited by AI systems
  const hasComparisonTable = $('table').toArray().some(el => {
    const tableText = $(el).text().toLowerCase();
    return tableText.includes('vs') || tableText.includes('porówn') || tableText.includes('zalet') || tableText.length > 100;
  });

  // ── First paragraph (intro conciseness) ──────────────────────────────────
  const introSelectors = 'main p, article p, .content p, .post-content p, .entry-content p, #content p';
  let firstPara = $(introSelectors).first();
  if (!firstPara.length) firstPara = $('p').first();
  const introText = firstPara.text().trim();
  const firstParaWords = introText.split(/\s+/).filter(w => w.length > 0).length;

  // ── GEO Score ─────────────────────────────────────────────────────────────
  // Based on research: Q&A format, stats, freshness signals, direct answers
  let score = 0;

  // Q&A format — most impactful (up to 35pts)
  if (qaBlocks.length > 0) {
    const answered = qaBlocks.filter(q => q.hasDirectAnswer).length;
    const ratio = answered / qaBlocks.length;
    score += Math.round(ratio * 30);
    if (qaBlocks.length >= 3) score += 5; // bonus for comprehensive coverage
  }

  if (hasSummary)          score += 15; // TL;DR = AI extracts this
  if (hasStatistics)       score += 15; // stats = credibility for AI citation
  if (hasDefinitions)      score += 10; // definitions = AI loves to cite
  if (hasComparisonTable)  score += 10; // comparison tables = high AI citation
  // First paragraph conciseness (ideal: 40-100 words)
  if (firstParaWords >= 30 && firstParaWords <= 120) score += 15;
  else if (firstParaWords > 0) score += 5;

  score = Math.min(100, score);

  return {
    qaBlocks,
    qaCount: qaBlocks.length,
    qaWithDirectAnswer: qaBlocks.filter(q => q.hasDirectAnswer).length,
    hasSummary,
    hasStatistics,
    statisticsDensity,
    hasDefinitions,
    hasComparisonTable,
    firstParaWords,
    score,
  };
}
