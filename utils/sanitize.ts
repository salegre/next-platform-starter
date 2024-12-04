// utils/sanitize.ts
export function sanitizeString(input: string): string {
    return input
      .normalize('NFC') // Normalize Unicode characters
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
      .trim(); // Remove leading/trailing whitespace
  }

  export function sanitizeText(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .normalize('NFKD')  // Decompose characters into base + diacritic
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '') // Keep only basic Latin and extended Latin-1
      .trim();
  }
  
  export function sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Encode path segments while preserving slashes
      const encodedPath = urlObj.pathname
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
      urlObj.pathname = encodedPath;
      return urlObj.toString();
    } catch (e) {
      console.warn('Invalid URL during sanitization:', url);
      return url;
    }
  }
  
  // Add these sanitization functions at the top
export function mongoSafeString(text: string | null | undefined): string {
    if (!text) return '';
    try {
      return text
        .normalize('NFKD')  // Decompose characters
        .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
        .replace(/[^\x00-\x7F]/g, '')     // Remove non-ASCII
        .replace(/[\x00-\x1F\x7F]/g, '')  // Remove control characters
        .replace(/[&<>"'`]/g, '')         // Remove HTML special chars
        .trim();
    } catch (error) {
      console.error('Sanitization error:', error);
      return '';
    }
  }
  
  export function mongoSafeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.toString()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
    } catch (error) {
      console.error('URL sanitization error:', error);
      return url.replace(/[^\x20-\x7E]/g, '').trim();
    }
  }