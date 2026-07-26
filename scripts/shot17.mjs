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
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
// failing GitHub fixture for retry test
let failRepo = true
await ctx.route('https://api.github.com/**', (route) => {
  if (failRepo) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// 1. empty groups hidden when not dragging (fresh: only 待办 has issues)
await page.goto('http://localhost:4173/#/issues')
await page.waitForTimeout(700)
check('only non-empty groups shown', (await page.locator('.group-header').count()) === 1)

// 2. board + creates issue preset to that column
await page.click('.view-toggle .tab >> nth=1')
await page.waitForTimeout(400)
await page.locator('.board-col:has-text("进行中") .board-col-actions .icon-btn').click()
await page.waitForTimeout(300)
check('modal opens from column +', await page.isVisible('.modal'))
check('status preset to 进行中', await page.isVisible('.modal-chips .btn:has-text("进行中")'))
await page.fill('.modal-title-input', '列内新建测试')
await page.click('.btn.primary')
await page.waitForTimeout(400)
const inProgCol = page.locator('.board-col', { has: page.locator('.board-col-header:has-text("进行中")') })
check('issue lands in that column', (await inProgCol.locator('.board-card:has-text("列内新建测试")').count()) === 1)

// 3. real notes
await page.goto('http://localhost:4173/#/issue/LIN-1')
await page.waitForTimeout(400)
await page.fill('.composer-input', '这是一条真实笔记')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('note appears in activity', await page.isVisible('.event-text b:has-text("这是一条真实笔记")'))
check('composer cleared', (await page.locator('.composer-input').inputValue()) === '')
await page.reload(); await page.waitForTimeout(600)
check('note persists after reload', await page.isVisible('.event-text b:has-text("这是一条真实笔记")'))

// 4. board col has no dots button anymore
await page.goto('http://localhost:4173/#/issues/board')
await page.waitForTimeout(400)
check('column … removed (1 action per col)', (await page.locator('.board-col >> nth=0 >> .board-col-actions .icon-btn').count()) === 1)

// 5. settings centered
await page.goto('http://localhost:4173/#/settings')
await page.waitForTimeout(400)
const centered = await page.evaluate(() => {
  const el = document.querySelector('.settings-page')
  const s = getComputedStyle(el)
  return parseFloat(s.marginLeft) > 40
})
check('settings page centered on wide screen', centered)

// 6. failed task retry: configure failing github repo, delegate, fail, retry after clearing
await page.locator('.settings-input').nth(0).fill('ghp_BAD')
await page.locator('.settings-input').nth(1).fill('octo/broken')
await page.waitForTimeout(200)
await page.goto('http://localhost:4173/#/issue/LIN-2')
await page.waitForTimeout(300)
await page.click('.delegate-btn')
await page.waitForTimeout(2500)
await page.goto('http://localhost:4173/#/agents')
await page.waitForSelector('.agent-task-row:has-text("失败")', { timeout: 15000 })
check('task failed (bad repo)', true)
check('retry button visible', await page.isVisible('.btn:has-text("重试")'))
// clear github config so retry succeeds in virtual mode
await page.goto('http://localhost:4173/#/settings')
await page.waitForTimeout(300)
await page.locator('.settings-input').nth(0).fill('')
await page.locator('.settings-input').nth(1).fill('')
await page.waitForTimeout(200)
await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(300)
await page.click('.btn:has-text("重试")')
await page.waitForSelector('.agent-task-row:has-text("待审查"), .agent-task-row:has-text("Needs review")', { timeout: 25000 })
check('retry re-runs task to needsReview', true)
await page.screenshot({ path: 'shot17-agents.png' })

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
