// Provider profiles (ccswitch-style) e2e: v2 migration, preset add,
// dual-header auth for Claude-format relays, /v1 dedup in the URL,
// switch/delete flows, CORS vs HTTP diagnostics, and chat through an
// Anthropic-format relay.
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
await new Promise((r) => server.listen(4177, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

// Claude-format relay: capture URL + headers, answer in Anthropic shape
const relayHits = []
await ctx.route('https://relay.example/**', (route) => {
  const req = route.request()
  relayHits.push({ url: req.url(), headers: req.headers() })
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: '中转聊天正常。' }] }),
  })
})
// broken relays for diagnostics
await ctx.route('https://relay401.example/**', (route) =>
  route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'invalid api key' } }) }),
)
await ctx.route('https://dead.example/**', (route) => route.abort('failed'))
// plain local dev: the proxy function does not exist → 404 (the auto-probe
// must fall back to the CORS diagnosis instead of a false positive)
await ctx.route('**/api/proxy*', (route) =>
  route.fulfill({ status: 404, contentType: 'text/html', body: 'not found' }),
)

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// seed a PRE-PROFILES v2 state (old single-provider shape) → must migrate
await page.addInitScript(() => {
  if (!localStorage.getItem('__seeded')) {
    localStorage.setItem('__seeded', '1')
    localStorage.setItem(
      'linage-state-v2',
      JSON.stringify({
        issues: [{ id: 'LIN-1', title: '迁移测试', status: 'todo', priority: 'low', labels: [], executor: 'me', createdAt: 1, }],
        notifications: [],
        projects: [],
        theme: 'dark',
        locale: 'zh',
        agentTasks: [],
        settings: {
          provider: { kind: 'openai', baseUrl: 'https://relay401.example/v1', apiKey: 'sk-old', model: 'deepseek-chat' },
          githubToken: '',
          githubRepo: '',
        },
      }),
    )
  }
})

// 1. migration: old single provider becomes a saved active profile
await page.goto('http://localhost:4177/#/settings')
await page.waitForTimeout(700)
check('migrated profile row exists', await page.isVisible('.provider-row:has-text("OpenAI 兼容")'))
check(
  'migrated profile is active',
  await page.isVisible('.provider-row:has-text("OpenAI 兼容") .provider-active-badge'),
)
check('simulator row present', await page.isVisible('.provider-row:has-text("内置模拟")'))

// 2. HTTP diagnostics: 401 relay shows status + server message
await page.locator('.provider-row:has-text("OpenAI 兼容") .btn:has-text("测试")').click()
await page.waitForSelector('.test-result.fail', { timeout: 8000 })
const err401 = await page.locator('.test-result.fail').innerText()
check('401 diagnostic shows HTTP status', err401.includes('HTTP 401'))
check('401 diagnostic shows server message', err401.includes('invalid api key'))

// 3. add a Claude-format relay via preset; trailing /v1 must not double
await page.click('.add-provider-btn')
await page.click('.preset-chip:has-text("Claude 中转站")')
await page.waitForTimeout(200)
check('preset fills name', (await page.locator('.pf-name').inputValue()) === 'Claude 中转站')
check('preset selects Claude format', await page.isVisible('.provider-form .tab.active:has-text("Claude")'))
await page.fill('.pf-base', 'https://relay.example/v1')
await page.fill('.pf-key', 'sk-relay-ccswitch')
await page.locator('.provider-form .btn:has-text("测试")').click()
await page.waitForSelector('.provider-form .test-result.ok', { timeout: 8000 })
check('claude relay test ok', true)
const hit = relayHits[0]
check('URL is /v1/messages (no /v1/v1)', hit.url === 'https://relay.example/v1/messages')
check('sends x-api-key', hit.headers['x-api-key'] === 'sk-relay-ccswitch')
check('sends Authorization Bearer too', hit.headers['authorization'] === 'Bearer sk-relay-ccswitch')
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(300)
check('saved as second profile', (await page.locator('.provider-row').count()) === 3)

// 4. activate the relay profile → runtime switches
await page.locator('.provider-row:has-text("Claude 中转站") .btn:has-text("启用")').click()
await page.waitForTimeout(200)
check(
  'relay profile now active',
  await page.isVisible('.provider-row:has-text("Claude 中转站") .provider-active-badge'),
)

// 5. chat goes through the Anthropic-format relay with dual headers
await page.goto('http://localhost:4177/#/chat')
await page.waitForTimeout(400)
await page.fill('.chat-composer .composer-input', '中转连通测试')
await page.keyboard.press('Enter')
await page.waitForSelector('.chat-msg-body:has-text("中转聊天正常")', { timeout: 8000 })
check('chat reply via claude relay', true)
const chatHit = relayHits[relayHits.length - 1]
check('chat request also dual-header', !!chatHit.headers['authorization'] && !!chatHit.headers['x-api-key'])
check('chat badged with model', await page.isVisible('.chat-msg .model-badge:has-text("claude-sonnet-4-5")'))

// 6. CORS/network diagnostic on an unreachable relay
await page.goto('http://localhost:4177/#/settings')
await page.waitForTimeout(400)
await page.click('.add-provider-btn')
await page.click('.preset-chip:has-text("OpenAI 中转站")')
await page.fill('.pf-name', '死中转')
await page.fill('.pf-base', 'https://dead.example/v1')
await page.fill('.pf-key', 'sk-x')
await page.fill('.pf-model', 'test-model')
await page.locator('.provider-form .btn:has-text("测试")').click()
await page.waitForSelector('.provider-form .test-result.fail', { timeout: 8000 })
const corsMsg = await page.locator('.provider-form .test-result.fail').innerText()
check('unreachable relay hints CORS/network', corsMsg.includes('CORS'))
await page.click('.provider-form .btn:has-text("取消")')

// 7. delete the active profile → falls back to simulator
await page.locator('.provider-row:has-text("Claude 中转站") .btn:has-text("删除")').click()
await page.waitForTimeout(200)
check('deleted row gone', !(await page.isVisible('.provider-row:has-text("Claude 中转站")')))
check(
  'falls back to simulator',
  await page.isVisible('.provider-row:has-text("内置模拟") .provider-active-badge'),
)

// 8. state survives reload
await page.reload()
await page.waitForTimeout(600)
check('profiles persist after reload', await page.isVisible('.provider-row:has-text("OpenAI 兼容")'))
check(
  'active choice persists',
  await page.isVisible('.provider-row:has-text("内置模拟") .provider-active-badge'),
)

await page.screenshot({ path: 'shot22-providers.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
