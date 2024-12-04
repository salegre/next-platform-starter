import axios from 'axios';
import { JSDOM } from 'jsdom';
import { URL } from 'url';
import { sanitizeString } from './sanitize';

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

function shouldCrawlUrl(url: string): boolean {
  // Ignore common media and resource files
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
    // Ignore mailto: links
    if (parsedUrl.protocol === 'mailto:') return false;
    // Ignore hash-only changes to the same URL
    if (parsedUrl.hash && parsedUrl.pathname === '/') return false;
    const path = parsedUrl.pathname.toLowerCase();
    return !ignoreExtensions.some(ext => path.endsWith(ext));
  } catch (e) {
    return false;
  }
}

function normalizeUrl(url: string, base: string): string {
  try {
    const absoluteUrl = new URL(url, base).toString();
    // Remove hash and trailing slash
    return absoluteUrl.split('#')[0].replace(/\/$/, '');
  } catch (e) {
    console.warn('Invalid URL:', url);
    return url;
  }
}

async function fetchWithRetry(url: string, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteAnalyzerBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        },
        validateStatus: (status) => status < 500, // Accept any status below 500
      });

      // Handle redirects manually if needed
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        return fetchWithRetry(response.headers.location, maxRetries - 1);
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`);
}

export async function analyzeSiteStructure(domain: string, maxPages = 20, maxDepth = 3): Promise<SiteStructure> {
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

  // Rate limiting and queuing
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

      const dom = new JSDOM(response.data);
      const document = dom.window.document;
      visitedUrls.add(url);

      // Extract links
      const links: PageLink[] = [];
      const anchorTags = document.querySelectorAll('a[href]');
      const processedUrls = new Set<string>(); // Avoid duplicate links on same page
      
      anchorTags.forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (!href) return;

        try {
          const absoluteUrl = normalizeUrl(href, url);
          if (processedUrls.has(absoluteUrl)) return;
          processedUrls.add(absoluteUrl);

          if (!shouldCrawlUrl(absoluteUrl)) return;

          const isInternal = absoluteUrl.includes(domain);
          
          if (isInternal) {
            structure.internalLinks++;
            // Add to crawl queue if it's an internal link
            if (!visitedUrls.has(absoluteUrl)) {
              queue.push({ url: absoluteUrl, depth: depth + 1, parentUrl: url });
            }
          } else {
            structure.externalLinks++;
          }

          links.push({
            url: absoluteUrl,
            text: anchor.textContent?.trim() || '',
            type: isInternal ? 'internal' : 'external'
          });

        } catch (e) {
          console.warn(`Invalid URL found: ${href}`);
        }
      });

      // Add page to structure
      structure.pages.push({
        url,
        title: document.title || '',
        links,
        level: depth,
        parentUrl,
        status: response.status
      });

      structure.maxDepth = Math.max(structure.maxDepth, depth);
      structure.totalPages = visitedUrls.size;

      // Process queue with delay
      if (queue.length > 0) {
        const next = queue.shift();
        if (next) {
          await delay(1000); // 1 second delay between requests
          await crawlPage(next.url, next.depth, next.parentUrl);
        }
      }

    } catch (error) {
      const errorMsg = `Error crawling ${url}: ${error.message}`;
      console.error(errorMsg);
      structure.errors.push({
        url,
        error: error.message,
        status: error.response?.status
      });
      
      // Still add failed pages to structure with error info
      structure.pages.push({
        url,
        title: 'Error loading page',
        links: [],
        level: depth,
        parentUrl,
        status: error.response?.status,
        error: error.message
      });
    }
  }

  await crawlPage(baseUrl);

  // Process remaining queue
  while (queue.length > 0 && visitedUrls.size < maxPages) {
    const next = queue.shift();
    if (next) {
      await delay(1000);
      await crawlPage(next.url, next.depth, next.parentUrl);
    }
  }

  return structure;
}
