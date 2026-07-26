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

// delegate the startup-perf issue → playbook edits AppBoot.swift
await page.goto('http://localhost:4173/#/issue/ENG-2703')
await page.waitForTimeout(500)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 20000 })
check('task completes to review state', true)

// open review from issue detail
await page.click('.delegate-btn.review')
await page.waitForTimeout(500)
check('task diff view opens', page.url().includes('#/task/'))
check('diff card rendered', await page.isVisible('.diff-file'))
const fileName = await page.textContent('.diff-file-name')
check('diff targets AppBoot.swift (' + fileName + ')', fileName === 'AppBoot.swift')
const dels = await page.locator('.diff-line.del').count()
const adds = await page.locator('.diff-line.add').count()
check(`real computed diff (+${adds} -${dels})`, adds > 0 && dels > 0)
check('gap collapsing works', await page.isVisible('.diff-line.gap'))
const delText = await page.locator('.diff-line.del .code').first().textContent()
check('del line comes from real file', delText.includes('Block until the full vehicle_state'))
await page.screenshot({ path: 'shot9-taskdiff.png' })

// approve → applied, codebase updated
await page.click('.btn.primary:has-text("Approve")')
await page.waitForTimeout(400)
check('approve → Applied chip', await page.isVisible('.applied-chip'))

// second delegation on same issue: diff should now be the fallback TODO (edits no longer apply)
await page.goto('http://localhost:4173/#/issue/ENG-2703')
await page.waitForTimeout(400)
check('can delegate again', await page.isVisible('.delegate-btn:not(.working):not(.review)'))
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 20000 })
await page.click('.delegate-btn.review')
await page.waitForTimeout(500)
const body2 = await page.textContent('.diff-body')
check('second run sees updated codebase (TODO fallback)', body2.includes('did not apply cleanly'))

// persistence: reload keeps applied codebase + tasks
await page.reload()
await page.waitForTimeout(600)
check('task view persists after reload', await page.isVisible('.diff-file'))

// agents list quick check
await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(400)
check('two tasks listed', (await page.locator('.agent-task').count()) === 2)
await page.screenshot({ path: 'shot9-agents.png' })

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
