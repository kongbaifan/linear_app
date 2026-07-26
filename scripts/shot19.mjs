// Streaming e2e: incremental text growth + cursor, stop button keeps the
// partial reply, resume after stop, SSE relay parsing, and the plain-JSON
// fallback for relays that ignore stream:true.
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
await new Promise((r) => server.listen(4174, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

// relay fixture: 1st request → SSE stream; 2nd request → plain JSON (fallback)
let relayCalls = 0
await ctx.route('https://relay.example/**', (route) => {
  relayCalls += 1
  if (relayCalls === 1) {
    const sse =
      'data: {"choices":[{"delta":{"content":"流式"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"回复"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"成功。"}}]}\n\n' +
      'data: [DONE]\n\n'
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse })
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '非流式回退也正常。' } }] }),
  })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)
const waitReplies = (n) =>
  page.waitForFunction((x) => document.querySelectorAll('.chat-msg .model-badge').length >= x, n, { timeout: 10000 })

// 1. simulated streaming: text grows, cursor blinks, stop button shows
await page.goto('http://localhost:4174/#/chat')
await page.waitForTimeout(600)
await page.fill('.chat-composer .composer-input', '你好')
await page.keyboard.press('Enter')
await page.waitForSelector('.send-btn.stop', { timeout: 5000 })
check('stop button replaces send while busy', true)
await page.waitForSelector('.chat-msg-body.streaming', { timeout: 5000 })
check('streaming bubble appears', true)
check('cursor visible', await page.isVisible('.stream-cursor'))
const len1 = (await page.locator('.chat-msg-body.streaming').innerText()).length
await page.waitForFunction(
  (n) => (document.querySelector('.chat-msg-body.streaming')?.textContent ?? '').length > n,
  len1,
  { timeout: 3000 },
)
check('text grows incrementally', true)
await waitReplies(1)
check('final reply committed', (await page.locator('.chat-msg').count()) === 2)
check('streaming bubble gone after commit', !(await page.isVisible('.chat-msg-body.streaming')))
check('send button restored', await page.isVisible('.send-btn:not(.stop)'))
const full1 = await page.locator('.chat-msg-body').nth(1).innerText()
check('full reply includes closing note', full1.includes('内置模拟回复'))

// 2. stop mid-stream keeps the partial text
await page.fill('.chat-composer .composer-input', '任务应该怎么拆?')
await page.keyboard.press('Enter')
await page.waitForSelector('.chat-msg-body.streaming', { timeout: 5000 })
await page.click('.send-btn.stop')
await waitReplies(2)
check('partial committed after stop', (await page.locator('.chat-msg').count()) === 4)
const partial = await page.locator('.chat-msg-body').nth(3).innerText()
check('stopped reply is truncated (no closing note)', partial.length > 0 && !partial.includes('内置模拟回复'))
check('busy cleared after stop', await page.isVisible('.send-btn:not(.stop)'))

// 3. conversation continues normally after a stop
await page.fill('.chat-composer .composer-input', '继续')
await page.keyboard.press('Enter')
await waitReplies(3)
check('next round-trip works after stop', (await page.locator('.chat-msg').count()) === 6)

// 4. real SSE relay
await page.goto('http://localhost:4174/#/settings')
await page.waitForTimeout(400)
await page.click('.tab:has-text("OpenAI")')
await page.waitForTimeout(200)
await page.locator('.settings-input').nth(0).fill('https://relay.example/v1')
await page.locator('.settings-input').nth(1).fill('sk-relay-123')
await page.locator('.settings-input').nth(2).fill('deepseek-chat')
await page.waitForTimeout(200)
await page.goto('http://localhost:4174/#/chat')
await page.waitForTimeout(300)
await page.locator('.chat-thread').first().click()
await page.waitForTimeout(300)
await page.fill('.chat-composer .composer-input', 'SSE 测试')
await page.keyboard.press('Enter')
await waitReplies(4)
const sseText = await page.locator('.chat-msg-body').nth(7).innerText()
check('SSE deltas concatenated', sseText === '流式回复成功。')
check('SSE reply badged with model', await page.isVisible('.chat-msg .model-badge:has-text("deepseek-chat")'))

// 5. plain-JSON fallback when relay ignores stream:true
await page.fill('.chat-composer .composer-input', '回退测试')
await page.keyboard.press('Enter')
await waitReplies(5)
const fbText = await page.locator('.chat-msg-body').nth(9).innerText()
check('non-stream JSON fallback rendered', fbText === '非流式回退也正常。')

await page.screenshot({ path: 'shot19-stream.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
