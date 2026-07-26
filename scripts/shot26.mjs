// Two-round file retrieval + delegation templates + context visibility:
// virtual context chips; GitHub mode where the model names its files from
// the tree; template instruction lands in the prompt; selection failure
// falls back to the relevance scan.
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
await new Promise((r) => server.listen(4181, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

// ── GitHub fixtures ─────────────────────────────────────────────
const CONTENTS = {
  'src/a.ts': 'export const A = 1 // A-CONTENT\n',
  'src/b.ts': 'export const B = 2 // B-CONTENT\n',
  'README.md': '# demo repo README-CONTENT\n',
}
await ctx.route('https://api.github.com/**', (route) => {
  const url = route.request().url()
  const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  if (url.endsWith('/repos/octo/demo')) return json({ default_branch: 'main', full_name: 'octo/demo' })
  if (url.includes('/git/trees/')) {
    return json({
      tree: [
        { path: 'src/a.ts', type: 'blob', size: 100 },
        { path: 'src/b.ts', type: 'blob', size: 100 },
        { path: 'README.md', type: 'blob', size: 50 },
      ],
    })
  }
  const m = url.match(/\/contents\/([^?]+)/)
  if (m) {
    const p = decodeURIComponent(m[1])
    if (CONTENTS[p]) return json({ content: b64(CONTENTS[p]), sha: 'sha-' + p })
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  }
  return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
})

// ── Relay fixtures ──────────────────────────────────────────────
let selectionPrompt = ''
let agentPrompt = ''
let selectionCalls = 0
const agentJson = JSON.stringify({
  steps: ['Read a.ts', 'Applied the change'],
  summary: 'Edited a.ts only.',
  edits: [{ path: 'src/a.ts', find: 'export const A = 1', replace: 'export const A = 42' }],
})
await ctx.route('https://relay.example/**', (route) => {
  const body = JSON.parse(route.request().postData() || '{}')
  const userMsg = (body.messages ?? []).find((mm) => mm.role === 'user')?.content ?? ''
  const json = (content) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content } }] }) })
  if (userMsg.includes('Which files do you need to READ')) {
    selectionCalls += 1
    if (selectionCalls === 1) {
      selectionPrompt = userMsg
      return json('{"files": ["src/a.ts", "README.md"]}')
    }
    return json('sorry, I cannot help with that') // round 2: garbage → fallback
  }
  if (userMsg.startsWith('You are a coding agent')) {
    agentPrompt = userMsg
    return json(agentJson)
  }
  return json('好的。')
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// 1. virtual mode: context chips appear even without GitHub
await page.goto('http://localhost:4181/#/issue/LIN-2')
await page.waitForTimeout(600)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
await page.click('.delegate-btn.review')
await page.waitForTimeout(400)
check('virtual task shows context files', (await page.locator('.ctx-chip.file').count()) >= 3)

// 2. configure relay + GitHub, delegate LIN-1 with the conservative template
await page.goto('http://localhost:4181/#/settings')
await page.waitForTimeout(400)
await page.click('.add-provider-btn')
await page.click('.provider-form .tab:has-text("OpenAI")')
await page.fill('.pf-name', '测试中转')
await page.fill('.pf-base', 'https://relay.example/v1')
await page.fill('.pf-key', 'sk-relay-123')
await page.fill('.pf-model', 'deepseek-chat')
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(200)
await page.locator('.settings-input').nth(0).fill('ghp_FIXTURE')
await page.locator('.settings-input').nth(1).fill('octo/demo')
await page.waitForTimeout(200)

await page.goto('http://localhost:4181/#/issue/LIN-1')
await page.waitForTimeout(300)
await page.click('.delegate-caret')
await page.waitForTimeout(200)
check('template menu opens', await page.isVisible('.menu-item:has-text("保守修复")'))
await page.click('.menu-item:has-text("保守修复")')
await page.waitForSelector('.delegate-btn.review', { timeout: 30000 })
await page.click('.delegate-btn.review')
await page.waitForTimeout(400)

// 3. two-round retrieval verified end to end
check('selection prompt got the tree', selectionPrompt.includes('src/b.ts') && selectionPrompt.includes('README.md'))
check('agent got selected file content', agentPrompt.includes('A-CONTENT') && agentPrompt.includes('README-CONTENT'))
check('agent did NOT get unselected file', !agentPrompt.includes('B-CONTENT'))
check('template instruction in prompt', agentPrompt.includes('CONSERVATIVE FIX'))
check('diff shows the edit', (await page.locator('.diff-body').innerText()).includes('42'))

// 4. context row: template chip + selected files, not the unselected one
const ctxText = await page.locator('.task-context').innerText()
check('context shows template chip', ctxText.includes('保守修复'))
check('context lists selected files', ctxText.includes('a.ts') && ctxText.includes('README.md'))
check('context omits unselected file', !ctxText.includes('b.ts'))

// 5. selection failure → relevance-scan fallback still completes
await page.goto('http://localhost:4181/#/issue/LIN-3')
await page.waitForTimeout(300)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 30000 })
check('fallback run reaches review', true)
const state = await page.evaluate(() => JSON.parse(localStorage.getItem('linage-state-v2')))
const t3 = state.agentTasks.find((tk) => tk.issueId === 'LIN-3')
check('fallback step is honest', t3.steps.some((s) => s.includes('falling back')))
check('fallback context files recorded', Array.isArray(t3.contextFiles) && t3.contextFiles.length > 0)

await page.screenshot({ path: 'shot26-tworound.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
