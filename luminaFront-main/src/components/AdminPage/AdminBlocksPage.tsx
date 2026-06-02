import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { fetchAdminOverview, unblockSpace } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import type { AdminKpiOverview } from '../../types/reservation'
import styles from './AdminBlocksPage.module.css'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function blockTimeRange(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`
}

export function AdminBlocksPage(): JSX.Element {
  const navigate = useNavigate()
  const token = getSession()?.access_token
  const [date, setDate] = useState(today)
  const [query, setQuery] = useState('')
  const [overview, setOverview] = useState<AdminKpiOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const blocks = useMemo(() => overview?.blocked_spaces ?? [], [overview])
  const filteredBlocks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return blocks

    return blocks.filter((block) => [
      block.space_number,
      block.floor_name,
      block.reason,
      blockTimeRange(block.start_time, block.end_time),
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
  }, [blocks, query])

  async function refresh() {
    if (!token) return
    const result = await fetchAdminOverview(token, date)
    if (result.success) {
      setOverview(result.data)
      setError(null)
    } else if (result.unauthorized) {
      navigate('/login', { replace: true })
    } else {
      setError('No se pudieron cargar los bloqueos.')
    }
  }

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setLoading(true)
    setError(null)
    fetchAdminOverview(token, date).then((result) => {
      setLoading(false)
      if (!result.success) {
        if (result.unauthorized) navigate('/login', { replace: true })
        else setError(result.error === 'FORBIDDEN' ? 'No tienes permisos de administrador.' : 'No se pudieron cargar los bloqueos.')
        return
      }
      setOverview(result.data)
    })
  }, [date, navigate, token])

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(id)
  }, [error])

  useEffect(() => {
    if (!message) return
    const id = window.setTimeout(() => setMessage(null), 5000)
    return () => window.clearTimeout(id)
  }, [message])

  useReservationRealtime((event) => {
    const isBlockEvent = event.type.endsWith('_block.created') || event.type.endsWith('_block.deleted')
    if (isBlockEvent || !event.reservation_date || event.reservation_date === date) {
      void refresh()
    }
  }, Boolean(token))

  async function handleUnblock(blockId: number) {
    if (!token) return

    setSavingId(blockId)
    setError(null)
    setMessage(null)

    const result = await unblockSpace(token, blockId)
    setSavingId(null)

    if (!result.success) {
      if (result.unauthorized) {
        navigate('/login', { replace: true })
        return
      }
      setError('No se pudo liberar el bloqueo.')
      return
    }

    setMessage('Espacio liberado para nuevas reservas.')
    await refresh()
  }

  return (
    <AppShell title="Bloqueos" subtitle="Consulta y libera bloqueos activos por fecha">
      <div className={styles.page}>
        <section className={styles.toolbar}>
          <div className={styles.toolbarCopy}>
            <span>Bloqueos operativos</span>
            <strong>{filteredBlocks.length} de {blocks.length} bloqueos visibles</strong>
          </div>

          <label className={styles.field}>
            <span>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          <label className={styles.searchField}>
            <span>Buscar</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Espacio, piso, motivo u horario"
            />
          </label>
        </section>

        {error && <div className={styles.errorMsg}>{error}</div>}
        {message && <div className={styles.successMsg}>{message}</div>}

        <section className={styles.blocksPanel}>
          {loading ? (
            <div className={styles.loadingWrap}><LoadingSpinner /></div>
          ) : filteredBlocks.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>Sin bloqueos para mostrar</strong>
              <span>Revisa otra fecha o ajusta la búsqueda.</span>
            </div>
          ) : (
            <div className={styles.blockList}>
              {filteredBlocks.map((block) => (
                <article key={block.id} className={styles.blockCard}>
                  <div className={styles.blockMain}>
                    <span className={styles.blockStatus}>{block.is_active ? 'Activo' : 'Inactivo'}</span>
                    <strong>{block.space_number}</strong>
                    <p>{block.floor_name} · {blockTimeRange(block.start_time, block.end_time)}</p>
                    <small>{block.reason || 'Sin motivo registrado'}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleUnblock(block.id)}
                    disabled={savingId === block.id || !block.is_active}
                  >
                    {savingId === block.id ? 'Liberando...' : 'Liberar'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
