// Conversation mode: the "stay present" posture, next to task mode's
// "delegate and walk away". Threads live in the store; replies come from
// the same provider stack the agent uses (simulated / Anthropic / OpenAI-
// compatible), just as plain text instead of structured edits.
import { useEffect, useRef, useState } from 'react'
import type { ChatThread, ProviderSettings } from '../store'
import { MODEL_PRESETS } from '../agent/provider'
import { Avatar, BotAvatar } from './Avatar'
import { Dropdown } from './Dropdown'
import { ArrowUp, ChatBubble, ChevronDown, Compose, StopSquare } from './Icons'
import { useI18n, type MessageKey } from '../i18n'

const SUGGESTS: MessageKey[] = ['chat.suggest1', 'chat.suggest2', 'chat.suggest3']

export default function ChatView({
  chats,
  activeId,
  busy,
  stream,
  provider,
  onOpen,
  onNew,
  onSend,
  onStop,
  onDelete,
  onSetModel,
  onOpenSettings,
}: {
  chats: ChatThread[]
  activeId?: string
  busy: string[]
  stream: { threadId: string; text: string } | null
  provider: ProviderSettings
  onOpen: (id: string) => void
  onNew: () => void
  onSend: (threadId: string | null, text: string) => void
  onStop: (threadId: string) => void
  onDelete: (id: string) => void
  onSetModel: (threadId: string, model: string) => void
  onOpenSettings: () => void
}) {
  const { t, locale } = useI18n()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const msgsRef = useRef<HTMLDivElement>(null)

  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  const thread = activeId ? chats.find((c) => c.id === activeId) : undefined
  const isBusy = !!thread && busy.includes(thread.id)
  const liveText = isBusy && stream?.threadId === thread?.id ? stream!.text : ''
  const activeModel = thread?.model || provider.model

  useEffect(() => inputRef.current?.focus(), [activeId])

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight })
  }, [thread?.messages.length, isBusy, liveText.length])

  const submit = () => {
    const text = draft.trim()
    if (!text || isBusy) return
    onSend(thread?.id ?? null, text)
    setDraft('')
  }

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const modelOptions = () => {
    const names = [provider.model, ...MODEL_PRESETS[provider.kind]].filter(Boolean)
    if (activeModel && !names.includes(activeModel)) names.unshift(activeModel)
    return [...new Set(names)]
  }

  return (
    <>
      <header className="panel-header">
        <div className="panel-header-left">
          <span className="panel-title">{t('nav.chat')}</span>
        </div>
        <div className="panel-header-right">
          {thread && provider.kind === 'simulated' && (
            <button className="btn sm" onClick={onOpenSettings}>
              {t('provider.simulated')}
            </button>
          )}
          {thread && provider.kind !== 'simulated' && (
            <Dropdown
              trigger={() => (
                <button className="btn sm">
                  {activeModel || t('chat.model')}
                  <ChevronDown size={10} />
                </button>
              )}
              header={t('chat.model')}
              options={modelOptions().map((m) => ({
                key: m,
                label: m,
                checked: m === activeModel,
              }))}
              onSelect={(m) => onSetModel(thread.id, m)}
            />
          )}
          <button className="btn sm" onClick={onNew}>
            <Compose size={13} />
            {t('chat.new')}
          </button>
        </div>
      </header>

      <div className="chat-page">
        {sorted.length > 0 && (
          <div className="chat-list">
            <div className="chat-threads">
              {sorted.map((c) => (
                <div
                  key={c.id}
                  className={`chat-thread${c.id === activeId ? ' active' : ''}`}
                  onClick={() => onOpen(c.id)}
                >
                  <span className="chat-thread-title">{c.title || t('chat.new')}</span>
                  <button
                    className="chat-thread-x"
                    title={t('chat.delete')}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(c.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="chat-main">
          {!thread && (
            <div className="chat-empty">
              <span className="chat-empty-icon">
                <ChatBubble size={20} />
              </span>
              <div className="chat-empty-title">{t('chat.empty.title')}</div>
              <div className="chat-empty-desc">{t('chat.empty.desc')}</div>
              <div className="chat-suggests">
                {SUGGESTS.map((k) => (
                  <button key={k} className="chat-suggest" onClick={() => onSend(null, t(k))}>
                    {t(k)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thread && (
            <div className="chat-msgs" ref={msgsRef}>
              {thread.messages.map((m) => (
                <div key={m.id} className={`chat-msg${m.error ? ' error' : ''}`}>
                  <span className="chat-msg-avatar">
                    {m.role === 'user' ? <Avatar user="me" size="sm" /> : <BotAvatar size="sm" />}
                  </span>
                  <div className="chat-msg-content">
                    <div className="chat-msg-meta">
                      <span className="chat-msg-name">
                        {m.role === 'user' ? t('executor.me') : 'Linage'}
                      </span>
                      {m.model && <span className="model-badge">{m.model}</span>}
                      <span className="chat-msg-time">{fmtTime(m.time)}</span>
                    </div>
                    <div className="chat-msg-body">{m.text}</div>
                  </div>
                </div>
              ))}
              {isBusy && (
                <div className="chat-msg">
                  <span className="chat-msg-avatar">
                    <BotAvatar size="sm" />
                  </span>
                  <div className="chat-msg-content">
                    {liveText ? (
                      <>
                        <div className="chat-msg-meta">
                          <span className="chat-msg-name">Linage</span>
                        </div>
                        <div className="chat-msg-body streaming">
                          {liveText}
                          <span className="stream-cursor" />
                        </div>
                      </>
                    ) : (
                      <div className="chat-msg-body thinking">
                        <span className="spinner" /> {t('chat.thinking')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="chat-composer-wrap">
            {provider.kind === 'simulated' && (
              <button className="chat-sim-hint" onClick={onOpenSettings}>
                {t('chat.simulatedHint')}
              </button>
            )}
            <div className="composer slim chat-composer">
              <input
                ref={inputRef}
                className="composer-input"
                placeholder={t('chat.placeholder')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                disabled={isBusy}
              />
              <span className="composer-actions">
                {isBusy ? (
                  <button
                    className="send-btn stop"
                    title={t('chat.stop')}
                    onClick={() => onStop(thread!.id)}
                  >
                    <StopSquare size={10} />
                  </button>
                ) : (
                  <button
                    className="send-btn"
                    onClick={submit}
                    disabled={!draft.trim()}
                    style={{ opacity: draft.trim() ? 1 : 0.5 }}
                  >
                    <ArrowUp size={12} />
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
