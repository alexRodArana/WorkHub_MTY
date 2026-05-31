import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { askReservationAssistant } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import type { AssistantResponse } from '../../types/reservation'
import styles from './AiAssistantWidget.module.css'

type ChatMessage =
  | { id: string; role: 'assistant'; text: string; data?: AssistantResponse }
  | { id: string; role: 'user'; text: string }

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const ASSISTANT_PLACEHOLDERS = [
  'Hazme una pregunta...',
  '¿Cuál es tu duda?',
  '¿En qué te puedo ayudar?',
  'Cuéntame qué necesitas...',
]

export function AiAssistantWidget(): JSX.Element {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: 'Soy el asistente IA de WorkHub. Puedo recomendar espacios, revisar tus reservas y explicar ocupación.',
    },
  ])
  const inputRef = useRef<HTMLInputElement>(null)
  const currentPlaceholder = ASSISTANT_PLACEHOLDERS[placeholderIndex]

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % ASSISTANT_PLACEHOLDERS.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const message = input.trim()
    const token = getSession()?.access_token
    if (!message || loading || !token) return

    setInput('')
    setLoading(true)
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: message }])

    const result = await askReservationAssistant(token, message)
    setLoading(false)

    if (!result.success) {
      const text = result.error === 'AI_NOT_CONFIGURED'
        ? 'Falta configurar la API key del proveedor de IA en el backend.'
        : result.error === 'AI_PROVIDER_ERROR'
          ? 'La IA no respondió correctamente. Revisa la API key, modelo o saldo del proveedor.'
          : 'No pude consultar la IA en este momento. Intenta otra vez.'
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text },
      ])
      return
    }

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'assistant', text: result.data.answer, data: result.data },
    ])
  }

  function toggleOpen(): void {
    setOpen((value) => {
      const next = !value
      if (!value) window.setTimeout(() => inputRef.current?.focus(), 120)
      return next
    })
  }

  return (
    <div className={styles.assistant}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label="Abrir asistente IA"
      >
        <span className={styles.triggerIcon} aria-hidden="true" />
        <span className={styles.triggerText}>IA</span>
      </button>

      {open && (
        <section className={styles.panel} aria-label="Asistente IA">
          <header className={styles.header}>
            <div>
              <span>Asistente IA</span>
              <strong>WorkHub</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente">×</button>
          </header>

          <div className={styles.messages}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
              >
                <p>{message.text}</p>
                {message.role === 'assistant' && message.data?.recommendations.length ? (
                  <div className={styles.recommendations}>
                    {message.data.recommendations.map((item) => (
                      <span key={item.space_id}>
                        {item.space_number}
                        <small>{item.score}%</small>
                      </span>
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' && message.data?.actions.length ? (
                  <div className={styles.actions}>
                    {message.data.actions.map((action) => (
                      <Link key={action.to} to={action.to} onClick={() => setOpen(false)}>
                        {action.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {loading && (
              <article className={`${styles.message} ${styles.assistantMessage}`}>
                <p className={styles.typing}>Analizando disponibilidad</p>
              </article>
            )}
          </div>

          <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
            <div className={styles.inputWrap}>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder=""
                aria-label={currentPlaceholder}
                maxLength={700}
              />
              {!input && (
                <span key={currentPlaceholder} className={styles.dynamicPlaceholder}>
                  {currentPlaceholder}
                </span>
              )}
            </div>
            <button type="submit" disabled={!input.trim() || loading} aria-label="Enviar mensaje">
              →
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
