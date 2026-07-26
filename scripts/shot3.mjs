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
await page.waitForTimeout(600)

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// floating panel on issue detail
check('floating panel visible', await page.isVisible('.agent-panel.floating'))
await page.click('.agent-worked-toggle')
await page.waitForTimeout(200)
check('worked-for expands', await page.isVisible('.agent-worked-steps'))
await page.screenshot({ path: 'shot3-issue-panel.png' })

// send a chat message
await page.fill('.agent-input input', 'Also fix the spinner timeout')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('user msg appears', await page.isVisible('.chat-msg.user'))
check('typing dots appear', await page.isVisible('.typing-dots'))
await page.waitForTimeout(1500)
check('agent reply appears', (await page.locator('.chat-msg.agent').count()) >= 1)
await page.screenshot({ path: 'shot3-chat.png' })

// minimize / close / reopen
await page.click('.agent-header-actions .icon-btn:has-text("")', { trial: true }).catch(() => {})
await page.click('.agent-header-actions button[title="Minimize"]')
await page.waitForTimeout(200)
check('minimized hides body', !(await page.isVisible('.agent-body')))
await page.click('.agent-header-actions button[title="Minimize"]')
await page.click('.agent-header-actions button[title="Close"]')
await page.waitForTimeout(200)
check('close shows fab', await page.isVisible('.agent-fab'))
await page.click('.agent-fab')
await page.waitForTimeout(300)
check('fab reopens panel', await page.isVisible('.agent-panel.floating'))

// diff embedded panel
await page.click('text=Reviews')
await page.waitForTimeout(400)
check('embedded panel in diff view', await page.isVisible('.agent-panel.embedded'))
await page.screenshot({ path: 'shot3-diff-panel.png' })

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
