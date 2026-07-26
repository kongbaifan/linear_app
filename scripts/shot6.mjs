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

await page.goto('http://localhost:4173/#/issues')
await page.waitForTimeout(500)
check('default is English (My issues nav)', await page.isVisible('.nav-item:has-text("My issues")'))

// switch to Chinese via sidebar button
await page.click('.lang-btn')
await page.waitForTimeout(300)
check('nav switches to 我的事项', await page.isVisible('.nav-item:has-text("我的事项")'))
check('收件箱 in nav', await page.isVisible('.nav-item:has-text("收件箱")'))
check('group header 进行中', await page.isVisible('.group-header:has-text("进行中")'))
check('filter button 筛选', await page.isVisible('.filter-btn:has-text("筛选")'))
check('issue titles stay English', await page.isVisible('.issue-row-title:has-text("Faster app launch")'))
await page.screenshot({ path: 'shot6-zh-list.png' })

// persists after reload
await page.reload()
await page.waitForTimeout(600)
check('locale persists after reload', await page.isVisible('.nav-item:has-text("我的事项")'))

// detail view in Chinese
await page.goto('http://localhost:4173/#/issue/ENG-2703')
await page.waitForTimeout(500)
check('活动 heading', await page.isVisible('.section-heading:has-text("活动")'))
check('进行中 in props', (await page.textContent('.props-panel')).includes('进行中'))
check('标签 label', (await page.textContent('.props-panel')).includes('标签'))
await page.screenshot({ path: 'shot6-zh-detail.png' })

// palette in Chinese
await page.keyboard.press('Control+k')
await page.waitForTimeout(300)
const ph = await page.getAttribute('.palette-input', 'placeholder')
check('palette placeholder in Chinese (' + ph + ')', ph.includes('输入命令'))
check('新建事项 command', await page.isVisible('.palette-item:has-text("新建事项")'))
await page.screenshot({ path: 'shot6-zh-palette.png' })

// switch back to English via palette language command
await page.fill('.palette-input', '语言')
await page.waitForTimeout(200)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('palette switches back to English', await page.isVisible('.nav-item:has-text("My issues")'))

// projects + inbox + diff spot checks in Chinese
await page.click('.lang-btn')
await page.waitForTimeout(300)
await page.goto('http://localhost:4173/#/projects')
await page.waitForTimeout(400)
check('项目 header + 正常 health', (await page.textContent('.projects-table')).includes('正常'))
await page.goto('http://localhost:4173/#/review/ENG-2498')
await page.waitForTimeout(400)
check('提交审查 button', await page.isVisible('.btn:has-text("提交审查")'))
check('差异 tab', await page.isVisible('.tab:has-text("差异")'))

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
