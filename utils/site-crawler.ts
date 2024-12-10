import axios from 'axios';
import { JSDOM } from 'jsdom';
import { URL } from 'url';
import { sanitizeString, sanitizeText, sanitizeUrl, mongoSafeString, mongoSafeUrl } from './sanitize';

interface PageLink {
  url: string;
  text: string;
  type: 'internal' | 'external';
}

interface SiteStructure {
  pages: {
    url: string;
    title: string;
    links: PageLink[];
    level: number;
    parentUrl?: string;
    status?: number;
    error?: string;
  }[];
  totalPages: number;
  maxDepth: number;
  internalLinks: number;
  externalLinks: number;
  errors: {
    url: string;
    error: string;
    status?: number;
  }[];
}

// Serverless-optimized configuration
const CONFIG = {
  TIMEOUT: 5000,
  MAX_RETRIES: 1,
  RETRY_DELAY: 200,
  CONCURRENT_REQUESTS: 1,
  REQUEST_DELAY: 200
};

function normalizeUrl(url: string, base: string): string {
  try {
    const absoluteUrl = new URL(url, base).toString();
    return absoluteUrl.split('#')[0].replace(/\/$/, '');
  } catch (e) {
    console.warn('Invalid URL:', url);
    return '';
  }
}

async function fetchWithRetry(url: string): Promise<any> {
  let lastError;
  
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await axios.get(url, {
        timeout: CONFIG.TIMEOUT,
        maxRedirects: 2,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteAnalyzerBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        responseEncoding: 'utf8',
        responseType: 'text',
      });
    } catch (error) {
      lastError = error;
      if (attempt < CONFIG.MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      }
    }
  }
  
  throw lastError;
}

export async function analyzeSiteStructure(domain: string, maxPages = 5, maxDepth = 1): Promise<SiteStructure> {
  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
  const visitedUrls = new Set<string>();
  const structure: SiteStructure = {
    pages: [],
    totalPages: 0,
    maxDepth: 0,
    internalLinks: 0,
    externalLinks: 0,
    errors: []
  };

  async function processPage(url: string, depth: number = 0, parentUrl?: string) {
    if (depth > maxDepth || visitedUrls.size >= maxPages || visitedUrls.has(url)) {
      return;
    }

    visitedUrls.add(url);
    let dom: JSDOM | null = null;

    try {
      console.log(`Processing page ${visitedUrls.size}/${maxPages}:`, url);
      const response = await fetchWithRetry(url);
      
      dom = new JSDOM(response.data, {
        url,
        contentType: 'text/html',
        pretendToBeVisual: false,
        runScripts: 'outside-only'
      });

      const document = dom.window.document;
      const links: PageLink[] = [];
      const processedUrls = new Set<string>();
      const pagesToCrawl: string[] = [];

      document.querySelectorAll('a[href]').forEach(anchor => {
        try {
          const href = anchor.getAttribute('href');
          if (!href) return;

          const absoluteUrl = normalizeUrl(href, url);
          if (!absoluteUrl || processedUrls.has(absoluteUrl) || !shouldCrawlUrl(absoluteUrl)) {
            return;
          }

          processedUrls.add(absoluteUrl);
          const isInternal = absoluteUrl.includes(domain);

          if (isInternal) {
            structure.internalLinks++;
            if (!visitedUrls.has(absoluteUrl) && depth < maxDepth) {
              pagesToCrawl.push(absoluteUrl);
            }
          } else {
            structure.externalLinks++;
          }

          links.push({
            url: mongoSafeUrl(absoluteUrl),
            text: mongoSafeString(anchor.textContent || ''),
            type: isInternal ? 'internal' : 'external'
          });
        } catch (e) {
          // Skip invalid URLs
        }
      });

      structure.pages.push({
        url: mongoSafeUrl(url),
        title: mongoSafeString(document.title || ''),
        links,
        level: depth,
        parentUrl: parentUrl ? mongoSafeUrl(parentUrl) : undefined,
        status: response.status
      });

      structure.maxDepth = Math.max(structure.maxDepth, depth);
      structure.totalPages = visitedUrls.size;

      // Process child pages sequentially
      for (const nextUrl of pagesToCrawl) {
        if (visitedUrls.size >= maxPages) break;
        await new Promise(resolve => setTimeout(resolve, CONFIG.REQUEST_DELAY));
        await processPage(nextUrl, depth + 1, url);
      }

    } catch (error) {
      structure.errors.push({
        url: mongoSafeUrl(url),
        error: mongoSafeString(error.message),
        status: error.response?.status
      });

      structure.pages.push({
        url: mongoSafeUrl(url),
        title: 'Error loading page',
        links: [],
        level: depth,
        parentUrl: parentUrl ? mongoSafeUrl(parentUrl) : undefined,
        status: error.response?.status,
        error: mongoSafeString(error.message)
      });
    } finally {
      if (dom) {
        dom.window.close();
      }
    }
  }

  await processPage(baseUrl);
  return structure;
}

function shouldCrawlUrl(url: string): boolean {
  const ignoreExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
    '.zip', '.rar', '.tar', '.gz',
    '.css', '.js', '.json', '.xml',
    '.woff', '.woff2', '.ttf', '.eot'
  ];
  
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'mailto:') return false;
    if (parsedUrl.hash && parsedUrl.pathname === '/') return false;
    const path = parsedUrl.pathname.toLowerCase();
    return !ignoreExtensions.some(ext => path.endsWith(ext));
  } catch (e) {
    return false;
  }
}