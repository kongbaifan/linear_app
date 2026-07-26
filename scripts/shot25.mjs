// Markdown-in-chat e2e: headings, bold, inline code, links, lists, fenced
// code with highlighting and copy button; user messages stay plain text.
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
await new Promise((r) => server.listen(4180, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })

const mdReply = [
  '# 方案概述',
  '',
  '这是 **重点结论**，配 `行内代码` 和链接 [参考文档](https://example.com/doc)。',
  '',
  '- 第一项要点',
  '- 第二项要点',
  '',
  '```ts',
  "const x = 1 // 计数器",
  '```',
  '',
  '> 引用一句话',
].join('\n')

await ctx.route('https://relay.example/**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { content: mdReply } }] }),
  }),
)

const page = await ctx.newPage()
// deterministic clipboard: record writes on window
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (s) => ((window.__copied = s), Promise.resolve()) },
  })
})
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// configure relay provider
await page.goto('http://localhost:4180/#/settings')
await page.waitForTimeout(600)
await page.click('.add-provider-btn')
await page.click('.provider-form .tab:has-text("OpenAI")')
await page.fill('.pf-name', 'MD 中转')
await page.fill('.pf-base', 'https://relay.example/v1')
await page.fill('.pf-key', 'sk-md')
await page.fill('.pf-model', 'deepseek-chat')
await page.click('.provider-form .btn.primary')
await page.waitForTimeout(200)

// send a message containing markdown syntax — user bubble must stay literal
await page.goto('http://localhost:4180/#/chat')
await page.waitForTimeout(400)
await page.fill('.chat-composer .composer-input', '给个 **方案**')
await page.keyboard.press('Enter')
await page.waitForSelector('.chat-md', { timeout: 8000 })

// 1. block + inline rendering
check('heading rendered', (await page.locator('.chat-md h1').innerText()) === '方案概述')
check('bold rendered', await page.isVisible('.chat-md strong:has-text("重点结论")'))
check('inline code rendered', await page.isVisible('.chat-md code.inline:has-text("行内代码")'))
const link = page.locator('.chat-md a:has-text("参考文档")')
check('link rendered with target', (await link.getAttribute('href')) === 'https://example.com/doc' && (await link.getAttribute('target')) === '_blank')
check('list rendered (2 items)', (await page.locator('.chat-md li').count()) === 2)
check('blockquote rendered', await page.isVisible('.chat-md blockquote:has-text("引用一句话")'))

// 2. code block: language label, highlighting, copy
check('codeblock language label', await page.isVisible('.md-codeblock-header:has-text("ts")'))
check('keyword highlighted', await page.isVisible('.md-codeblock .tok-kw:has-text("const")'))
check('comment highlighted', await page.isVisible('.md-codeblock .tok-comment'))
await page.click('.md-copy-btn')
await page.waitForTimeout(100)
check('copy button feedback', await page.isVisible('.md-copy-btn:has-text("已复制")'))
check('clipboard got the code', (await page.evaluate(() => window.__copied)) === 'const x = 1 // 计数器')

// 3. no raw markdown artifacts in the rendered reply
const rendered = await page.locator('.chat-msg-body.md').innerText()
check('no raw ** in output', !rendered.includes('**'))
check('no raw ``` in output', !rendered.includes('```'))

// 4. user message stays literal plain text
const userBody = await page.locator('.chat-msg-body').first().innerText()
check('user message keeps literal markdown', userBody === '给个 **方案**')

await page.screenshot({ path: 'shot25-markdown.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
