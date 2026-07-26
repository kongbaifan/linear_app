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

// empty workbench
await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(500)
check('agents route renders empty state', await page.isVisible('.agents-empty'))

// settings modal
await page.click('.panel-header .btn')
await page.waitForTimeout(200)
check('settings modal opens', await page.isVisible('.settings-input'))
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// delegate from issue detail
await page.goto('http://localhost:4173/#/issue/ENG-2701')
await page.waitForTimeout(400)
check('delegate button visible', await page.isVisible('.delegate-btn'))
await page.click('.delegate-btn')
await page.waitForTimeout(600)
check('button becomes working', await page.isVisible('.delegate-btn.working'))

// workbench shows working task with streaming steps
await page.click('.delegate-btn.working')
await page.waitForTimeout(500)
check('task row visible on agents page', await page.isVisible('.agent-task-row'))
check('status is working', (await page.textContent('.agent-task-status')).length > 0)
await page.waitForTimeout(3000)
const stepsMid = await page.locator('.agent-task-steps .agent-worked-step').count()
check('steps streaming in (' + stepsMid + ' visible)', stepsMid >= 1)
await page.screenshot({ path: 'shot7-working.png' })

// wait for completion → needs review
await page.waitForSelector('.agent-task-row .btn:has-text("Review diff")', { timeout: 15000 })
check('task reaches Needs review with Review button', true)
await page.click('.agent-task-row') // expand
await page.waitForTimeout(300)
check('summary shown when expanded', await page.isVisible('.agent-task-summary'))
await page.screenshot({ path: 'shot7-needs-review.png' })

// review → diff, then approve → done
await page.click('.btn:has-text("Review diff")')
await page.waitForTimeout(400)
check('review opens diff view', await page.isVisible('.diff-file'))
await page.goBack()
await page.waitForTimeout(400)
await page.click('.agent-task-row .btn.primary')
await page.waitForTimeout(300)
check('approve marks done', (await page.textContent('.agent-task-status')).includes('Done'))

// persistence of tasks
await page.reload()
await page.waitForTimeout(600)
check('task persists after reload', await page.isVisible('.agent-task-row'))

// issue detail delegate button resets after done
await page.goto('http://localhost:4173/#/issue/ENG-2701')
await page.waitForTimeout(400)
check('delegate available again after done', await page.isVisible('.delegate-btn:not(.working)'))

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
