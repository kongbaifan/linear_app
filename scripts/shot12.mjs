import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'
import http from 'http'
import fs from 'fs'
import path from 'path'

const root = '/home/claude/linear-clone/dist'
const server = http.createServer((req, res) => {
  let p = path.join(root, req.url.split('?')[0].split('#')[0] === '/' ? 'index.html' : req.url.split('?')[0].split('#')[0])
  if (!fs.existsSync(p)) p = path.join(root, 'index.html')
  const ext = path.extname(p)
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': mime })
  res.end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 } })
await ctx.route('https://api.github.com/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ full_name: 'octo/demo', default_branch: 'main' }) }),
)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// route + sidebar gear
await page.goto('http://localhost:4173/#/issues')
await page.waitForTimeout(600)
await page.click('.sidebar-top-actions .icon-btn >> nth=0') // gear
await page.waitForTimeout(300)
check('gear opens settings route', page.url().includes('#/settings'))
check('settings page renders sections', (await page.locator('.settings-section').count()) === 5)

// auto-save: type github repo + token, reload persists
const inputs = page.locator('.settings-input')
await inputs.nth(2).fill('ghp_AUTOSAVE')
await inputs.nth(3).fill('octo/demo')
await page.waitForTimeout(200)
await page.reload()
await page.waitForTimeout(600)
check('settings auto-saved across reload', (await page.locator('.settings-input').nth(3).inputValue()) === 'octo/demo')

// github test connection (intercepted)
await page.locator('.settings-row .btn').nth(1).click()
await page.waitForTimeout(500)
check('test connection shows result', await page.isVisible('.test-result.ok'))
const okText = await page.textContent('.test-result.ok')
check('result shows repo@branch (' + okText.trim() + ')', okText.includes('octo/demo') && okText.includes('main'))

// theme + language pills
await page.click('.settings-section .tab:has-text("Light")')
await page.waitForTimeout(300)
check('light theme applied', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light')
await page.click('.settings-section .tab:has-text("中文")')
await page.waitForTimeout(300)
check('language switched (标题=设置)', (await page.textContent('.panel-title')) === '设置')
await page.screenshot({ path: 'shot12-settings.png' })

// export still works from settings page
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('.btn:has-text("导出备份")'),
])
check('export works from settings page', !!download)

// palette entry
await page.keyboard.press('Control+k')
await page.waitForTimeout(200)
await page.fill('.palette-input', '设置')
await page.waitForTimeout(150)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('palette opens settings', page.url().includes('#/settings'))

// agents page settings button navigates here
await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(300)
await page.click('.panel-header .btn')
await page.waitForTimeout(300)
check('agents settings button routes to page', page.url().includes('#/settings'))

// back to dark/en for cleanliness
await page.click('.settings-section .tab:has-text("深色")')
await page.click('.settings-section .tab:has-text("English")')
await page.waitForTimeout(200)

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
