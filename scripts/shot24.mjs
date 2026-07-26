// Model discovery e2e: fetch model lists from OpenAI-compatible and
// Claude-format endpoints, click-to-select, auto-fetch on edit, proxy
// fallback for CORS-blocked relays, and the chat picker using real models.
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
await new Promise((r) => server.listen(4179, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

// OpenAI-compatible relay
let openaiModelHits = 0
await ctx.route('https://relay.example/**', (route) => {
  const url = route.request().url()
  if (route.request().method() === 'GET' && url.includes('/models')) {
    openaiModelHits += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'deepseek-chat' }, { id: 'm-alpha' }, { id: 'm-beta' }] }),
    })
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '好的。' } }] }),
  })
})

// Claude-format relay
let claudeModelHit = null
await ctx.route('https://relay2.example/**', (route) => {
  const req = route.request()
  if (req.method() === 'GET' && req.url().includes('/models')) {
    claudeModelHit = { url: req.url(), headers: req.headers() }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'claude-x' }, { id: 'claude-y' }] }),
    })
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: '好的。' }] }),
  })
})

// CORS-blocked relay + proxy that serves its model list
await ctx.route('https://corsblock.example/**', (route) => route.abort('failed'))
await ctx.route('**/api/proxy*', (route) => {
  const target = new URL(route.request().url()).searchParams.get('url') ?? ''
  if (route.request().method() === 'GET' && target.includes('/models')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'via-proxy-model' }] }),
    })
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }),
  })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// 1. OpenAI-compatible: fetch → list → click to select
await page.goto('http://localhost:4179/#/settings')
await page.waitForTimeout(600)
await page.click('.add-provider-btn')
await page.click('.preset-chip:has-text("OpenAI 中转站")')
await page.fill('.pf-base', 'https://relay.example/v1')
await page.fill('.pf-key', 'sk-m-123')
await page.click('.fetch-models-btn')
await page.waitForSelector('.model-list', { timeout: 8000 })
check('model list renders', (await page.locator('.model-option').count()) === 3)
check('badge reports count', (await page.locator('.test-result.ok').last().innerText()).includes('3'))
await page.click('.model-option:has-text("m-alpha")')
check('click selects model', (await page.locator('.pf-model').inputValue()) === 'm-alpha')
check('selection highlighted', await page.isVisible('.model-option.active:has-text("m-alpha")'))
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(300)

// 2. chat picker shows the REAL fetched models, not presets
await page.goto('http://localhost:4179/#/chat')
await page.waitForTimeout(400)
await page.fill('.chat-composer .composer-input', '你好')
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.querySelectorAll('.chat-msg .model-badge').length >= 1, null, { timeout: 10000 })
await page.click('.panel-header-right .btn:has-text("m-alpha")')
await page.waitForTimeout(200)
check('chat picker lists fetched models', await page.isVisible('.menu-item:has-text("m-beta")'))
check('chat picker not polluted by presets', !(await page.isVisible('.menu-item:has-text("gpt-4o-mini")')))
await page.keyboard.press('Escape')

// 3. Claude-format: /v1/models with dual auth headers
await page.goto('http://localhost:4179/#/settings')
await page.waitForTimeout(400)
await page.click('.add-provider-btn')
await page.click('.preset-chip:has-text("Claude 中转站")')
await page.fill('.pf-base', 'https://relay2.example')
await page.fill('.pf-key', 'sk-claude-9')
await page.click('.fetch-models-btn')
await page.waitForSelector('.model-option:has-text("claude-x")', { timeout: 8000 })
check('claude-format list renders', true)
check('GET hits /v1/models', claudeModelHit.url.startsWith('https://relay2.example/v1/models'))
check('GET carries x-api-key', claudeModelHit.headers['x-api-key'] === 'sk-claude-9')
check('GET carries Bearer', claudeModelHit.headers['authorization'] === 'Bearer sk-claude-9')
await page.click('.model-option:has-text("claude-y")')
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(300)

// 4. auto-fetch when editing a saved profile (no click needed)
openaiModelHits = 0
await page.locator('.provider-row:has-text("OpenAI 中转站") .btn:has-text("编辑")').click()
await page.waitForSelector('.model-list', { timeout: 8000 })
check('edit auto-fetches models', openaiModelHits >= 1)
await page.click('.provider-form .btn:has-text("取消")')

// 5. CORS-blocked relay: model fetch falls back to the proxy
await page.click('.add-provider-btn')
await page.click('.preset-chip:has-text("OpenAI 中转站")')
await page.fill('.pf-name', '代理拉模型')
await page.fill('.pf-base', 'https://corsblock.example/v1')
await page.fill('.pf-key', 'sk-p')
await page.click('.fetch-models-btn')
try {
  await page.waitForSelector('.model-option:has-text("via-proxy-model")', { timeout: 8000 })
  check('model fetch works via proxy fallback', true)
} catch {
  const badge = await page.locator('.provider-form .test-result').last().innerText().catch(() => '(no badge)')
  check(`proxy fallback failed — badge: ${badge}`, false)
}
await page.click('.provider-form .btn:has-text("取消")')

await page.screenshot({ path: 'shot24-models.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
