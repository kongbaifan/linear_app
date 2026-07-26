// Chat (conversation mode) e2e: empty state, simulated replies, persistence,
// multi-thread, delete, real OpenAI-compatible relay via route interception,
// and the in-chat model picker.
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
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

// relay fixture: capture the model each request used
const relayModels = []
await ctx.route('https://relay.example/**', (route) => {
  const body = JSON.parse(route.request().postData() || '{}')
  relayModels.push(body.model)
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: '中转回复:一切正常。' } }] }),
  })
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)
// wait until N assistant replies (badged) exist — never matches the thinking row
const waitReplies = (n) =>
  page.waitForFunction((x) => document.querySelectorAll('.chat-msg .model-badge').length >= x, n, { timeout: 10000 })

// 1. sidebar entry + empty state
await page.goto('http://localhost:4173/#/inbox')
await page.waitForTimeout(600)
await page.click('.nav-item:has-text("对话")')
await page.waitForTimeout(300)
check('sidebar navigates to #/chat', page.url().endsWith('#/chat'))
check('empty state shown', await page.isVisible('.chat-empty-title'))
check('3 suggestion chips', (await page.locator('.chat-suggest').count()) === 3)

// 2. suggestion chip starts a thread with a simulated reply
await page.locator('.chat-suggest').first().click()
await waitReplies(1)
check('thread deep-link url', /#\/chat\/chat-\d+/.test(page.url()))
check('user + assistant messages', (await page.locator('.chat-msg').count()) === 2)
check('reply labeled simulated', await page.isVisible('.chat-msg .model-badge:has-text("simulated")'))
const replyText = await page.locator('.chat-msg-body').nth(1).innerText()
check('simulated reply is honest about itself', replyText.includes('模拟'))

// 3. follow-up via composer
await page.fill('.chat-composer .composer-input', '代码报错了怎么办?')
await page.keyboard.press('Enter')
await waitReplies(2)
check('follow-up round-trip (4 messages)', (await page.locator('.chat-msg').count()) === 4)

// 4. thread list with auto title
check('thread list shows 1 thread', (await page.locator('.chat-thread').count()) === 1)
const title = await page.locator('.chat-thread-title').first().innerText()
check('auto title from first message', title.length > 0 && title !== '新对话')

// 5. persistence across reload
await page.reload()
await page.waitForTimeout(700)
check('messages persist after reload', (await page.locator('.chat-msg').count()) === 4)

// 6. new chat → second thread via composer
await page.click('.panel-header-right .btn:has-text("新对话")')
await page.waitForTimeout(300)
check('new chat shows empty state again', await page.isVisible('.chat-empty-title'))
await page.fill('.chat-composer .composer-input', '你好')
await page.keyboard.press('Enter')
await waitReplies(1)
const greet = await page.locator('.chat-msg-body').nth(1).innerText()
check('greeting playbook answers', greet.includes('对话助手'))
check('2 threads in list', (await page.locator('.chat-thread').count()) === 2)

// 7. switch threads
await page.locator('.chat-thread').nth(1).click()
await page.waitForTimeout(300)
check('switching threads restores messages', (await page.locator('.chat-msg').count()) === 4)

// 8. delete the greeting thread
await page.locator('.chat-thread').nth(0).hover()
await page.locator('.chat-thread').nth(0).locator('.chat-thread-x').click()
await page.waitForTimeout(300)
check('thread deleted', (await page.locator('.chat-thread').count()) === 1)

// 9. real relay provider + in-chat model picker
await page.goto('http://localhost:4173/#/settings')
await page.waitForTimeout(400)
await page.click('.add-provider-btn')
await page.click('.provider-form .tab:has-text("OpenAI")')
await page.fill('.pf-name', '测试中转')
await page.fill('.pf-base', 'https://relay.example/v1')
await page.fill('.pf-key', 'sk-relay-123')
await page.fill('.pf-model', 'deepseek-chat')
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(200)
await page.goto('http://localhost:4173/#/chat')
await page.waitForTimeout(300)
await page.locator('.chat-thread').first().click()
await page.waitForTimeout(300)
check('model button shows configured model', await page.isVisible('.panel-header-right .btn:has-text("deepseek-chat")'))
await page.fill('.chat-composer .composer-input', '真实接口测试')
await page.keyboard.press('Enter')
await page.waitForSelector('.chat-msg-body:has-text("中转回复")', { timeout: 8000 })
check('relay reply rendered', true)
check('relay used configured model', relayModels[0] === 'deepseek-chat')
check('reply badged with model', await page.isVisible('.chat-msg .model-badge:has-text("deepseek-chat")'))

// switch model in place, next request uses it
await page.click('.panel-header-right .btn:has-text("deepseek-chat")')
await page.waitForTimeout(200)
check('model menu lists presets', await page.isVisible('.menu-item:has-text("gpt-4o")'))
await page.click('.menu-item:has-text("kimi-k2")')
await page.waitForTimeout(200)
await page.fill('.chat-composer .composer-input', '换模型再问一次')
await page.keyboard.press('Enter')
await waitReplies(4)
check('8 messages after model switch', (await page.locator('.chat-msg').count()) === 8)
check('in-place model switch takes effect', relayModels[1] === 'kimi-k2')
check('new reply badged with switched model', await page.isVisible('.chat-msg .model-badge:has-text("kimi-k2")'))

await page.screenshot({ path: 'shot18-chat.png' })

// 10. no runtime errors
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
