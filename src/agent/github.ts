// Minimal GitHub REST client for the agent, browser-direct.
// The token never leaves the browser; it is sent only to api.github.com.
import type { FileChange } from '../store'

const API = 'https://api.github.com'

async function gh(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`)
  return res.json()
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function decodeB64(b64: string): string {
  const bytes = Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeB64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|py|go|rs|swift|kt|java|rb|c|h|cpp|cs|css|scss|md|json|yml|yaml|html|vue|svelte)$/i
const IGNORE_RE = /(^|\/)(node_modules|dist|build|vendor|\.git)\/|(^|\/)package-lock\.json$|\.min\./

/** List candidate source file paths for agentic file selection. */
export async function fetchRepoTree(
  token: string,
  repo: string,
): Promise<{ baseBranch: string; paths: string[] }> {
  const info = await gh(token, `/repos/${repo}`)
  const baseBranch: string = info.default_branch ?? 'main'
  const tree = await gh(token, `/repos/${repo}/git/trees/${encodeURIComponent(baseBranch)}?recursive=1`)
  const paths = (tree.tree ?? [])
    .filter(
      (t: { type?: string; path?: string; size?: number }) =>
        t.type === 'blob' &&
        typeof t.path === 'string' &&
        SOURCE_RE.test(t.path) &&
        !IGNORE_RE.test(t.path) &&
        (t.size ?? 0) < 60_000,
    )
    .map((t: { path: string }) => t.path)
    .slice(0, 400)
  if (paths.length === 0) throw new Error('No readable source files found in repo')
  return { baseBranch, paths }
}

/** Fetch the contents of specific (agent-selected) files. */
export async function fetchFilesByPath(
  token: string,
  repo: string,
  baseBranch: string,
  paths: string[],
): Promise<Record<string, string>> {
  const codebase: Record<string, string> = {}
  let total = 0
  for (const p of paths) {
    try {
      const data = await gh(token, `/repos/${repo}/contents/${encodePath(p)}?ref=${encodeURIComponent(baseBranch)}`)
      const text = decodeB64(data.content ?? '')
      total += text.length
      if (total > 150_000) break
      codebase[p] = text
    } catch {
      // unreadable file (submodule, oversized, deleted) — skip it
    }
  }
  return codebase
}

/** Pick the most issue-relevant files from the repo and fetch their contents. */
export async function fetchRepoFiles(
  token: string,
  repo: string,
  issueTitle: string,
  maxFiles = 6,
): Promise<{ baseBranch: string; codebase: Record<string, string> }> {
  const info = await gh(token, `/repos/${repo}`)
  const baseBranch: string = info.default_branch ?? 'main'

  const tree = await gh(token, `/repos/${repo}/git/trees/${encodeURIComponent(baseBranch)}?recursive=1`)
  const blobs: { path: string; size?: number }[] = (tree.tree ?? []).filter(
    (t: any) =>
      t.type === 'blob' && SOURCE_RE.test(t.path) && !IGNORE_RE.test(t.path) && (t.size ?? 0) < 60_000,
  )

  const words = issueTitle.toLowerCase().split(/\W+/).filter((w) => w.length > 2)
  const score = (p: string) => {
    const lower = p.toLowerCase()
    let n = words.reduce((acc, w) => acc + (lower.includes(w) ? 2 : 0), 0)
    if (/readme/i.test(p)) n += 1
    return n - p.split('/').length * 0.1
  }
  const picked = blobs.sort((a, b) => score(b.path) - score(a.path)).slice(0, maxFiles)

  const codebase: Record<string, string> = {}
  let total = 0
  for (const blob of picked) {
    const data = await gh(token, `/repos/${repo}/contents/${encodePath(blob.path)}?ref=${encodeURIComponent(baseBranch)}`)
    const text = decodeB64(data.content ?? '')
    total += text.length
    if (total > 120_000) break
    codebase[blob.path] = text
  }
  if (Object.keys(codebase).length === 0) throw new Error('No readable source files found in repo')
  return { baseBranch, codebase }
}

/** Create a branch, commit each change, open a PR. Returns the PR URL. */
export async function applyToGitHub(
  token: string,
  repo: string,
  baseBranch: string,
  branch: string,
  changes: FileChange[],
  message: string,
): Promise<string> {
  const ref = await gh(token, `/repos/${repo}/git/ref/${encodeURIComponent(`heads/${baseBranch}`)}`)
  await gh(token, `/repos/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref.object.sha }),
  })

  for (const change of changes) {
    let sha: string | undefined
    try {
      const cur = await gh(
        token,
        `/repos/${repo}/contents/${encodePath(change.path)}?ref=${encodeURIComponent(branch)}`,
      )
      sha = cur.sha
    } catch {
      // new file — no sha needed
    }
    await gh(token, `/repos/${repo}/contents/${encodePath(change.path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `${message} (${change.path})`,
        content: encodeB64(change.after),
        branch,
        ...(sha ? { sha } : {}),
      }),
    })
  }

  try {
    const pr = await gh(token, `/repos/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: message,
        head: branch,
        base: baseBranch,
        body: 'Automated change proposed by the Linage agent. Review the diff before merging.',
      }),
    })
    return pr.html_url
  } catch {
    // PR creation can fail (forks, permissions) — the compare link still works.
    return `https://github.com/${repo}/compare/${baseBranch}...${branch}?expand=1`
  }
}
