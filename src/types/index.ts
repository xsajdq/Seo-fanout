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

// ── E-E-A-T ──────────────────────────────────────────────────────────────────

export interface EeatData {
  author: {
    detected: boolean;
    name: string | null;
    inSchema: boolean;
    inHtml: boolean;
    profileLink: string | null;
  };
  dates: {
    published: string | null;
    modified: string | null;
  };
  trust: {
    about: boolean;
    contact: boolean;
    privacy: boolean;
    terms: boolean;
  };
  nap: {
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  schemaGaps: {
    hasFaq: boolean;
    faqContentDetected: boolean;
    hasHowTo: boolean;
    howToContentDetected: boolean;
    hasBreadcrumb: boolean;
    hasArticle: boolean;
    hasOrganization: boolean;
    suggestions: string[];
  };
  score: number;
}

// ── Content Depth ─────────────────────────────────────────────────────────────

export interface ContentDepth {
  questionHeadings: string[];
  hasFaqSection: boolean;
  hasOrderedList: boolean;
  hasUnorderedList: boolean;
  hasTable: boolean;
  hasBlockquote: boolean;
  hasVideoEmbed: boolean;
  paragraphCount: number;
  avgParagraphWords: number;
  score: number;
}

// ── Page Experience ───────────────────────────────────────────────────────────

export interface PageExperience {
  hasViewportMeta: boolean;
  images: {
    total: number;
    modernFormat: number;
    lazyLoaded: number;
    withDimensions: number;
  };
  scripts: {
    total: number;
    blocking: number;
    asyncCount: number;
    deferCount: number;
  };
  hasPreload: boolean;
  hasPreconnect: boolean;
  score: number;
}

// ── GEO / AEO ────────────────────────────────────────────────────────────────

export interface QABlock {
  question: string;
  answerWords: number | null;
  hasDirectAnswer: boolean;
  answerPreview: string | null;
}

export interface GeoData {
  qaBlocks: QABlock[];
  qaCount: number;
  qaWithDirectAnswer: number;
  hasSummary: boolean;
  hasStatistics: boolean;
  statisticsDensity: number;
  hasDefinitions: boolean;
  hasComparisonTable: boolean;
  firstParaWords: number;
  score: number;
}

// ── Domain Audit ──────────────────────────────────────────────────────────────

export interface QuickAuditResult {
  url: string;
  statusCode: number;
  title: string;
  h1: string | null;
  h1Count: number;
  wordCount: number;
  hasMetaDesc: boolean;
  metaDescLength: number;
  hasSchema: boolean;
  schemaTypes: string[];
  internalLinks: number;
  issues: string[];
  score: number;
  path: string;
}

export interface CannibalizationPair {
  urlA: string;
  urlB: string;
  titleA: string;
  titleB: string;
  overlap: number;
  sharedKeywords: string[];
}

export interface DomainSummary {
  domain: string;
  totalUrls: number;
  analyzed: number;
  avgScore: number;
  thinContent: number;
  noH1: number;
  noMetaDesc: number;
  noSchema: number;
  multiH1: number;
  topIssues: { issue: string; count: number }[];
  sections: Record<string, { count: number; avgScore: number }>;
  worstPages: { url: string; score: number; issues: string[] }[];
  bestPages:  { url: string; score: number }[];
  cannibalization: CannibalizationPair[];
}

// ── Knowledge Graph / Entity Gap ──────────────────────────────────────────────

export interface WikiConcept {
  title: string;
  covered: boolean;
  url: string;
}

export interface EntityGap {
  topic: string;
  wikiArticle: string | null;
  wikiLang: 'pl' | 'en' | null;
  wikiSummary: string;
  categories: string[];
  coveredConcepts: WikiConcept[];
  missingConcepts: WikiConcept[];
  coverageScore: number;
  totalConcepts: number;
  allSections: string[];
  coveredSections: string[];
  missingSections: string[];
}

// ── Main result ───────────────────────────────────────────────────────────────

export interface AnalysisResult {
  url: string;
  finalUrl: string;
  crawledAt: string;
  statusCode: number;
  scores: {
    overall: number;
    technical: number;
    content: number;
    eeat: number;
    contentDepth: number;
    pageExperience: number;
    geo: number;
  };
  technical: TechnicalData;
  keywords: Keyword[];
  entities: Entity[];
  topics: Topic[];
  eeat: EeatData;
  contentDepth: ContentDepth;
  pageExperience: PageExperience;
  geo: GeoData;
  entityGap: EntityGap;
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
