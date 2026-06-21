export interface TechnicalData {
  title: { text: string; length: number };
  metaDescription: { text: string; length: number };
  canonical: string | null;
  robots: string | null;
  hasHttps: boolean;
  h1: string[];
  headings: { level: number; text: string }[];
  schema: { type: string }[];
  openGraph: Record<string, string>;
  wordCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  internalLinks: { url: string; text: string }[];
  externalLinks: { url: string; text: string }[];
  hreflang: { lang: string; url: string }[];
}

export interface Keyword {
  word: string;
  count: number;
  density: number;
  inTitle: boolean;
  inH1: boolean;
  inMeta: boolean;
}

export interface Entity {
  text: string;
  type: string;
  score: number;
}

export interface Topic {
  label: string;
  score: number;
}

export interface AnalysisResult {
  url: string;
  finalUrl: string;
  crawledAt: string;
  statusCode: number;
  scores: { overall: number; technical: number; content: number };
  technical: TechnicalData;
  keywords: Keyword[];
  entities: Entity[];
  topics: Topic[];
  bodyText: string;
  headingsText: string;
}

export interface FanoutNode {
  id: string;
  query: string;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  coverageScore: number;
  matchedIn: string[];
  children?: FanoutNode[];
}

export interface FanoutResult {
  topic: string;
  coverageOverall: number;
  tree: FanoutNode[];
}
