import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'
import http from 'http'
import fs from 'fs'
import path from 'path'

const root = '/home/claude/linear-clone/dist'
const server = http.createServer((req, res) => {
  let p = path.join(root, req.url === '/' ? 'index.html' : req.url)
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
await page.goto('http://localhost:4173')
await page.waitForTimeout(500)

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// 1. Cmd+K palette
await page.keyboard.press('Control+k')
await page.waitForTimeout(200)
check('palette opens', await page.isVisible('.palette'))
await page.fill('.palette-input', 'dimmed')
await page.waitForTimeout(150)
const itemCount = await page.locator('.palette-item').count()
check('palette filters (1 result for "dimmed")', itemCount === 1)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('palette Enter opens issue detail', (await page.textContent('.issue-title').catch(() => '')) === 'Dimmed Status Cards')
await page.screenshot({ path: 'shot2-after-palette.png' })

// 2. Esc goes back to list
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
check('Esc returns to list', await page.isVisible('.issue-groups'))

// 3. J/K selection
await page.keyboard.press('j')
await page.keyboard.press('j')
await page.waitForTimeout(150)
const selText = await page.textContent('.issue-row.selected .issue-id').catch(() => null)
check('J moves selection (selected=' + selText + ')', selText !== null)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('Enter opens selected issue', await page.isVisible('.issue-title'))
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// 4. C opens new-issue modal, create issue
await page.keyboard.press('c')
await page.waitForTimeout(200)
check('C opens modal', await page.isVisible('.modal'))
await page.fill('.modal-title-input', 'Test issue from automation')
// set priority via dropdown
await page.locator('.modal-chips .dropdown').nth(1).locator('button').first().click()
await page.waitForTimeout(150)
await page.screenshot({ path: 'shot2-modal.png' })
await page.click('.menu-item:has-text("Urgent")')
await page.waitForTimeout(150)
await page.click('.btn.primary')
await page.waitForTimeout(300)
const newRow = await page.isVisible('.issue-row:has-text("Test issue from automation")')
check('created issue appears in list', newRow)

// 5. Detail dropdowns actually update state
await page.click('.issue-row:has-text("Faster app launch")')
await page.waitForTimeout(300)
await page.click('.props-panel .dropdown >> nth=0')
await page.waitForTimeout(150)
await page.click('.menu-item:has-text("Done")')
await page.waitForTimeout(200)
const statusNow = await page.textContent('.props-panel .prop-row')
check('status dropdown updates (now: ' + statusNow.trim() + ')', statusNow.includes('Done'))
await page.screenshot({ path: 'shot2-detail-updated.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// 6. drag & drop: drag first Todo row onto In Progress group header
const src = page.locator('.issue-row:has-text("Surge pricing banner")')
const dst = page.locator('.group-header:has-text("In Progress")')
await src.dragTo(dst)
await page.waitForTimeout(300)
// check the row now sits in the In Progress section
const inProgressSection = page.locator('section', { has: page.locator('.group-header:has-text("In Progress")') })
const moved = await inProgressSection.locator('.issue-row:has-text("Surge pricing banner")').count()
check('drag row to In Progress group changes status', moved === 1)
await page.screenshot({ path: 'shot2-after-drag.png' })

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
