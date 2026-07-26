// Legacy v1 (flat settings) migration into the provider-profiles model:
// an old { apiKey, model } config must surface as a saved, active profile.
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
await new Promise((r) => server.listen(4172, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

await page.addInitScript(() => {
  if (!localStorage.getItem('__seeded')) {
    localStorage.setItem('__seeded', '1')
    localStorage.setItem(
      'linear-clone-state-v1',
      JSON.stringify({
        issues: [{ id: 'ENG-1', title: 'Legacy issue', status: 'todo', priority: 'low', labels: [], date: 'Jul 26' }],
        notifications: [],
        settings: { apiKey: 'sk-ant-LEGACY', model: 'claude-3-7', githubToken: '', githubRepo: '' },
      }),
    )
  }
})
await page.goto('http://localhost:4172/#/settings')
await page.waitForTimeout(700)

// legacy flat config becomes a saved + active Anthropic profile
check('legacy config surfaces as a profile row', await page.isVisible('.provider-row:has-text("Anthropic")'))
check(
  'migrated profile is active',
  await page.isVisible('.provider-row:has-text("Anthropic") .provider-active-badge'),
)
check(
  'row shows official base + legacy model',
  await page.isVisible('.provider-row:has-text("api.anthropic.com")'),
)

// edit shows preserved credentials
await page.locator('.provider-row:has-text("Anthropic") .btn:has-text("编辑")').click()
await page.waitForTimeout(200)
check('legacy key preserved', (await page.locator('.pf-key').inputValue()) === 'sk-ant-LEGACY')
check('legacy model preserved', (await page.locator('.pf-model').inputValue()) === 'claude-3-7')
await page.click('.provider-form .btn:has-text("取消")')

// switching to simulator and back keeps the profile
await page.locator('.provider-row:has-text("内置模拟") .btn:has-text("启用")').click()
await page.waitForTimeout(200)
check('simulator can take over', await page.isVisible('.provider-row:has-text("内置模拟") .provider-active-badge'))
await page.locator('.provider-row:has-text("Anthropic") .btn:has-text("启用")').click()
await page.waitForTimeout(200)
check('profile re-activates', await page.isVisible('.provider-row:has-text("Anthropic") .provider-active-badge'))

await page.screenshot({ path: 'shot13-provider.png' })
console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
