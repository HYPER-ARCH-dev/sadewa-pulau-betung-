/**
 * Robust Printing Helper for React Apps & iFrames
 * Creates an isolated hidden iframe with clean styles to trigger reliable print/PDF dialog.
 */
export const printElement = (elementId: string, documentTitle: string = 'Dokumen Desa Pulau Betung') => {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  const contentHtml = element.innerHTML;
  printRawHtml(contentHtml, documentTitle);
};

export const printRawHtml = (htmlContent: string, documentTitle: string = 'Dokumen Desa Pulau Betung') => {
  // Try using isolated hidden iframe for clean 100% compatible print
  let iframe = document.getElementById('app-print-frame') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'app-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>${documentTitle}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          background: #ffffff !important;
          color: #0f172a !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 12px;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        .avoid-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media print {
          body {
            background: #ffffff !important;
          }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `);
  doc.close();

  // Wait for Tailwind / styles to render then print
  setTimeout(() => {
    try {
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } else {
        window.print();
      }
    } catch (e) {
      console.warn('Iframe print fallback to window.print', e);
      window.print();
    }
  }, 400);
};
