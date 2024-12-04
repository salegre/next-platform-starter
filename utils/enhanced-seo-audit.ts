import { analyzeSiteStructure } from './site-crawler';
import axios from 'axios';
import { JSDOM } from 'jsdom';

interface AuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  url?: string;
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

// Configurable constants
const CONFIG = {
  TIMEOUT: 15000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  BATCH_SIZE: 3,
  BATCH_DELAY: 2000
};

// Helper function to handle retries
async function fetchWithRetry(url: string, retries = CONFIG.MAX_RETRIES): Promise<any> {
  try {
    return await axios.get(url, {
      timeout: CONFIG.TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      maxRedirects: 5
    });
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}

// Function to audit a single page
async function auditPage(page: { url: string }): Promise<AuditResult[]> {
  const pageResults: AuditResult[] = [];
  
  try {
    console.log(`Auditing page: ${page.url}`);
    const response = await fetchWithRetry(page.url);
    
    const dom = new JSDOM(response.data, {
      url: page.url,
      runScripts: 'outside-only',
      resources: 'usable'
    });

    const document = dom.window.document;

    // Title checks
    const title = document.querySelector('title')?.textContent;
    if (!title) {
      pageResults.push({
        type: 'meta',
        severity: 'error',
        message: 'Missing title tag',
        url: page.url
      });
    } else if (title.length < 10 || title.length > 60) {
      pageResults.push({
        type: 'meta',
        severity: 'warning',
        message: 'Non-optimal title length',
        details: `Length: ${title.length} chars. Recommended: 10-60 chars.`,
        url: page.url
      });
    }

    // Meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');
    if (!metaDescription) {
      pageResults.push({
        type: 'meta',
        severity: 'warning',
        message: 'Missing meta description',
        url: page.url
      });
    }

    // Heading structure
    const h1Tags = document.querySelectorAll('h1');
    if (h1Tags.length === 0) {
      pageResults.push({
        type: 'content',
        severity: 'error',
        message: 'Missing H1 tag',
        url: page.url
      });
    } else if (h1Tags.length > 1) {
      pageResults.push({
        type: 'content',
        severity: 'warning',
        message: 'Multiple H1 tags',
        details: `Found ${h1Tags.length} H1 tags`,
        url: page.url
      });
    }

    // Image optimization
    const images = document.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(img => !img.hasAttribute('alt'));
    if (imagesWithoutAlt.length > 0) {
      pageResults.push({
        type: 'content',
        severity: 'warning',
        message: 'Images missing alt text',
        details: `${imagesWithoutAlt.length} images found without alt attributes`,
        url: page.url
      });
    }

    // Clean up DOM to prevent memory leaks
    dom.window.close();

    return pageResults;
  } catch (error) {
    console.error(`Error auditing ${page.url}:`, error);
    return [{
      type: 'error',
      severity: 'error',
      message: 'Failed to audit page',
      details: error.message,
      url: page.url
    }];
  }
}

export async function performSitewideAudit(domain: string): Promise<SitewideAuditResult> {
  console.log('Starting sitewide audit for:', domain);
  
  try {
    const siteStructure = await analyzeSiteStructure(domain);
    const pageAudits: { [url: string]: AuditResult[] } = {};
    const globalIssues: AuditResult[] = [];

    // Check global site structure
    if (siteStructure.maxDepth > 4) {
      globalIssues.push({
        type: 'structure',
        severity: 'warning',
        message: 'Site structure too deep',
        details: `Maximum depth of ${siteStructure.maxDepth} levels found. Recommended: 4 or fewer levels.`
      });
    }

    if (siteStructure.totalPages === 0) {
      globalIssues.push({
        type: 'structure',
        severity: 'error',
        message: 'No pages accessible',
        details: 'The crawler was unable to access any pages. Check site availability and robots.txt settings.'
      });
    }

    // Process pages in batches to prevent overwhelming the server
    for (let i = 0; i < siteStructure.pages.length; i += CONFIG.BATCH_SIZE) {
      const batch = siteStructure.pages.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(`Processing batch ${i / CONFIG.BATCH_SIZE + 1}/${Math.ceil(siteStructure.pages.length / CONFIG.BATCH_SIZE)}`);
      
      const batchResults = await Promise.all(
        batch.map(page => auditPage(page))
      );

      // Store results for this batch
      batch.forEach((page, index) => {
        pageAudits[page.url] = batchResults[index];
      });

      // Add delay between batches unless it's the last batch
      if (i + CONFIG.BATCH_SIZE < siteStructure.pages.length) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
      }
    }

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