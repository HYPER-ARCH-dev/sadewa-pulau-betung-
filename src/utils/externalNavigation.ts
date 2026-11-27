/**
 * Membuka tautan eksternal (misal WhatsApp deep link / Google Maps) tanpa `window.open`
 * agar lebih aman di dalam iFrame, WebView PWA, dan browser seluler.
 */
export function openExternalLink(url: string): void {
  if (typeof document === 'undefined' || !url) return;
  const trimmed = url.trim();
  if (
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('mailto:') &&
    !trimmed.startsWith('tel:')
  ) {
    return;
  }

  const link = document.createElement('a');
  link.href = trimmed;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
