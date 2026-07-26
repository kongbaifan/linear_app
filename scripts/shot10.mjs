import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'
import http from 'http'
import fs from 'fs'
import path from 'path'

const root = '/home/claude/linear-clone/dist'
const server = http.createServer((req, res) => {
  let p = path.join(root, req.url.split('?')[0].split('#')[0] === '/' ? 'index.html' : req.url.split('?')[0].split('#')[0])
  if (!fs.existsSync(p)) p = path.join(root, 'index.html')
  const ext = path.extname(p)
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': mime })
  res.end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

await page.goto('http://localhost:4173/#/issues')
await page.waitForTimeout(800)

// SW registered
const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? (reg.active ? 'active' : reg.installing ? 'installing' : 'waiting') : 'none'
})
check('service worker registered (' + swState + ')', swState !== 'none')
await page.waitForTimeout(1200) // let SW cache assets

// export: create an issue first, then export
await page.keyboard.press('c')
await page.waitForTimeout(200)
await page.fill('.modal-title-input', 'Backup roundtrip probe')
await page.click('.btn.primary')
await page.waitForTimeout(300)
check('probe issue created', await page.isVisible('.issue-row:has-text("Backup roundtrip probe")'))

await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(300)
await page.click('.panel-header .btn') // settings
await page.waitForTimeout(200)
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('.btn:has-text("Export")'),
])
const backupPath = '/tmp/linage-backup.json'
await download.saveAs(backupPath)
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
check('export file valid (issues=' + backup.issues.length + ')', Array.isArray(backup.issues) && backup.issues.some((i) => i.title === 'Backup roundtrip probe'))

// reset data, probe disappears
await page.keyboard.press('Escape')
await page.keyboard.press('Control+k')
await page.fill('.palette-input', 'reset')
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
await page.goto('http://localhost:4173/#/issues')
await page.waitForTimeout(300)
check('reset removed probe', !(await page.isVisible('.issue-row:has-text("Backup roundtrip probe")')))

// import restores it
await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(300)
await page.click('.panel-header .btn')
await page.waitForTimeout(200)
const fileInput = page.locator('input[type="file"]')
await fileInput.setInputFiles(backupPath)
await page.waitForTimeout(400)
await page.goto('http://localhost:4173/#/issues')
await page.waitForTimeout(300)
check('import restored probe', await page.isVisible('.issue-row:has-text("Backup roundtrip probe")'))

// offline: SW cache serves the app
await ctx.setOffline(true)
await page.reload()
await page.waitForTimeout(1000)
check('offline reload still renders app', await page.isVisible('.sidebar').catch(() => false))
await ctx.setOffline(false)

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
