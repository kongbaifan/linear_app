import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'
import http from 'http'
import fs from 'fs'
import path from 'path'

const root = '/home/claude/linear-clone/dist'
const server = http.createServer((req, res) => {
  let p = path.join(root, req.url.split('#')[0] === '/' ? 'index.html' : req.url.split('#')[0])
  if (!fs.existsSync(p)) p = path.join(root, 'index.html')
  const ext = path.extname(p)
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': mime })
  res.end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: 1.5 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'FAIL' : 'FAIL'} ${name}`.replace('FAIL', ok ? 'PASS' : 'FAIL'))

// 1. persistence: change ENG-2703 status to Done, reload, check it stuck
await page.goto('http://localhost:4173/#/issue/ENG-2703')
await page.waitForTimeout(500)
await page.click('.props-panel .dropdown >> nth=0')
await page.waitForTimeout(150)
await page.click('.menu-item:has-text("Done")')
await page.waitForTimeout(300)
await page.reload()
await page.waitForTimeout(600)
const statusAfterReload = await page.textContent('.props-panel .prop-row')
check('status persists across reload (' + statusAfterReload.trim() + ')', statusAfterReload.includes('Done'))

// 2. theme toggle persists
await page.click('button[title="Toggle theme"]')
await page.waitForTimeout(400)
let theme = await page.evaluate(() => document.documentElement.dataset.theme)
check('toggle switches to light', theme === 'light')
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
check('light bg applied (' + bg + ')', bg === 'rgb(244, 245, 248)')
await page.reload()
await page.waitForTimeout(600)
theme = await page.evaluate(() => document.documentElement.dataset.theme)
check('theme persists across reload', theme === 'light')
await page.screenshot({ path: 'shot5-light-issue.png' })

// 3. light diff view
await page.goto('http://localhost:4173/#/review/ENG-2498')
await page.waitForTimeout(500)
await page.screenshot({ path: 'shot5-light-diff.png' })

// 4. reset demo data via palette (should restore In Progress but keep theme)
await page.keyboard.press('Control+k')
await page.waitForTimeout(200)
await page.fill('.palette-input', 'reset')
await page.waitForTimeout(150)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
await page.goto('http://localhost:4173/#/issue/ENG-2703')
await page.waitForTimeout(400)
const statusAfterReset = await page.textContent('.props-panel .prop-row')
check('reset restores In Progress', statusAfterReset.includes('In Progress'))
theme = await page.evaluate(() => document.documentElement.dataset.theme)
check('reset keeps theme', theme === 'light')

// 5. palette theme command back to dark
await page.keyboard.press('Control+k')
await page.waitForTimeout(200)
await page.fill('.palette-input', 'dark')
await page.waitForTimeout(150)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
theme = await page.evaluate(() => document.documentElement.dataset.theme)
check('palette command switches back to dark', theme === 'dark')

// 6. light board + list quick shots
await page.click('button[title="Toggle theme"]')
await page.waitForTimeout(300)
await page.goto('http://localhost:4173/#/issues/board')
await page.waitForTimeout(400)
await page.screenshot({ path: 'shot5-light-board.png' })

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
