import axios, { AxiosError } from 'axios';
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
    // Remove hash and trailing slash
    return absoluteUrl.split('#')[0].replace(/\/$/, '');
  } catch (e) {
    console.warn('Invalid URL:', url);
    return '';
  }
}

async function fetchWithRetry(url: string, maxRetries = 3, initialDelay = 1000): Promise<any> {
  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} for ${url}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await axios.get(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteAnalyzerBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });

      clearTimeout(timeout);
      return response;
    } catch (error) {
      lastError = error as Error;
      
      if (axios.isAxiosError(error)) {
        // Don't retry on certain error types
        if (error.response?.status === 404 || 
            error.response?.status === 401 || 
            error.response?.status === 403) {
          throw error;
        }
      }

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Double the delay for next attempt
    }
  }

  throw lastError;
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
    if (parsedUrl.protocol === 'mailto:' || parsedUrl.protocol === 'tel:') return false;
    if (parsedUrl.hash && parsedUrl.pathname === '/') return false;
    const path = parsedUrl.pathname.toLowerCase();
    return !ignoreExtensions.some(ext => path.endsWith(ext));
  } catch (e) {
    return false;
  }
}

export async function analyzeSiteStructure(domain: string, maxPages = 20, maxDepth = 3): Promise<SiteStructure> {
  console.log('Starting site structure analysis for:', domain);
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
      
      if (!response.data) {
        throw new Error('Empty response received');
      }

      const dom = new JSDOM(response.data, {
        url,
        contentType: 'text/html',
      });

      const document = dom.window.document;
      visitedUrls.add(url);

      // Extract links
      const links: PageLink[] = [];
      const anchorTags = document.querySelectorAll('a[href]');
      const processedUrls = new Set<string>();

      anchorTags.forEach(anchor => {
        try {
          const href = anchor.getAttribute('href');
          if (!href) return;

          const absoluteUrl = normalizeUrl(href, url);
          if (!absoluteUrl || processedUrls.has(absoluteUrl)) {
            return;
          }
          
          processedUrls.add(absoluteUrl);
          const isInternal = absoluteUrl.includes(domain);

          if (isInternal) {
            structure.internalLinks++;
            if (!visitedUrls.has(absoluteUrl) && shouldCrawlUrl(absoluteUrl)) {
              queue.push({
                url: absoluteUrl,
                depth: depth + 1,
                parentUrl: url
              });
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
          console.warn('Error processing link:', e);
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

    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      const errorDetails = axios.isAxiosError(error) 
        ? `${error.message} (Status: ${error.response?.status || 'unknown'})`
        : error.message;

      structure.errors.push({
        url: mongoSafeUrl(url),
        error: mongoSafeString(errorDetails),
        status: axios.isAxiosError(error) ? error.response?.status : undefined
      });
      
      structure.pages.push({
        url: mongoSafeUrl(url),
        title: 'Error loading page',
        links: [],
        level: depth,
        parentUrl: parentUrl ? mongoSafeUrl(parentUrl) : undefined,
        error: mongoSafeString(errorDetails)
      });
    }
  }

  // Start with the base URL
  await crawlPage(baseUrl);

  // Process queue with delay between requests
  while (queue.length > 0 && visitedUrls.size < maxPages) {
    const next = queue.shift();
    if (next) {
      await delay(1000); // 1 second delay between requests
      await crawlPage(next.url, next.depth, next.parentUrl);
    }
  }

  return structure;
}