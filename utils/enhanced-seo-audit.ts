import { analyzeSiteStructure } from './site-crawler';
import axios from 'axios';
import { JSDOM } from 'jsdom';

interface AuditProgress {
  totalPages: number;
  pagesAudited: number;
  currentPage: string;
  status: 'running' | 'complete' | 'error';
}

interface AuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  url?: string;
}

interface AuditChunkResult {
  results: {
    [url: string]: AuditResult[];
  };
  progress: AuditProgress;
}

interface SitewideAuditResult {
  siteStructure: {
    totalPages: number;
    maxDepth: number;
    internalLinks: number;
    externalLinks: number;
  };
  pageAudits: {
    [url: string]: AuditResult[];
  };
  globalIssues: AuditResult[];
}

// Optimized configuration for serverless environment
const CONFIG = {
  CHUNK_SIZE: 3,        // Number of pages per chunk
  TIMEOUT: 8000,        // Keeping under Netlify's 10s limit
  MAX_RETRIES: 1,
  RETRY_DELAY: 200,
  MAX_PAGES: 15,        // Total pages to audit
  MAX_DEPTH: 2
};

async function auditPageChunk(pages: string[], progress: AuditProgress): Promise<AuditChunkResult> {
  const results: { [url: string]: AuditResult[] } = {};
  
  for (const url of pages) {
    try {
      progress.currentPage = url;
      const pageResults = await auditSinglePage(url);
      results[url] = pageResults;
      progress.pagesAudited++;
    } catch (error) {
      results[url] = [{
        type: 'error',
        severity: 'error',
        message: 'Failed to audit page',
        details: error.message,
        url
      }];
    }
  }

  return { results, progress };
}

async function auditSinglePage(url: string): Promise<AuditResult[]> {
  const results: AuditResult[] = [];
  let dom: JSDOM | null = null;

  try {
    const response = await axios.get(url, {
      timeout: CONFIG.TIMEOUT / 2,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
        'Accept': 'text/html'
      }
    });

    dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Essential SEO checks
    checkMetaTags(document, results, url);
    checkHeadings(document, results, url);
    checkImages(document, results, url);
    checkCanonical(document, results, url);

    return results;
  } catch (error) {
    throw new Error(`Audit failed for ${url}: ${error.message}`);
  } finally {
    if (dom) dom.window.close();
  }
}

function checkMetaTags(document: Document, results: AuditResult[], url: string) {
  const title = document.querySelector('title')?.textContent;
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');

  if (!title) {
    results.push({
      type: 'meta',
      severity: 'error',
      message: 'Missing title tag',
      url
    });
  }

  if (!metaDescription) {
    results.push({
      type: 'meta',
      severity: 'warning',
      message: 'Missing meta description',
      url
    });
  }
}

function checkHeadings(document: Document, results: AuditResult[], url: string) {
  const h1s = document.querySelectorAll('h1');
  if (h1s.length === 0) {
    results.push({
      type: 'content',
      severity: 'error',
      message: 'Missing H1 tag',
      url
    });
  } else if (h1s.length > 1) {
    results.push({
      type: 'content',
      severity: 'warning',
      message: `Multiple H1 tags found (${h1s.length})`,
      url
    });
  }
}

function checkImages(document: Document, results: AuditResult[], url: string) {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    if (!img.getAttribute('alt')) {
      results.push({
        type: 'accessibility',
        severity: 'warning',
        message: 'Image missing alt text',
        details: `Image: ${img.getAttribute('src')}`,
        url
      });
    }
  });
}

function checkCanonical(document: Document, results: AuditResult[], url: string) {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    results.push({
      type: 'meta',
      severity: 'warning',
      message: 'Missing canonical tag',
      url
    });
  }
}

export async function performSitewideAudit(domain: string): Promise<SitewideAuditResult> {
  console.log('Starting chunked sitewide audit for:', domain);
  
  try {
    // First, get the site structure
    const siteStructure = await analyzeSiteStructure(domain, CONFIG.MAX_PAGES, CONFIG.MAX_DEPTH);
    
    const progress: AuditProgress = {
      totalPages: siteStructure.pages.length,
      pagesAudited: 0,
      currentPage: '',
      status: 'running'
    };

    const pageAudits: { [url: string]: AuditResult[] } = {};
    const globalIssues: AuditResult[] = [];

    // Split pages into chunks
    const pages = siteStructure.pages.map(p => p.url);
    const chunks = [];
    for (let i = 0; i < pages.length; i += CONFIG.CHUNK_SIZE) {
      chunks.push(pages.slice(i, i + CONFIG.CHUNK_SIZE));
    }

    // Process chunks sequentially
    for (const chunk of chunks) {
      const chunkResult = await auditPageChunk(chunk, progress);
      Object.assign(pageAudits, chunkResult.results);
    }

    // Add global structure issues
    if (siteStructure.maxDepth > 3) {
      globalIssues.push({
        type: 'structure',
        severity: 'warning',
        message: 'Site structure too deep',
        details: `Maximum depth of ${siteStructure.maxDepth} levels found. Recommended: 3 or fewer levels.`
      });
    }

    progress.status = 'complete';

    return {
      siteStructure: {
        totalPages: siteStructure.totalPages,
        maxDepth: siteStructure.maxDepth,
        internalLinks: siteStructure.internalLinks,
        externalLinks: siteStructure.externalLinks
      },
      pageAudits,
      globalIssues
    };
    
  } catch (error) {
    console.error('Sitewide audit failed:', error);
    throw new Error(`Failed to complete sitewide audit: ${error.message}`);
  }
}