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
  const occupiedSpaceIdsForRange = useMemo(() => new Set(
    (overview?.reservations_detail ?? [])
      .filter((reservation) => reservation.space_id !== null)
      .filter((reservation) => reservation.status === 'confirmada' || reservation.status === 'activa')
      .filter((reservation) => overlapsRange(reservation.start_time, reservation.end_time, startTime, endTime))
      .map((reservation) => reservation.space_id as number)
  ), [endTime, overview?.reservations_detail, startTime])
  const selectedIsBlockedForRange = selectedSpace
    ? blockedSpaceIdsForRange.has(selectedSpace.id)
    : false
  const selectedIsOccupiedForRange = selectedSpace
    ? occupiedSpaceIdsForRange.has(selectedSpace.id)
    : false
  const isTimeRangeInvalid = endTime <= startTime
  const selectedCannotBeBlocked = selectedIsBlockedForRange || selectedIsOccupiedForRange || isTimeRangeInvalid

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
    setError(null)
    setMessage(null)
    if (isTimeRangeInvalid) {
      setSelectedSpace(null)
      setError('La hora de fin debe ser mayor a la hora de inicio.')
      return
    }

    setSelectedSpace(space)
  }

  function handleUnavailableManagementSpace(
    space: SpaceWithLayout,
    reason: 'occupied' | 'blocked' | 'unavailable'
  ) {
    setSelectedSpace(null)
    if (reason === 'occupied') {
      setError(`${space.space_number} ya tiene una reserva en ese horario. No se puede bloquear un espacio ocupado.`)
      return
    }
    if (reason === 'blocked') {
      setError(`${space.space_number} ya está bloqueado en ese horario.`)
      return
    }
    setError(`${space.space_number} no está disponible para bloqueo en ese horario.`)
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

    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError(blockErrorMessage(result.error))
      return
    }

    setMessage(`${result.data.space_number} bloqueado de ${result.data.start_time} a ${result.data.end_time}.`)
    setReason('')
    setSelectedSpace(null)
    await refresh()
  }

  function handleCancelSelection() {
    setSelectedSpace(null)
    setReason('')
    setError(null)
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
    <AppShell title="Gestión" subtitle="Bloqueo de espacios por fecha y horario">
      <div className={styles.page}>
        <section className={styles.controlPanel} data-tour="management-controls">
          <div className={styles.controlCopy}>
            <span>Bloqueo operativo</span>
            <strong>Selecciona una fecha y después el espacio en el mapa</strong>
          </div>

          <label className={styles.dateField}>
            <span>Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setSelectedSpace(null)
              }}
            />
          </label>
        </section>

        {error && <div className={styles.errorMsg}>{error}</div>}
        {message && <div className={styles.successMsg}>{message}</div>}

        <div className={styles.managementWorkspace}>
          <section className={styles.mapPanel} data-tour="management-map">
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
              onUnavailableLayoutSpace={handleUnavailableManagementSpace}
              managementUnavailableSpaceIds={blockedSpaceIdsForRange}
              managementStartTime={startTime}
              managementEndTime={endTime}
            />
          </section>

          <aside className={`${styles.selectionPanel} ${selectedSpace ? styles.selectionPanelOpen : ''}`}>
            {selectedSpace && (
              <div className={styles.selectionCard}>
                <div className={styles.cardHeader}>
                  <span>Selección actual</span>
                  <strong>{selectedCategory}</strong>
                </div>

                <div className={styles.selectionTitle}>
                  <h3>{selectedSpace.display_name || selectedSpace.space_number}</h3>
                  <p>{selectedSpace.space_number}</p>
                </div>

                <dl className={styles.selectionMeta}>
                  <div>
                    <dt>Piso</dt>
                    <dd>{selectedFloorName}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{date}</dd>
                  </div>
                </dl>

                <div className={styles.timeGrid}>
                  <label>
                    <span>Inicio</span>
                    <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
                  </label>
                  <label>
                    <span>Fin</span>
                    <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                  </label>
                </div>

                <label className={styles.reasonField}>
                  <span>Motivo</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Mantenimiento, evento, limpieza"
                    rows={4}
                  />
                </label>

                {(isTimeRangeInvalid || selectedIsBlockedForRange || selectedIsOccupiedForRange) && (
                  <div className={styles.confirmWarning}>
                    {isTimeRangeInvalid
                      ? 'La hora de fin debe ser mayor a la hora de inicio.'
                      : selectedIsOccupiedForRange
                        ? 'Este espacio ya tiene una reserva en ese horario.'
                        : 'Este espacio ya aparece bloqueado en ese horario.'}
                  </div>
                )}

                <div className={styles.confirmActions}>
                  <button type="button" onClick={handleCancelSelection} disabled={saving}>
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void handleConfirmBlock()} disabled={saving || selectedCannotBeBlocked}>
                    {saving ? 'Bloqueando...' : 'Confirmar bloqueo'}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>

        <section className={styles.blockPanel} data-tour="management-blocks">
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

      </div>
    </AppShell>
  )
}
