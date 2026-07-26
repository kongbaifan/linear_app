// Chat → task bridge e2e: convert a conversation into an issue (prefilled
// modal), land on the issue, back-link to the chat, no prefill leakage into
// plain new-issue, and the delegated agent prompt carrying the transcript.
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
await new Promise((r) => server.listen(4175, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

// relay fixture: agent runs go through here; capture the prompt
let agentPrompt = ''
const agentJson = {
  steps: ['Read the prior discussion', 'Located the opacity rule', 'Removed dim styling only', 'Left logic untouched'],
  summary: 'Removed card dimming; logic untouched per the conversation.',
  edits: [
    {
      path: 'client/src/views/RideHistory/RideHistoryPage.tsx',
      find: '  box-shadow: none;\n  opacity: 1;',
      replace: '  box-shadow: none;',
    },
  ],
}
await ctx.route('https://relay.example/**', (route) => {
  const body = JSON.parse(route.request().postData() || '{}')
  const userMsg = (body.messages ?? []).find((m) => m.role === 'user')?.content ?? ''
  if (userMsg.startsWith('You are a coding agent')) {
    agentPrompt = userMsg
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(agentJson) } }] }),
    })
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '好的。' } }] }),
  })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)
const waitReplies = (n) =>
  page.waitForFunction((x) => document.querySelectorAll('.chat-msg .model-badge').length >= x, n, { timeout: 10000 })

// 1. two chat rounds in simulated mode
await page.goto('http://localhost:4175/#/chat')
await page.waitForTimeout(600)
await page.fill('.chat-composer .composer-input', '把行程卡片的透明度 bug 修一下')
await page.keyboard.press('Enter')
await waitReplies(1)
await page.fill('.chat-composer .composer-input', '注意只改样式，别动逻辑')
await page.keyboard.press('Enter')
await waitReplies(2)

// 2. convert to task → modal prefilled
await page.click('.to-task-btn')
await page.waitForTimeout(300)
check('modal opens from chat', await page.isVisible('.modal'))
check(
  'title prefilled from thread',
  (await page.locator('.modal-title-input').inputValue()) === '把行程卡片的透明度 bug 修一下',
)
check(
  'description prefilled with last user message',
  (await page.locator('.modal-desc-input').inputValue()) === '注意只改样式，别动逻辑',
)

// 3. create → lands on the new issue with a back-link
await page.click('.btn.primary')
await page.waitForTimeout(400)
check('lands on issue detail', /#\/issue\/LIN-\d+$/.test(page.url()))
const issueUrl = page.url()
check('from-chat row visible', await page.isVisible('.prop-row.from-chat'))

// 4. back-link → the chat thread, then return
await page.click('.prop-row.from-chat')
await page.waitForTimeout(300)
check('back-link opens the source chat', /#\/chat\/chat-\d+/.test(page.url()))
check('conversation intact', (await page.locator('.chat-msg').count()) === 4)
await page.goto(issueUrl)
await page.waitForTimeout(300)

// 5. plain new issue is NOT polluted by the prefill
await page.goto('http://localhost:4175/#/issues')
await page.waitForTimeout(300)
await page.keyboard.press('c')
await page.waitForTimeout(200)
check('plain modal not prefilled', (await page.locator('.modal-title-input').inputValue()) === '')
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// 6. configure relay, delegate → prompt carries the conversation
await page.goto('http://localhost:4175/#/settings')
await page.waitForTimeout(400)
await page.click('.tab:has-text("OpenAI")')
await page.waitForTimeout(200)
await page.locator('.settings-input').nth(0).fill('https://relay.example/v1')
await page.locator('.settings-input').nth(1).fill('sk-relay-123')
await page.locator('.settings-input').nth(2).fill('deepseek-chat')
await page.waitForTimeout(200)
await page.goto(issueUrl)
await page.waitForTimeout(300)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
check('agent run reaches needsReview', true)
check('prompt includes prior-discussion section', agentPrompt.includes('Prior discussion'))
check('prompt carries chat content', agentPrompt.includes('别动逻辑'))
check('prompt keeps issue description', agentPrompt.includes('Details: 注意只改样式'))

// 7. review shows the relay-provided edit
await page.click('.delegate-btn.review')
await page.waitForTimeout(400)
const diffText = await page.locator('.main').innerText()
check('diff view shows the edit', diffText.includes('opacity') || diffText.includes('RideHistoryPage'))

await page.screenshot({ path: 'shot20-bridge.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
