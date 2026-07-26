import { useEffect, useRef, useState } from 'react'
import { Avatar, BotAvatar } from './Avatar'
import {
  ArrowUp,
  ChevronDown,
  Dots,
  GitBranch,
  Paperclip,
  Screenful,
  Sparkle,
} from './Icons'
import { useI18n } from '../i18n'

function WorkedFor({ label, steps }: { label: string; steps: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="agent-worked">
      <button className="agent-worked-toggle" onClick={() => setOpen((o) => !o)}>
        {label}
        <span className={`agent-chevron${open ? ' open' : ''}`}>
          <ChevronDown size={10} />
        </span>
      </button>
      {open && (
        <div className="agent-worked-steps">
          {steps.map((s, i) => (
            <div key={i} className="agent-worked-step">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <span className="typing-dots">
      <span />
      <span />
      <span />
    </span>
  )
}

interface ChatMsg {
  from: 'user' | 'agent'
  text: string
}

function AgentInput({ onSend }: { onSend?: (text: string) => void }) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const submit = () => {
    if (!value.trim() || !onSend) return
    onSend(value.trim())
    setValue('')
  }
  return (
    <div className="agent-input">
      <input
        placeholder={t('agent.inputPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="agent-input-actions">
        <button className="icon-btn">
          <Screenful size={13} />
        </button>
        <button className="icon-btn">
          <Paperclip size={13} />
        </button>
        <button className="send-btn" onClick={submit}>
          <ArrowUp size={12} />
        </button>
      </div>
    </div>
  )
}

function PanelHeader({
  onMinimize,
  onExpand,
  onClose,
  minimal,
}: {
  onMinimize?: () => void
  onExpand?: () => void
  onClose?: () => void
  minimal?: boolean
}) {
  return (
    <div className="agent-header">
      <div className="agent-header-left">
        <BotAvatar size="sm" />
        <span className="agent-name">Linear</span>
        <span className="model-badge">Opus 4.8</span>
      </div>
      <div className="agent-header-actions">
        {minimal ? (
          <button className="icon-btn">
            <Dots size={13} />
          </button>
        ) : (
          <>
            <button className="icon-btn" onClick={onMinimize} title="Minimize">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 8.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button className="icon-btn" onClick={onExpand} title="Expand">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M7 1.5h3.5V5M5 10.5H1.5V7M10.5 1.5 7 5M1.5 10.5 5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="icon-btn" onClick={onClose} title="Close">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ChangesSummary() {
  return (
    <>
      <div className="agent-strong">Pushed and opened a draft PR. Changes:</div>
      <ul className="agent-bullets">
        <li>
          <span className="code-chip">useRideHistory.ts</span> : build a{' '}
          <span className="code-chip">waitingStatusById</span> map and use it as the{' '}
          <span className="code-chip">getLastAction</span> byline
        </li>
        <li>
          <span className="code-chip">RideHistoryPage.tsx</span> : dimmed rows reset to full
          opacity
        </li>
      </ul>
    </>
  )
}

/** Floating panel shown over the issue detail view (screenshot 1). */
export function FloatingAgentPanel({ onOpenDiff }: { onOpenDiff: () => void }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(true)
  const [minimized, setMinimized] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [thinking, setThinking] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const send = (text: string) => {
    setChat((c) => [...c, { from: 'user', text }])
    setThinking(true)
    setTimeout(() => {
      setThinking(false)
      setChat((c) => [
        ...c,
        {
          from: 'agent',
          text: 'On it — I’ll update the draft PR and report back here.',
        },
      ])
    }, 1400)
  }

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat, thinking])

  if (!visible)
    return (
      <button className="agent-fab" onClick={() => setVisible(true)} title={t('agent.open')}>
        <Sparkle size={16} />
      </button>
    )

  return (
    <div className={`agent-panel floating${minimized ? ' minimized' : ''}${expanded ? ' expanded' : ''}`}>
      <PanelHeader
        onMinimize={() => setMinimized((m) => !m)}
        onExpand={() => setExpanded((x) => !x)}
        onClose={() => setVisible(false)}
      />
      {!minimized && (
        <>
          <div className="agent-body" ref={bodyRef}>
            <div className="agent-line">
              <Avatar user="jori" size="sm" />
              <span>
                <b>jori</b> connected Linear to ENG-2703
              </span>
            </div>
            <div className="agent-text">Examining the startup path…</div>
            <WorkedFor
              label={`${t('agent.workedFor')} 7s`}
              steps={[
                'Read client/src/startup/AppBoot.swift',
                'Traced vehicle_state sync in RideStore',
                'Identified blocking full-refresh call',
              ]}
            />
            <ChangesSummary />
            <div className="pr-card compact" onClick={onOpenDiff}>
              <div className="pr-card-info">
                <div className="pr-card-line1">
                  Changed 2 files <span className="added">+4</span> <span className="removed">-4</span>
                </div>
                <div className="pr-card-line2">
                  <GitBranch size={13} />
                  Draft Update homepage H1
                </div>
                <div className="pr-card-branch">master ← ride/drv-899-update-homepage-h1-65a6</div>
              </div>
              <button className="btn">
                <Screenful size={13} />
                Preview
              </button>
            </div>
            {chat.map((m, i) => (
              <div key={i} className={`chat-msg ${m.from}`}>
                {m.from === 'agent' && <BotAvatar size="sm" />}
                <span className="chat-bubble">{m.text}</span>
              </div>
            ))}
            {thinking && (
              <div className="chat-msg agent">
                <BotAvatar size="sm" />
                <span className="chat-bubble">
                  <TypingDots />
                </span>
              </div>
            )}
          </div>
          <AgentInput onSend={send} />
        </>
      )}
    </div>
  )
}

/** Embedded side panel used in the diff view (screenshot 2). */
export function EmbeddedAgentPanel() {
  const { t } = useI18n()
  return (
    <aside className="agent-panel embedded">
      <PanelHeader minimal />
      <div className="agent-body">
        <div className="agent-line">
          <span className="avatar sm" style={{ background: '#d16ba5' }}>
            C
          </span>
        <span>
            <b>Conor</b> started this session
          </span>
        </div>
        <WorkedFor
          label={`${t('agent.workedFor')} 32s`}
          steps={[
            'Read client/src/views/RideHistory',
            'Removed dimmedIds computed set',
            'Pushed branch and opened draft PR',
          ]}
        />
        <ChangesSummary />
        <div className="agent-quote">
          <div className="agent-line" style={{ marginBottom: 4 }}>
            <Avatar user="nan" size="sm" />
            <b>Nan</b>
          </div>
          <div className="agent-text">Do we need both waitingStatusById and dimmedIds here?</div>
        </div>
        <div className="agent-working">
          Working 00:03
          <span className="agent-chevron open" style={{ marginLeft: 4 }}>
            <ChevronDown size={10} />
          </span>
        </div>
        <div className="agent-dim-line">Preparing session…</div>
        <div className="agent-dim-line">Loading MCP tools…</div>
      </div>
      <AgentInput />
    </aside>
  )
}
