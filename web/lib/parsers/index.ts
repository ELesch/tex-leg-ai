/**
 * Bill Text Parsers
 *
 * Utilities for parsing Texas legislative bill text to extract
 * structural information, code references, and complexity metrics.
 *
 * @module parsers
 */

// Complexity Detector
export {
  detectComplexity,
  type BillComplexity,
  type BillPattern,
  type ComplexityResult,
} from './complexity-detector';

// Code Reference Parser
export {
  parseCodeReferences,
  type CodeReference,
} from './code-reference-parser';

// Article Parser
export {
  parseArticles,
  hasArticleStructure,
  countArticles,
  findArticleForSection,
  normalizeArticleNumber,
  type BillArticle,
} from './article-parser';
