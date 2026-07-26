import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'
import http from 'http'
import fs from 'fs'
import path from 'path'

const root = '/home/claude/linear-clone/dist'
const server = http.createServer((req, res) => {
  let p = path.join(root, req.url === '/' ? 'index.html' : req.url)
  if (!fs.existsSync(p)) p = path.join(root, 'index.html')
  const ext = path.extname(p)
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': mime })
  res.end(fs.readFileSync(p))
})
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: 1.5 })
await page.goto('http://localhost:4173')
await page.waitForTimeout(600)
await page.screenshot({ path: 'shot-issue.png' })

// list view
await page.click('text=My issues')
await page.waitForTimeout(300)
await page.screenshot({ path: 'shot-list.png' })

// diff view
await page.click('text=Reviews')
await page.waitForTimeout(300)
await page.screenshot({ path: 'shot-diff.png' })

await browser.close()
server.close()
console.log('done')
