// Line-level diff (LCS) between two file versions, producing the same
// DiffLine shape the diff viewer renders. Unchanged runs are collapsed
// into hunks with a few lines of context.

export interface RenderedDiffLine {
  kind: 'context' | 'add' | 'del' | 'gap'
  no: number | null
  html: string
}

export interface RenderedDiffFile {
  name: string
  path: string
  added: number
  removed: number
  lines: RenderedDiffLine[]
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type Op = { type: 'same' | 'add' | 'del'; text: string }

function diffOps(before: string[], after: string[]): Op[] {
  const n = before.length
  const m = after.length
  // LCS length table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ type: 'same', text: before[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', text: before[i] })
      i++
    } else {
      ops.push({ type: 'add', text: after[j] })
      j++
    }
  }
  while (i < n) ops.push({ type: 'del', text: before[i++] })
  while (j < m) ops.push({ type: 'add', text: after[j++] })
  return ops
}

const CONTEXT = 3

export function renderDiff(
  path: string,
  before: string,
  after: string,
  collapse = true,
): RenderedDiffFile {
  const ops = diffOps(before.split('\n'), after.split('\n'))

  // Mark which ops to keep: every change + CONTEXT lines around it.
  // With collapse=false, every line is kept (expanded view).
  const keep = new Array(ops.length).fill(!collapse)
  ops.forEach((op, idx) => {
    if (op.type !== 'same') {
      for (let k = Math.max(0, idx - CONTEXT); k <= Math.min(ops.length - 1, idx + CONTEXT); k++) {
        keep[k] = true
      }
    }
  })

  const lines: RenderedDiffLine[] = []
  let added = 0
  let removed = 0
  let newNo = 0
  let inGap = false
  ops.forEach((op, idx) => {
    if (op.type !== 'del') newNo++
    if (!keep[idx]) {
      if (!inGap && lines.length > 0) {
        lines.push({ kind: 'gap', no: null, html: '⋯' })
        inGap = true
      }
      return
    }
    inGap = false
    if (op.type === 'same') {
      lines.push({ kind: 'context', no: newNo, html: escapeHtml(op.text) || ' ' })
    } else if (op.type === 'add') {
      added++
      lines.push({ kind: 'add', no: newNo, html: escapeHtml(op.text) || ' ' })
    } else {
      removed++
      lines.push({ kind: 'del', no: null, html: escapeHtml(op.text) || ' ' })
    }
  })

  const parts = path.split('/')
  return {
    name: parts[parts.length - 1],
    path: parts.slice(0, -1).join('/'),
    added,
    removed,
    lines,
  }
}
