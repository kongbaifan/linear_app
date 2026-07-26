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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: 1.5 })
await ctx.route('https://api.github.com/user/repos**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { full_name: 'kongbaifan/linear_app', language: 'TypeScript', pushed_at: new Date().toISOString(), private: false },
      { full_name: 'kongbaifan/other-repo', language: 'Python', pushed_at: new Date().toISOString(), private: true },
    ]),
  }),
)
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const results = []
const check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)

// fresh open: default zh + inbox with welcome notification
await page.goto('http://localhost:4173/')
await page.waitForTimeout(800)
check('default view renders inbox', await page.isVisible('.inbox-list'))
check('default locale zh (收件箱)', await page.isVisible('.panel-title:has-text("收件箱")'))
check('welcome notification', await page.isVisible('.inbox-row:has-text("欢迎使用 Linage")'))

// sample issues with badges, executor avatars
await page.click('.nav-item:has-text("我的事项")')
await page.waitForTimeout(400)
check('3 sample issues', (await page.locator('.issue-row').count()) === 3)
check('sample badge shown', (await page.locator('.issue-row .sample-badge').count()) === 3)
check('no fake teammates (no karri)', !(await page.textContent('body')).includes('karri'))
await page.screenshot({ path: 'shot15-list.png' })

// issue detail: description + executor + project + activity
await page.click('.issue-row:has-text("优化 App 启动速度")')
await page.waitForTimeout(400)
check('description rendered', (await page.textContent('.issue-description')).includes('AppBoot.swift'))
check('executor row Agent', (await page.textContent('.props-panel')).includes('Agent'))
check('project row 上手 Linage', (await page.textContent('.props-panel')).includes('上手 Linage'))
check('activity created event', await page.isVisible('.event-text:has-text("你创建了此事项")'))

// delegate → zh title matches playbook via 启动 keyword
await page.click('.delegate-btn')
await page.waitForSelector('.delegate-btn.review', { timeout: 25000 })
check('delegation completes (zh keyword playbook)', true)
check('activity shows delegated + finished', await page.isVisible('.event-text:has-text("已委派给 Agent")'))

// inbox got real needsReview notification
await page.click('.nav-item:has-text("收件箱")')
await page.waitForTimeout(400)
check('inbox has needsReview notif', await page.isVisible('.inbox-row:has-text("请审查变更")'))
await page.screenshot({ path: 'shot15-inbox.png' })
await page.click('.inbox-row:has-text("请审查变更")')
await page.waitForTimeout(400)
check('notif click opens task diff', page.url().includes('#/task/'))
check('diff targets AppBoot.swift', (await page.textContent('.diff-file-name')) === 'AppBoot.swift')

// reviews page lists it; approve from there
await page.click('.nav-item:has-text("审查")')
await page.waitForTimeout(300)
check('reviews lists the task', (await page.locator('.agent-task').count()) === 1)
await page.click('.agent-task-row .btn.primary')
await page.waitForTimeout(400)
check('approve empties reviews', await page.isVisible('.agents-empty'))
// applied notification generated
await page.click('.nav-item:has-text("收件箱")')
await page.waitForTimeout(300)
check('applied notif in inbox', await page.isVisible('.inbox-row:has-text("已批准并应用")'))

// configure a GitHub token first (provider=simulated hides AI inputs, so GitHub token is input 0)
await page.goto('http://localhost:4173/#/settings')
await page.waitForTimeout(400)
await page.locator('.settings-input').nth(0).fill('ghp_FIXTURE')
await page.waitForTimeout(200)

// projects: repo list via intercepted API + local project create
await page.click('.nav-item:has-text("项目")')
await page.waitForTimeout(700)
check('repo list rendered', (await page.locator('.repo-row').count()) === 2)
await page.click('.repo-row:has-text("other-repo")')
await page.waitForTimeout(300)
check('click sets active repo', await page.isVisible('.repo-row:has-text("other-repo") .test-result.ok'))
await page.fill('.settings-input', '我的新项目')
await page.click('.btn:has-text("新建项目")')
await page.waitForTimeout(300)
check('local project created', await page.isVisible('.local-project-row:has-text("我的新项目")'))
check('sample project progress shown', await page.isVisible('.local-project-row:has-text("上手 Linage")'))
await page.screenshot({ path: 'shot15-projects.png' })

// legacy v1 storage migrates settings only
await page.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('linear-clone-state-v1', JSON.stringify({
    issues: [{ id: 'ENG-1', title: 'old fake', status: 'todo', priority: 'low', labels: [], date: 'Jul 1' }],
    notifications: [],
    theme: 'light',
    settings: { provider: { kind: 'openai', baseUrl: 'https://relay.example/v1', apiKey: 'sk-x', model: 'deepseek-chat' }, githubToken: 'ghp_x', githubRepo: 'a/b' },
  }))
})
await page.goto('http://localhost:4173/#/issues')
await page.reload()
await page.waitForTimeout(700)
check('v1 fake issues dropped, samples restored', await page.isVisible('.issue-row:has-text("示例")'))
const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('linage-state-v2')).settings)
check('v1 settings migrated (relay kept)', migrated.provider.baseUrl === 'https://relay.example/v1' && migrated.githubRepo === 'a/b')

console.log(results.join('\n'))
console.log('pageerrors:', errors.length ? errors : 'none')
await browser.close()
server.close()
