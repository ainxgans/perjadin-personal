const SHARE_CACHE_NAME = 'perjadin-share-target';
const SHARED_PDF_KEY = '/_shared_pdf';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const rawFile = formData.get('file');
    const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;

    if (file && typeof file !== 'string') {
      const cache = await caches.open(SHARE_CACHE_NAME);
      const filename = file.name && file.name.trim() ? file.name.trim() : 'dokumen.pdf';
      const normalizedName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

      await cache.put(
        SHARED_PDF_KEY,
        new Response(file, {
          headers: {
            'Content-Type': file.type || 'application/pdf',
            'X-Shared-Filename': encodeURIComponent(normalizedName),
          },
        })
      );
      return Response.redirect('/trips/new?shared=1', 303);
    }
  } catch {
    // Fall through to default redirect if formData parsing fails
  }

  return Response.redirect('/trips/new', 303);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(event.request));
  }
});
