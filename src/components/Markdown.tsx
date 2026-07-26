// Zero-dependency Markdown renderer for chat replies.
// Everything is built as React elements (auto-escaped) — no
// dangerouslySetInnerHTML anywhere. Tolerant of streaming input: an
// unterminated code fence renders as a code block up to the current end.
import { useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'

// ─── Code highlighting (reuses the existing tok-* palette) ──────

const TOKEN_RX =
  /(\/\/[^\n]*|#(?![0-9a-fA-F]{3,8}\b)[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|\b(const|let|var|function|return|if|else|elif|for|while|import|from|export|default|class|def|async|await|try|catch|except|finally|throw|raise|new|type|interface|enum|func|guard|struct|extension|public|private|protected|static|void|self|this|super|in|of|not|and|or|is|None|True|False|null|undefined|true|false|nil)\b/g

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of code.matchAll(TOKEN_RX)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(code.slice(last, idx))
    const cls = m[1] ? 'tok-comment' : m[2] ? 'tok-str' : m[3] ? 'tok-num' : 'tok-kw'
    out.push(
      <span key={k++} className={cls}>
        {m[0]}
      </span>,
    )
    last = idx + m[0].length
  }
  if (last < code.length) out.push(code.slice(last))
  return out
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(done, done)
    } else {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      done()
    }
  }
  return (
    <div className="md-codeblock">
      <div className="md-codeblock-header">
        <span>{lang || 'text'}</span>
        <button className="md-copy-btn" onClick={copy}>
          {copied ? t('chat.copied') : t('chat.copy')}
        </button>
      </div>
      <pre>
        <code>{highlight(code)}</code>
      </pre>
    </div>
  )
}

// ─── Inline: `code`, **bold**, *italic*, [label](https://…) ─────

const INLINE_RX =
  /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*\s][^*]*)\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let k = 0
  while (rest) {
    const m = INLINE_RX.exec(rest)
    if (!m) {
      out.push(rest)
      break
    }
    if (m.index > 0) out.push(rest.slice(0, m.index))
    const key = `${keyPrefix}-${k++}`
    if (m[1]) {
      out.push(
        <code key={key} className="inline">
          {m[2]}
        </code>,
      )
    } else if (m[3]) {
      out.push(<strong key={key}>{inline(m[4], key)}</strong>)
    } else if (m[5]) {
      out.push(<em key={key}>{inline(m[6], key)}</em>)
    } else {
      out.push(
        <a key={key} href={m[9]} target="_blank" rel="noreferrer">
          {m[8]}
        </a>,
      )
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

/** Paragraph content: soft line breaks become <br />. */
function withBreaks(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split('\n')
  const out: ReactNode[] = []
  parts.forEach((p, i) => {
    if (i > 0) out.push(<br key={`${keyPrefix}-br${i}`} />)
    out.push(...inline(p, `${keyPrefix}-l${i}`))
  })
  return out
}

// ─── Block-level ────────────────────────────────────────────────

const BLOCK_START = /^(```|#{1,4}\s|>\s?|[-*+]\s+|\d+[.)]\s+)/

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(/^```(\S*)/)
    if (fence) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // closing fence (or past the end while streaming)
      out.push(<CodeBlock key={k++} lang={fence[1]} code={buf.join('\n')} />)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)/)
    if (h) {
      const level = h[1].length
      const content = inline(h[2], `h${k}`)
      out.push(
        level === 1 ? <h1 key={k++}>{content}</h1>
        : level === 2 ? <h2 key={k++}>{content}</h2>
        : level === 3 ? <h3 key={k++}>{content}</h3>
        : <h4 key={k++}>{content}</h4>,
      )
      i++
      continue
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={k++} />)
      i++
      continue
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(
        <blockquote key={k++}>
          <Markdown text={buf.join('\n')} />
        </blockquote>,
      )
      continue
    }
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''))
        i++
      }
      out.push(
        <ul key={k++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `u${k}-${j}`)}</li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s+/, ''))
        i++
      }
      out.push(
        <ol key={k++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `o${k}-${j}`)}</li>
          ))}
        </ol>,
      )
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    // Paragraph: consecutive plain lines.
    const buf: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
      buf.push(lines[i])
      i++
    }
    out.push(<p key={k++}>{withBreaks(buf.join('\n'), `p${k}`)}</p>)
  }
  return <div className="chat-md">{out}</div>
}
