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
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// deep links
await page.goto('http://localhost:4173/#/inbox')
await page.waitForTimeout(500)
check('deep link #/inbox', await page.isVisible('.inbox-list'))
const unreadBefore = await page.locator('.inbox-row.unread').count()
await page.click('.inbox-row.unread >> nth=0')
await page.waitForTimeout(400)
check('inbox click opens issue', await page.isVisible('.issue-title'))
check('url is issue deep link', page.url().includes('#/issue/'))

// browser back returns to inbox
await page.goBack()
await page.waitForTimeout(400)
check('browser back → inbox', await page.isVisible('.inbox-list'))
const unreadAfter = await page.locator('.inbox-row.unread').count()
check(`clicked notification marked read (${unreadBefore}→${unreadAfter})`, unreadAfter === unreadBefore - 1)
await page.click('button:has-text("Mark all read")')
await page.waitForTimeout(200)
check('mark all read', (await page.locator('.inbox-row.unread').count()) === 0)
await page.screenshot({ path: 'shot4-inbox.png' })

// projects
await page.click('text=Projects')
await page.waitForTimeout(400)
check('projects table', (await page.locator('.projects-row').count()) === 4)
check('url #/projects', page.url().includes('#/projects'))
await page.screenshot({ path: 'shot4-projects.png' })

// board toggle
await page.click('text=My issues')
await page.waitForTimeout(300)
await page.click('.view-toggle .tab >> nth=1')
await page.waitForTimeout(400)
check('board renders 3 columns', (await page.locator('.board-col').count()) === 3)
check('url #/issues/board', page.url().includes('#/issues/board'))

// drag a card from Todo column to In Progress column
const card = page.locator('.board-card:has-text("Add haptics")')
const col = page.locator('.board-col:has-text("In Progress")').first()
await card.dragTo(col)
await page.waitForTimeout(400)
const inProg = page.locator('.board-col', { has: page.locator('.board-col-header:has-text("In Progress")') })
check('board drag moves card', (await inProg.locator('.board-card:has-text("Add haptics")').count()) === 1)
await page.screenshot({ path: 'shot4-board.png' })

// palette navigation to inbox
await page.keyboard.press('Control+k')
await page.waitForTimeout(200)
await page.fill('.palette-input', 'inbox')
await page.waitForTimeout(150)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('palette → inbox route', page.url().includes('#/inbox'))

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
