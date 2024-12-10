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

function normalizeUrl(url: string, base: string): string {
  try {
    const absoluteUrl = new URL(url, base).toString();
    return absoluteUrl.split('#')[0].replace(/\/$/, '');
  } catch (e) {
    console.warn('Invalid URL:', url);
    return url;
  }
}

async function fetchWithRetry(url: string, maxRetries = 2, delay = 500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 8000, // Reduced timeout for serverless
          maxRedirects: 3,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SiteAnalyzerBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          responseEncoding: 'utf8',
          responseType: 'text',
        });
  
        return response;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    throw new Error(`Failed after ${maxRetries} retries`);
}
  
export async function analyzeSiteStructure(domain: string, maxPages = 20, maxDepth = 2): Promise<SiteStructure> {
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
  
    const queue: { url: string; depth: number; parentUrl?: string }[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
    async function crawlPage(url: string, depth: number = 0, parentUrl?: string) {
      if (
        depth > maxDepth || 
        visitedUrls.size >= maxPages || 
        visitedUrls.has(url) ||
        !shouldCrawlUrl(url)
      ) {
        return;
      }
  
      try {
        console.log(`Crawling (${visitedUrls.size + 1}/${maxPages}):`, url);
        const response = await fetchWithRetry(url);
        
        if (!response.data) return;
  
        const dom = new JSDOM(response.data, {
          url,
          contentType: 'text/html; charset=utf-8',
          pretendToBeVisual: false,
          runScripts: 'outside-only'
        });
  
        const document = dom.window.document;
        visitedUrls.add(url);
  
        const links: PageLink[] = [];
        const processedUrls = new Set<string>();
  
        document.querySelectorAll('a[href]').forEach(anchor => {
          try {
            const href = anchor.getAttribute('href');
            if (!href) return;
  
            const absoluteUrl = new URL(href, url).toString();
            const safeUrl = mongoSafeUrl(absoluteUrl);
            
            if (!safeUrl || processedUrls.has(safeUrl) || !shouldCrawlUrl(safeUrl)) {
              return;
            }
            
            processedUrls.add(safeUrl);
            const isInternal = safeUrl.includes(domain);
  
            if (isInternal) {
              structure.internalLinks++;
              if (!visitedUrls.has(safeUrl)) {
                queue.push({
                  url: safeUrl,
                  depth: depth + 1,
                  parentUrl: url
                });
              }
            } else {
              structure.externalLinks++;
            }
  
            links.push({
              url: safeUrl,
              text: mongoSafeString(anchor.textContent),
              type: isInternal ? 'internal' : 'external'
            });
          } catch (e) {
            // Ignore invalid URLs
          }
        });
  
        structure.pages.push({
          url: mongoSafeUrl(url),
          title: mongoSafeString(document.title),
          links,
          level: depth,
          parentUrl: parentUrl ? mongoSafeUrl(parentUrl) : undefined,
          status: response.status
        });
  
        structure.maxDepth = Math.max(structure.maxDepth, depth);
        structure.totalPages = visitedUrls.size;

        // Clean up DOM to prevent memory leaks
        dom.window.close();
  
        if (queue.length > 0) {
          const next = queue.shift();
          if (next) {
            await delay(500); // Reduced delay for serverless
            await crawlPage(next.url, next.depth, next.parentUrl);
          }
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
      }
    }
  
    await crawlPage(baseUrl);
  
    while (queue.length > 0 && visitedUrls.size < maxPages) {
      const next = queue.shift();
      if (next) {
        await delay(500); // Reduced delay for serverless
        await crawlPage(next.url, next.depth, next.parentUrl);
      }
    }
  
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