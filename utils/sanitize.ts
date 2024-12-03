// utils/sanitize.ts
export function sanitizeString(input: string): string {
    return input
      .normalize('NFC') // Normalize Unicode characters
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
      .trim(); // Remove leading/trailing whitespace
  }
  