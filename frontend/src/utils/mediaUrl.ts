// Converts a /uploads/... path returned by the API into an absolute URL
// pointing at the backend. Works in both local dev and production (R2 URLs
// are already absolute and pass through unchanged).
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  // Already absolute (R2 presigned URL, https://, etc.)
  if (url.startsWith('http')) return url;
  // Relative /uploads/... — prefix with backend origin
  return `${BACKEND_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}
