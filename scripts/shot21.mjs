// Review-page revision loop e2e: revise a simulated task twice (new diff
// each round, history chips, activity events), approve after revising, and
// verify a relay-mode revision prompt carries the previous attempt.
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
await new Promise((r) => server.listen(4176, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

// relay fixture: round 1 → v1 edit; revision round → v2 edit (capture prompt)
let agentCalls = 0
let revisionPrompt = ''
const mkJson = (mark, summary) =>
  JSON.stringify({
    steps: ['Analyzed the request', 'Applied the change'],
    summary,
    edits: [{ path: 'client/src/startup/AppBoot.swift', find: '        store.waitUntilSynced()', replace: `        ${mark}` }],
  })
await ctx.route('https://relay.example/**', (route) => {
  const body = JSON.parse(route.request().postData() || '{}')
  const userMsg = (body.messages ?? []).find((m) => m.role === 'user')?.content ?? ''
  if (!userMsg.startsWith('You are a coding agent')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '好的。' } }] }) })
  }
  agentCalls += 1
  if (userMsg.includes('REVISION ROUND')) revisionPrompt = userMsg
  const content = agentCalls === 1 ? mkJson('// v1-mark', 'First proposal.') : mkJson('// v2-mark 修订生效', 'Revised proposal.')
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)
const waitDiffContains = (text) =>
  page.waitForFunction(
    (s) => (document.querySelector('.diff-body')?.textContent ?? '').includes(s),
    text,
    { timeout: 25000 },
  )

// ── Part 1: simulated revision loop ─────────────────────────────
await page.goto('http://localhost:4176/#/issue/LIN-2')
await page.waitForTimeout(600)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
await page.click('.delegate-btn.review')
await page.waitForTimeout(400)
check('revision composer on review page', await page.isVisible('.revise-composer'))
check('round-1 diff shows the change', (await page.locator('.diff-body').innerText()).includes('opacity'))

// revision 1
await page.fill('.revise-composer .composer-input', '顺便加一行注释说明原因')
await page.keyboard.press('Enter')
await page.waitForTimeout(400)
check('working banner while revising', await page.isVisible('.diff-actions .spinner'))
check('composer hidden while revising', !(await page.isVisible('.revise-composer')))
await waitDiffContains('[revision] 顺便加一行注释说明原因')
check('round-2 diff folds the feedback in', true)
check('summary reflects revision', (await page.locator('.task-summary-line').innerText()).includes('Revised per feedback'))
check('history chip 修订 1', await page.isVisible('.revise-item:has-text("顺便加一行注释")'))

// revision 2
await page.waitForSelector('.revise-composer', { timeout: 5000 })
await page.fill('.revise-composer .composer-input', '再精简一点')
await page.keyboard.press('Enter')
await waitDiffContains('[revision] 再精简一点')
check('second revision round works', true)
check('two history chips', (await page.locator('.revise-item').count()) === 2)

// approve after revising
await page.waitForSelector('.revise-composer', { timeout: 5000 })
await page.click('.btn.primary:has-text("批准并应用")')
await page.waitForTimeout(500)
check('approve works after revisions', await page.isVisible('.applied-chip'))
check('composer gone once applied', !(await page.isVisible('.revise-composer')))

// activity on the issue
await page.goto('http://localhost:4176/#/issue/LIN-2')
await page.waitForTimeout(400)
const activity = await page.locator('.activity').innerText()
check('activity logs revisions', activity.includes('你提出了修订意见') && activity.includes('再精简一点'))

// ── Part 2: relay revision carries the previous attempt ─────────
await page.goto('http://localhost:4176/#/settings')
await page.waitForTimeout(400)
await page.click('.tab:has-text("OpenAI")')
await page.waitForTimeout(200)
await page.locator('.settings-input').nth(0).fill('https://relay.example/v1')
await page.locator('.settings-input').nth(1).fill('sk-relay-123')
await page.locator('.settings-input').nth(2).fill('deepseek-chat')
await page.waitForTimeout(200)
await page.goto('http://localhost:4176/#/issue/LIN-1')
await page.waitForTimeout(300)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
await page.click('.delegate-btn.review')
await waitDiffContains('v1-mark')
await page.waitForSelector('.revise-composer', { timeout: 5000 })
await page.fill('.revise-composer .composer-input', '换个方案')
await page.keyboard.press('Enter')
await waitDiffContains('v2-mark')
check('relay revision produces new diff', true)
check('revision prompt marks the round', revisionPrompt.includes('REVISION ROUND'))
check('revision prompt carries instruction', revisionPrompt.includes('换个方案'))
check('revision prompt carries previous attempt', revisionPrompt.includes('v1-mark'))
check('revision prompt carries previous summary', revisionPrompt.includes('First proposal.'))

await page.screenshot({ path: 'shot21-revise.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
