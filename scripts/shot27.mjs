// Honesty + polish pass e2e: dead sidebar buttons removed, search/compose
// wired, real Pulse page, inbox hover quick-read, live step stream, diff
// gap expansion, dropdown flip, light-theme layering values.
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
await new Promise((r) => server.listen(4182, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// 1. dead buttons gone; every remaining sidebar nav item navigates
await page.goto('http://localhost:4182/#/inbox')
await page.waitForTimeout(700)
const sidebarText = await page.locator('.sidebar').innerText()
check('方向 removed', !sidebarText.includes('方向'))
check('更多 removed', !sidebarText.includes('更多'))

// 2. search icon opens the palette; compose opens the new-issue modal
await page.click('.sidebar-top-actions .icon-btn >> nth=0')
await page.waitForTimeout(200)
check('search opens palette', await page.isVisible('.palette'))
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
await page.click('.sidebar-top-actions .icon-btn >> nth=1')
await page.waitForTimeout(200)
check('compose opens new-issue modal', await page.isVisible('.modal'))
await page.keyboard.press('Escape')
await page.waitForTimeout(150)

// 3. Pulse is a real page with stats
await page.click('.nav-item:has-text("动态")')
await page.waitForTimeout(300)
check('pulse route', page.url().endsWith('#/pulse'))
check('pulse stat cards render', (await page.locator('.stat-card').count()) === 6)
const createdVal = await page.locator('.stat-card:has-text("新建事项") .stat-value').innerText()
check('sample issues counted as created', Number(createdVal) >= 3)
check('review section present', await page.isVisible('.pulse-section:has-text("待你审查")'))

// 4. inbox hover quick-read marks read without navigating
await page.goto('http://localhost:4182/#/inbox')
await page.waitForTimeout(300)
check('welcome notification unread', await page.isVisible('.inbox-row.unread'))
await page.locator('.inbox-row.unread').hover()
await page.click('.inbox-quick')
await page.waitForTimeout(200)
check('quick-read clears unread', !(await page.isVisible('.inbox-row.unread')))
check('quick-read does not navigate', page.url().endsWith('#/inbox'))

// 5. live step stream on the issue detail while the agent works
await page.goto('http://localhost:4182/#/issue/LIN-2')
await page.waitForTimeout(300)
await page.click('.delegate-btn')
await page.waitForSelector('.live-steps', { timeout: 8000 })
check('live steps panel appears', true)
await page.waitForFunction(() => document.querySelectorAll('.live-step').length >= 2, null, { timeout: 8000 })
check('steps stream in live', true)
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
check('live steps gone when done', !(await page.isVisible('.live-steps')))

// 6. diff gap expansion
await page.click('.delegate-btn.review')
await page.waitForTimeout(400)
const collapsedLines = await page.locator('.diff-line').count()
check('gap row present when collapsed', await page.isVisible('.diff-line.gap.clickable'))
await page.locator('.diff-line.gap.clickable').first().click()
await page.waitForTimeout(300)
const expandedLines = await page.locator('.diff-line').count()
check('expansion adds lines', expandedLines > collapsedLines)
check('gaps gone after expansion', !(await page.isVisible('.diff-line.gap')))

// 7. dropdown flips near the viewport bottom
await page.setViewportSize({ width: 1440, height: 300 })
await page.goto('http://localhost:4182/#/issue/LIN-1')
await page.waitForTimeout(300)
await page.click('.prop-row >> nth=0')
await page.waitForTimeout(250)
check('dropdown opens', await page.isVisible('.menu'))
check('dropdown flips upward in short viewport', await page.isVisible('.menu.flip'))
await page.keyboard.press('Escape')
await page.setViewportSize({ width: 1440, height: 860 })

// 8. light-theme layering values took effect
await page.goto('http://localhost:4182/#/settings')
await page.waitForTimeout(300)
await page.click('.tab:has-text("亮色")')
await page.waitForTimeout(300)
const raised = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--bg-raised').trim(),
)
check('light bg-raised separated', raised === '#eef0f3')
await page.click('.tab:has-text("深色")')
await page.waitForTimeout(200)

await page.screenshot({ path: 'shot27-polish.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
