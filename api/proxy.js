// Vercel serverless function: same-origin forwarder for AI relays that
// don't send CORS headers for browser calls. The browser talks to
// /api/proxy on THIS site (same origin, no CORS involved); this function
// forwards the request server-side, where CORS does not apply.
//
// Deliberately narrow, not an open proxy:
// - POST to completion paths (…/v1/messages, …/chat/completions)
//   and GET to model listings (…/models) only
// - https targets only
// - only auth/content headers are forwarded

export const config = { maxDuration: 60 }

const ALLOWED_POST = /\/(v1\/messages|chat\/completions)$/
const ALLOWED_GET = /\/models$/
const FORWARD_HEADERS = ['content-type', 'authorization', 'x-api-key', 'anthropic-version']

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: { message: 'GET or POST only' } })
    return
  }
  let target
  try {
    target = new URL(String(req.query.url ?? ''))
  } catch {
    res.status(400).json({ error: { message: 'invalid target url' } })
    return
  }
  const allowed = req.method === 'POST' ? ALLOWED_POST : ALLOWED_GET
  if (target.protocol !== 'https:' || !allowed.test(target.pathname)) {
    res.status(400).json({ error: { message: 'target not allowed' } })
    return
  }

  const headers = {}
  for (const h of FORWARD_HEADERS) {
    if (req.headers[h]) headers[h] = req.headers[h]
  }

  let upstream
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body:
        req.method === 'POST'
          ? typeof req.body === 'string'
            ? req.body
            : JSON.stringify(req.body ?? {})
          : undefined,
    })
  } catch (e) {
    res.status(502).json({ error: { message: `upstream unreachable: ${e?.message ?? e}` } })
    return
  }

  res.status(upstream.status)
  res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
  if (!upstream.body) {
    res.end()
    return
  }
  // Pipe the body through so SSE streaming survives the hop.
  const { Readable } = await import('node:stream')
  Readable.fromWeb(upstream.body).pipe(res)
}
