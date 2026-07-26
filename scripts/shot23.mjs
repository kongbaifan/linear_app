// CORS proxy e2e: a relay that blocks browser calls works through the
// same-origin /api/proxy — auto-probe on test, auto-enable, proxy badge,
// chat and agent delegation both routed through the proxy.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'
import http from 'http'
import fs from 'fs'
import path from 'path'

const root = '/home/claude/linear-clone/dist'
const server = http.createServer((req, res) => {
  let p = path.join(root, req.url.split('?')[0].split('#')[0] === '/' ? 'index.html' : req.url.split('?')[0].split('#')[0])
  if (!fs.existsSync(p)) p = path.join(root, 'index.html')
  const ext = path.extname(p)
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': mime })
  res.end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(4178, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

// the relay rejects browser calls entirely (CORS) — direct requests die
await ctx.route('https://corsblock.example/**', (route) => route.abort('failed'))

// the same-origin proxy forwards everything
const proxyHits = []
const agentJson = JSON.stringify({
  steps: ['Read the issue', 'Applied a focused change'],
  summary: 'Change proposed via proxy.',
  edits: [
    {
      path: 'client/src/startup/AppBoot.swift',
      find: '        store.waitUntilSynced()',
      replace: '        // proxy-mark',
    },
  ],
})
await ctx.route('**/api/proxy*', (route) => {
  const req = route.request()
  const target = new URL(req.url()).searchParams.get('url')
  proxyHits.push({ target, headers: req.headers() })
  const body = req.postData() ?? ''
  const text = body.includes('You are a coding agent') ? agentJson : '代理通了。'
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text }] }),
  })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// 1. add a Claude-format relay that blocks CORS → test auto-probes proxy
await page.goto('http://localhost:4178/#/settings')
await page.waitForTimeout(600)
await page.click('.add-provider-btn')
await page.click('.preset-chip:has-text("Claude 中转站")')
await page.fill('.pf-base', 'https://corsblock.example')
await page.fill('.pf-key', 'sk-cors-123')
await page.locator('.provider-form .btn:has-text("测试")').click()
await page.waitForSelector('.provider-form .test-result.ok', { timeout: 8000 })
const okMsg = await page.locator('.provider-form .test-result.ok').innerText()
check('auto-probe switched to proxy', okMsg.includes('代理'))
check('proxy checkbox auto-enabled', await page.locator('.settings-check input').isChecked())
check('proxy hit carries target url', proxyHits[0].target === 'https://corsblock.example/v1/messages')
check('proxy hit carries x-api-key', proxyHits[0].headers['x-api-key'] === 'sk-cors-123')
check('proxy hit carries Bearer', proxyHits[0].headers['authorization'] === 'Bearer sk-cors-123')

// 2. save → proxy badge on the row, auto-activated
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(300)
check('row shows proxy badge', await page.isVisible('.provider-row:has-text("Claude 中转站") .provider-kind-badge:has-text("代理")'))
check('profile active', await page.isVisible('.provider-row:has-text("Claude 中转站") .provider-active-badge'))

// 3. chat goes through the proxy
await page.goto('http://localhost:4178/#/chat')
await page.waitForTimeout(400)
await page.fill('.chat-composer .composer-input', '代理链路测试')
await page.keyboard.press('Enter')
await page.waitForSelector('.chat-msg-body:has-text("代理通了")', { timeout: 8000 })
check('chat reply arrives via proxy', true)
const chatHit = proxyHits[proxyHits.length - 1]
check('chat target correct', chatHit.target === 'https://corsblock.example/v1/messages')

// 4. agent delegation goes through the proxy too
await page.goto('http://localhost:4178/#/issue/LIN-1')
await page.waitForTimeout(300)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
check('agent run via proxy reaches needsReview', true)
await page.click('.delegate-btn.review')
await page.waitForTimeout(400)
check('proxied agent diff rendered', (await page.locator('.diff-body').innerText()).includes('proxy-mark'))

// 5. manual un-tick, saved-row test re-enables automatically
await page.goto('http://localhost:4178/#/settings')
await page.waitForTimeout(400)
await page.locator('.provider-row:has-text("Claude 中转站") .btn:has-text("编辑")').click()
await page.waitForTimeout(200)
await page.locator('.settings-check input').uncheck()
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(300)
check('badge gone after un-tick', !(await page.isVisible('.provider-row:has-text("Claude 中转站") .provider-kind-badge:has-text("代理")')))
await page.locator('.provider-row:has-text("Claude 中转站") .btn:has-text("测试")').click()
await page.waitForSelector('.test-result.ok', { timeout: 8000 })
check('saved-row test re-enables proxy', await page.isVisible('.provider-row:has-text("Claude 中转站") .provider-kind-badge:has-text("代理")'))

await page.screenshot({ path: 'shot23-proxy.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
