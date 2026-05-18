import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { FloorMap } from '../NewReservationPage/FloorMap/FloorMap'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { blockSpace, fetchAdminOverview, unblockSpace } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import { PRIORITY_CATEGORY_LABELS } from '../../data/floorLayouts'
import type { AdminKpiOverview } from '../../types/reservation'
import type { SpaceWithLayout } from '../../types/floor'
import styles from './AdminManagementPage.module.css'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function blockErrorMessage(error: string): string {
  if (error === 'SPACE_UNAVAILABLE') return 'Ese espacio ya tiene una reserva o bloqueo en ese horario.'
  if (error === 'INVALID_TIME_RANGE') return 'Revisa la fecha y el horario del bloqueo.'
  return 'No se pudo bloquear el espacio.'
}

function overlapsRange(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB
}

export function AdminManagementPage(): JSX.Element {
  const navigate = useNavigate()
  const token = getSession()?.access_token
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [reason, setReason] = useState('')
  const [selectedSpace, setSelectedSpace] = useState<SpaceWithLayout | null>(null)
  const [overview, setOverview] = useState<AdminKpiOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const selectedCategory = selectedSpace?.priority_category
    ? PRIORITY_CATEGORY_LABELS[selectedSpace.priority_category as keyof typeof PRIORITY_CATEGORY_LABELS] ?? selectedSpace.priority_category
    : 'Sin categoría'

  const dateBlocks = useMemo(() => overview?.blocked_spaces ?? [], [overview])
  const floorNameById = useMemo(() => new Map(
    (overview?.by_floor ?? []).map((floor) => [floor.floor_id, floor.floor_name])
  ), [overview])
  const selectedFloorName = selectedSpace
    ? floorNameById.get(selectedSpace.floor_id) ?? `Piso ${selectedSpace.floor_id}`
    : null
  const blockedSpaceIdsForRange = useMemo(() => new Set(
    dateBlocks
      .filter((block) => overlapsRange(block.start_time, block.end_time, startTime, endTime))
      .map((block) => block.space_id)
  ), [dateBlocks, endTime, startTime])
  const selectedIsBlockedForRange = selectedSpace
    ? blockedSpaceIdsForRange.has(selectedSpace.id)
    : false

  async function refresh() {
    if (!token) return
    const result = await fetchAdminOverview(token, date)
    if (result.success) {
      setOverview(result.data)
      setRefreshKey((value) => value + 1)
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

  function handleSelectManagementSpace(space: SpaceWithLayout) {
    setSelectedSpace(space)
    if (endTime <= startTime) {
      setError('La hora de fin debe ser mayor a la hora de inicio.')
      return
    }

    setConfirming(true)
  }

  async function handleConfirmBlock() {
    if (!token || !selectedSpace) return

    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await blockSpace(token, {
      space_id: selectedSpace.id,
      block_date: date,
      start_time: startTime,
      end_time: endTime,
      reason: reason.trim(),
    })
    setSaving(false)
    setConfirming(false)

    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError(blockErrorMessage(result.error))
      return
    }

    setMessage(`${result.data.space_number} bloqueado de ${result.data.start_time} a ${result.data.end_time}.`)
    setReason('')
    await refresh()
  }

  async function handleUnblock(blockId: number) {
    if (!token) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await unblockSpace(token, blockId)
    setSaving(false)

    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError('No se pudo liberar el bloqueo.')
      return
    }

    setMessage('Espacio liberado para nuevas reservas.')
    await refresh()
  }

  return (
    <AppShell title="Gestión" subtitle="Bloqueo de espacios por fecha y horario" noscroll>
      <div className={styles.page}>
        <section className={styles.controlPanel}>
          <div className={styles.controlCopy}>
            <span>Bloqueo operativo</span>
            <strong>Selecciona un espacio directamente en el mapa</strong>
          </div>

          <div className={styles.controlGrid}>
            <label>
              <span>Fecha</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>

            <label>
              <span>Inicio</span>
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>

            <label>
              <span>Fin</span>
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>

            <label className={styles.reasonField}>
              <span>Motivo</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Mantenimiento, evento, limpieza"
              />
            </label>
          </div>
        </section>

        {error && <div className={styles.errorMsg}>{error}</div>}
        {message && <div className={styles.successMsg}>{message}</div>}

        <section className={styles.mapPanel}>
          <FloorMap
            floorId={null}
            availableSpaces={[]}
            selectedSpaceId={selectedSpace?.id ?? null}
            onSelectSpace={() => undefined}
            isLoading={loading}
            hasSearched
            reservationDate={date}
            aiRecommendedSpaces={new Map()}
            refreshKey={refreshKey}
            mode="management"
            onSelectLayoutSpace={handleSelectManagementSpace}
            managementUnavailableSpaceIds={blockedSpaceIdsForRange}
          />
        </section>

        <section className={styles.blockPanel}>
          <div className={styles.cardHeader}>
            <span>Bloqueos del día</span>
            <strong>{dateBlocks.length}</strong>
          </div>

          {loading ? (
            <div className={styles.loadingWrap}><LoadingSpinner /></div>
          ) : dateBlocks.length === 0 ? (
            <p className={styles.hint}>No hay espacios bloqueados para esta fecha.</p>
          ) : (
            <div className={styles.blockList}>
              {dateBlocks.map((block) => (
                <div key={block.id} className={styles.blockItem}>
                  <div>
                    <strong>{block.space_number}</strong>
                    <span>{block.floor_name} · {block.start_time} - {block.end_time}</span>
                    <small>{block.reason || 'Sin motivo registrado'}</small>
                  </div>
                  <button type="button" onClick={() => void handleUnblock(block.id)} disabled={saving}>
                    Liberar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {confirming && selectedSpace && (
          <div
            className={styles.confirmBackdrop}
            onClick={(event) => {
              if (event.target === event.currentTarget) setConfirming(false)
            }}
          >
            <div className={styles.confirmDialog} role="dialog" aria-modal="true">
              <span>Confirmar bloqueo</span>
              <h3>{selectedSpace.space_number}</h3>
              <div className={styles.confirmMeta}>
                <span>{selectedCategory}</span>
                <span>{selectedFloorName}</span>
              </div>
              <p>{date} · {startTime} - {endTime}</p>
              <small>{reason.trim() || 'Sin motivo registrado'}</small>
              {selectedIsBlockedForRange && (
                <div className={styles.confirmWarning}>
                  Este espacio ya aparece bloqueado en ese horario. Puedes revisar el horario o liberar el bloqueo existente.
                </div>
              )}
              <div className={styles.confirmActions}>
                <button type="button" onClick={() => setConfirming(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="button" onClick={() => void handleConfirmBlock()} disabled={saving || selectedIsBlockedForRange}>
                  {saving ? 'Bloqueando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
