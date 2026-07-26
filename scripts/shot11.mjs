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

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
const README = '# Demo Project\n\nA sample repository.\n'
const APP_TS = 'export const answer = 42\n'

const calls = []
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 } })

// Intercept ALL GitHub API traffic with fixtures.
await ctx.route('https://api.github.com/**', async (route) => {
  const req = route.request()
  const url = new URL(req.url())
  const key = `${req.method()} ${url.pathname}`
  calls.push(key)
  const json = (obj, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) })

  if (key === 'GET /repos/octo/demo') return json({ default_branch: 'main' })
  if (key.startsWith('GET /repos/octo/demo/git/trees/'))
    return json({ tree: [
      { path: 'README.md', type: 'blob', size: README.length },
      { path: 'src/app.ts', type: 'blob', size: APP_TS.length },
    ] })
  if (key === 'GET /repos/octo/demo/contents/README.md')
    return json({ content: b64(README), sha: 'sha-readme' })
  if (key === 'GET /repos/octo/demo/contents/src/app.ts')
    return json({ content: b64(APP_TS), sha: 'sha-app' })
  if (key === 'GET /repos/octo/demo/git/ref/heads%2Fmain' || key === 'GET /repos/octo/demo/git/ref/heads/main')
    return json({ object: { sha: 'base-sha' } })
  if (key === 'POST /repos/octo/demo/git/refs') return json({}, 201)
  if (req.method() === 'PUT' && url.pathname.startsWith('/repos/octo/demo/contents/'))
    return json({ content: { sha: 'new-sha' } })
  if (key === 'POST /repos/octo/demo/pulls')
    return json({ html_url: 'https://github.com/octo/demo/pull/7' }, 201)
  return json({ message: 'not found' }, 404)
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// configure GitHub settings
await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(600)
await page.click('.panel-header .btn')
await page.waitForTimeout(200)
const inputs = page.locator('.settings-input')
await inputs.nth(2).fill('ghp_FIXTURE')      // github token
await inputs.nth(3).fill('octo/demo')        // repo
await page.click('.btn.primary:has-text("Save"), .btn.primary:has-text("保存")')
await page.waitForTimeout(200)

// delegate an issue → github mode
await page.goto('http://localhost:4173/#/issue/ENG-2709')
await page.waitForTimeout(400)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
check('github task completes to review', true)

await page.click('.delegate-btn.review')
await page.waitForTimeout(500)
check('repo badge shown', await page.isVisible('.repo-badge:has-text("octo/demo")'))
const fileName = await page.textContent('.diff-file-name')
check('diff targets fetched README (' + fileName + ')', fileName === 'README.md')
const addText = await page.locator('.diff-line.add .code').first().textContent()
check('added line references issue', addText.includes('ENG-2709'))
check('repo files were fetched via API', calls.some((c) => c.includes('contents/README.md')))
await page.screenshot({ path: 'shot11-gh-diff.png' })

// approve → branch + commits + PR via API
await page.click('.btn.primary')
await page.waitForSelector('a:has-text("pull request"), a:has-text("Pull Request")', { timeout: 15000 })
const prHref = await page.locator('a.btn.primary').getAttribute('href')
check('PR link shown (' + prHref + ')', prHref === 'https://github.com/octo/demo/pull/7')
check('branch created via API', calls.some((c) => c === 'POST /repos/octo/demo/git/refs'))
check('file committed via API', calls.some((c) => c.startsWith('PUT /repos/octo/demo/contents/')))
check('PR created via API', calls.some((c) => c === 'POST /repos/octo/demo/pulls'))
await page.screenshot({ path: 'shot11-gh-done.png' })

// agents list shows PR shortcut
await page.goto('http://localhost:4173/#/agents')
await page.waitForTimeout(400)
check('PR shortcut in task list', await page.isVisible('a:has-text("PR ↗")'))

// virtual mode still intact when github cleared
await page.click('.panel-header .btn')
await page.waitForTimeout(200)
await page.locator('.settings-input').nth(2).fill('')
await page.locator('.settings-input').nth(3).fill('')
await page.click('.btn.primary:has-text("Save"), .btn.primary:has-text("保存")')
await page.waitForTimeout(200)
await page.goto('http://localhost:4173/#/issue/ENG-2703')
await page.waitForTimeout(300)
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
await page.click('.delegate-btn.review')
await page.waitForTimeout(400)
const vName = await page.textContent('.diff-file-name')
check('virtual mode still works (' + vName + ')', vName === 'AppBoot.swift')

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
