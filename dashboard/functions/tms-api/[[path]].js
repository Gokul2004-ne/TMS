export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight cleanly
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-User-Id',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const reqUrl = new URL(request.url);
  // Strip leading /tms-api prefix to support both /tms-api/* on frccind and /* on VPS IP
  const subPath = reqUrl.pathname.replace(/^\/tms-api/, '') || '/';
  const targets = [
    `https://frccind.com/tms-api${subPath}${reqUrl.search}`,
    `http://187.127.207.41:8080${subPath}${reqUrl.search}`,
  ];

  // Forward safe headers without sending Cloudflare's Host/Origin to Hostinger Nginx
  const forwardHeaders = new Headers();
  const accept = request.headers.get('Accept');
  if (accept) forwardHeaders.set('Accept', accept);
  const contentType = request.headers.get('Content-Type');
  if (contentType) forwardHeaders.set('Content-Type', contentType);
  const auth = request.headers.get('Authorization');
  if (auth) forwardHeaders.set('Authorization', auth);
  const xUserId = request.headers.get('X-User-Id');
  if (xUserId) forwardHeaders.set('X-User-Id', xUserId);
  forwardHeaders.set('User-Agent', 'TMS-Cloudflare-Proxy/1.0');

  let bodyBytes = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    bodyBytes = await request.arrayBuffer();
  }

  let lastError = null;
  for (const upstreamUrl of targets) {
    try {
      const upstreamResp = await fetch(upstreamUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: bodyBytes,
      });

      // Retry next upstream only on server/gateway errors
      if (upstreamResp.status >= 502 && upstreamUrl === targets[0]) {
        continue;
      }

      const respHeaders = new Headers(upstreamResp.headers);
      respHeaders.delete('Access-Control-Allow-Origin');
      respHeaders.delete('Access-Control-Allow-Credentials');
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      lastError = err;
    }
  }

  return new Response(
    JSON.stringify({
      error: 'Upstream Hostinger backend unreachable from Cloudflare proxy',
      detail: lastError ? String(lastError) : 'Unknown network error',
    }),
    {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
