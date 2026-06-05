'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type Message = {
  id: number
  user_id: string
  content: string
  created_at: string
  profiles: { username: string; avatar_url: string | null } | null
}

type Member = {
  user_id: string
  username: string
}

type Props = {
  gameId: number
  currentUserId: string
  hostId: string
  /** Medlemmer der kan @mentions. Sendes fra page.tsx så ShoutBox ikke selv skal fetche. */
  members: Member[]
}

const MAX_LENGTH = 500
const POLL_INTERVAL_MS = 10_000

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'lige nu'
  if (diffMin < 60) return `${diffMin} min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} t`
  if (diffHr < 24 * 7) return d.toLocaleDateString('da-DK', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

/**
 * Render besked-indhold med @username markeret som fed. Simple linear scan
 * gennem teksten; ingen markdown eller HTML, så ingen XSS-risiko.
 */
function MessageContent({ content, memberUsernames }: { content: string; memberUsernames: Set<string> }) {
  const parts: { text: string; isMention: boolean }[] = []
  const regex = /@(\w+)/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(content)) !== null) {
    if (m.index > lastIdx) parts.push({ text: content.slice(lastIdx, m.index), isMention: false })
    const isReal = memberUsernames.has(m[1].toLowerCase())
    parts.push({ text: `@${m[1]}`, isMention: isReal })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < content.length) parts.push({ text: content.slice(lastIdx), isMention: false })
  return (
    <>
      {parts.map((p, i) =>
        p.isMention
          ? <span key={i} style={{ color: '#1a3329', fontWeight: 600 }}>{p.text}</span>
          : <span key={i}>{p.text}</span>
      )}
    </>
  )
}

export default function ShoutBox({ gameId, currentUserId, hostId, members }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentionQuery, setMentionQuery] = useState<{ at: number; prefix: string } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const memberUsernames = new Set(members.map((m) => m.username.toLowerCase()))
  const isHost = currentUserId === hostId

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}/messages`)
      if (!res.ok) return
      const data = await res.json() as { messages: Message[] }
      setMessages(data.messages ?? [])
    } catch { /* ignore — vil prøve igen ved næste poll */ }
  }, [gameId])

  // Initial load + polling
  useEffect(() => {
    fetchMessages().finally(() => setLoading(false))
    const t = setInterval(fetchMessages, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [fetchMessages])

  // Auto-scroll til bunden når nye beskeder kommer
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  // Detect @ for mention-autocomplete
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setInput(v)
    setError(null)
    const cursor = e.target.selectionStart ?? v.length
    const upToCursor = v.slice(0, cursor)
    const m = upToCursor.match(/@(\w*)$/)
    if (m) {
      setMentionQuery({ at: m.index ?? cursor - m[0].length, prefix: m[1].toLowerCase() })
    } else {
      setMentionQuery(null)
    }
  }

  function applyMention(username: string) {
    if (!mentionQuery) return
    const before = input.slice(0, mentionQuery.at)
    const cursor = inputRef.current?.selectionStart ?? input.length
    const after = input.slice(cursor)
    const next = `${before}@${username} ${after}`
    setInput(next)
    setMentionQuery(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const mentionMatches = mentionQuery
    ? members.filter((m) => m.user_id !== currentUserId && m.username.toLowerCase().startsWith(mentionQuery.prefix)).slice(0, 5)
    : []

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/games/${gameId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Kunne ikke sende')
        return
      }
      setInput('')
      setMentionQuery(null)
      // Optimistisk append + næste poll bringer i synk
      if (data.message) setMessages((prev) => [...prev, data.message as Message])
    } catch {
      setError('Netværksfejl')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(messageId: number) {
    if (!confirm('Slet beskeden?')) return
    try {
      const res = await fetch(`/api/games/${gameId}/messages/${messageId}`, { method: 'DELETE' })
      if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch { /* ignore */ }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape') {
      setMentionQuery(null)
    }
  }

  return (
    <div className="bg-cream-dark border border-warm-border rounded-sm p-4 sm:p-5 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="label-caps text-warm-taupe">Shoutbox</p>
        {messages.length > 0 && (
          <p className="font-condensed text-[10px] text-warm-gray uppercase tracking-[0.08em]">
            {messages.length} {messages.length === 1 ? 'besked' : 'beskeder'}
          </p>
        )}
      </div>

      {/* Besked-liste */}
      <div
        ref={listRef}
        className="bg-cream border border-warm-border rounded-sm overflow-y-auto"
        style={{ maxHeight: 280, minHeight: 120, padding: '8px 12px' }}
      >
        {loading && (
          <p className="font-body text-[12px] text-warm-gray text-center py-4">Henter…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="font-body text-[12px] text-warm-gray text-center py-4">
            Vær den første der siger noget.
          </p>
        )}
        {messages.map((msg) => {
          const username = msg.profiles?.username ?? 'Anonym'
          const isMine = msg.user_id === currentUserId
          const canDelete = isMine || isHost
          return (
            <div key={msg.id} className="py-1.5 group flex gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-condensed text-[12px] font-bold text-ink">{username}</span>
                  <span className="font-body text-[10px] text-warm-gray">{formatTime(msg.created_at)}</span>
                </div>
                <p className="font-body text-[13px] text-ink leading-relaxed break-words whitespace-pre-wrap">
                  <MessageContent content={msg.content} memberUsernames={memberUsernames} />
                </p>
              </div>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(msg.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity self-start font-body text-[10px] text-warm-gray hover:text-vintage-red"
                  title="Slet"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="mt-3 relative">
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-warm-border rounded-sm shadow-sm overflow-hidden z-10">
            {mentionMatches.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => applyMention(m.username)}
                className="block w-full text-left px-3 py-2 font-condensed text-[12px] text-ink hover:bg-cream-dark"
              >
                @{m.username}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en besked… (@navn for mention)"
            maxLength={MAX_LENGTH}
            rows={1}
            className="flex-1 bg-white border border-warm-border rounded-sm px-3 py-2 font-body text-[13px] text-ink outline-none focus:border-forest resize-none"
            style={{ minHeight: 38, maxHeight: 120 }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-forest text-cream font-condensed font-bold text-[12px] uppercase tracking-[0.06em] rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
        {error && (
          <p className="font-body text-[11px] text-vintage-red mt-1">{error}</p>
        )}
        {input.length > MAX_LENGTH * 0.9 && (
          <p className="font-condensed text-[10px] text-warm-gray text-right mt-1">
            {input.length}/{MAX_LENGTH}
          </p>
        )}
      </div>
    </div>
  )
}
