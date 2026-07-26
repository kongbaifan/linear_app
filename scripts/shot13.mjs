import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'
import http from 'http'
import fs from 'fs'
import path from 'path'

const root = '/home/claude/linear-clone/dist'
const server = http.createServer((req, res) => {
  let p = path.join(root, req.url.split('?')[0].split('#')[0] === '/' ? 'index.html' : req.url.split('?')[0].split('#')[0])
  if (!fs.existsSync(p)) p = path.join(root, 'index.html')
  const ext = path.extname(p)
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': mime })
  res.end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(4173, r))

const AGENT_JSON = JSON.stringify({
  steps: ['Read AppBoot.swift', 'Added relay marker comment', 'Verified build'],
  summary: 'Added a marker via relay provider.',
  edits: [{ path: 'client/src/startup/AppBoot.swift', find: 'import UIKit', replace: 'import UIKit\n// via-relay-provider' }],
})

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 } })

const hits = []
// OpenAI-compatible relay fixture
await ctx.route('https://relay.example/**', (route) => {
  const url = new URL(route.request().url())
  hits.push(`${route.request().method()} ${url.host}${url.pathname}`)
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: AGENT_JSON } }] }),
  })
})
// Anthropic relay fixture
await ctx.route('https://claude-relay.example/**', (route) => {
  const url = new URL(route.request().url())
  hits.push(`${route.request().method()} ${url.host}${url.pathname}`)
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ text: AGENT_JSON }] }),
  })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// legacy migration: seed old flat settings shape
await page.addInitScript(() => {
  if (!localStorage.getItem('__seeded')) {
    localStorage.setItem('__seeded', '1')
    localStorage.setItem(
      'linear-clone-state-v1',
      JSON.stringify({
        issues: [{ id: 'ENG-1', title: 'Legacy issue', status: 'todo', priority: 'low', labels: [], date: 'Jul 26' }],
        notifications: [],
        settings: { apiKey: 'sk-ant-LEGACY', model: 'claude-3-7', githubToken: '', githubRepo: '' },
      }),
    )
  }
})
await page.goto('http://localhost:4173/#/settings')
await page.waitForTimeout(700)
check('legacy settings migrate to Anthropic kind', await page.locator('.tab.active:has-text("Anthropic")').isVisible())
check('legacy key preserved', (await page.locator('.settings-input').nth(1).inputValue()) === 'sk-ant-LEGACY')
check('anthropic baseUrl prefilled', (await page.locator('.settings-input').nth(0).inputValue()) === 'https://api.anthropic.com')

// switch to OpenAI-compatible → defaults prefill
await page.click('.tab:has-text("OpenAI")')
await page.waitForTimeout(200)
check('openai baseUrl prefilled', (await page.locator('.settings-input').nth(0).inputValue()) === 'https://api.openai.com/v1')
check('openai model prefilled', (await page.locator('.settings-input').nth(2).inputValue()) === 'gpt-4o-mini')

// configure a relay 中转站
await page.locator('.settings-input').nth(0).fill('https://relay.example/v1')
await page.locator('.settings-input').nth(1).fill('sk-relay-123')
await page.locator('.settings-input').nth(2).fill('deepseek-chat')
await page.waitForTimeout(200)

// test connection hits the relay
await page.locator('.settings-row .btn').first().click()
await page.waitForTimeout(500)
check('relay test connection ok', await page.isVisible('.test-result.ok'))
check('test hit relay /chat/completions', hits.some((h) => h === 'POST relay.example/v1/chat/completions'))
await page.screenshot({ path: 'shot13-provider.png' })

// delegate → agent runs through the relay
await page.goto('http://localhost:4173/#/issue/ENG-1')
await page.waitForTimeout(400)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
await page.click('.delegate-btn.review')
await page.waitForTimeout(500)
const addText = await page.locator('.diff-line.add .code').first().textContent()
check('relay-generated edit in diff (' + addText.trim() + ')', addText.includes('via-relay-provider'))
check('model badge shows deepseek-chat', await page.isVisible('.model-badge:has-text("deepseek-chat")'))
check('agent call went to relay', hits.filter((h) => h === 'POST relay.example/v1/chat/completions').length >= 2)

// anthropic custom base URL path
await page.goto('http://localhost:4173/#/settings')
await page.waitForTimeout(300)
await page.click('.tab:has-text("Anthropic")')
await page.waitForTimeout(200)
await page.locator('.settings-input').nth(0).fill('https://claude-relay.example')
await page.locator('.settings-input').nth(1).fill('sk-ant-relay')
await page.locator('.settings-input').nth(2).fill('claude-sonnet-4-5')
await page.locator('.settings-row .btn').first().click()
await page.waitForTimeout(500)
check('claude relay test ok', await page.isVisible('.test-result.ok'))
check('claude relay hit /v1/messages', hits.some((h) => h === 'POST claude-relay.example/v1/messages'))

// simulated kind hides credential fields
await page.click('.tab:has-text("simulator"), .tab:has-text("内置模拟")')
await page.waitForTimeout(200)
const inputCount = await page.locator('.settings-section >> nth=0 >> .settings-input').count()
check('simulated kind hides credential inputs', inputCount === 0)

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
