import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { fetchGuardParking } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import type { ParkingReservationForGuard, PublicUserProfile } from '../../types/reservation'
import styles from './GuardPage.module.css'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function initials(user: PublicUserProfile): string {
  return `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
}

export function GuardPage(): JSX.Element {
  const navigate = useNavigate()
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<ParkingReservationForGuard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const token = getSession()?.access_token

  const loadParking = useCallback(async (showLoading = true) => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (showLoading) setLoading(true)
    setError(null)
    const result = await fetchGuardParking(token, date)
    if (showLoading) setLoading(false)
    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      else setError(result.error === 'FORBIDDEN' ? 'No tienes permisos para la vista de guardia.' : 'No se pudo cargar el estacionamiento.')
      return
    }
    setItems(result.data)
  }, [date, navigate, token])

  useEffect(() => {
    void loadParking()
  }, [loadParking])

  useReservationRealtime((event) => {
    if (event.type === 'sync.requested') {
      void loadParking(false)
      return
    }
    if (event.type.startsWith('area_block.')) return
    if (event.parking && (!event.reservation_date || event.reservation_date === date)) {
      void loadParking(false)
    }
  }, Boolean(token))

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(id)
  }, [error])

  const grouped = useMemo(() => {
    return items.reduce<Record<string, ParkingReservationForGuard[]>>((acc, item) => {
      const key = item.parking_zone_name
      acc[key] = acc[key] ?? []
      acc[key].push(item)
      return acc
    }, {})
  }, [items])

  const activeCount = items.filter((item) => item.status === 'activa').length
  const zoneCount = Object.keys(grouped).length
  const nextReservation = items[0] ?? null

  return (
    <AppShell title="Guardia" subtitle="Reservas de estacionamiento del día">
      <div className={styles.page}>
        <div className={styles.guardHero} data-tour="guard-hero">
          <div className={styles.heroCopy}>
            <span>Control de acceso</span>
            <h3>Estacionamiento reservado</h3>
            <p>Consulta placas operativas por zona, horario y persona antes de permitir el acceso.</p>
          </div>
          <label className={styles.dateControl}>
            <span>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>

        <div className={styles.summaryGrid} data-tour="guard-summary">
          <div className={styles.summaryCard}>
            <span>Total</span>
            <strong>{items.length}</strong>
            <small>reservas con cajón</small>
          </div>
          <div className={styles.summaryCard}>
            <span>Activas</span>
            <strong>{activeCount}</strong>
            <small>check-in realizado</small>
          </div>
          <div className={styles.summaryCard}>
            <span>Zonas</span>
            <strong>{zoneCount}</strong>
            <small>con ocupación</small>
          </div>
          <div className={styles.summaryCard}>
            <span>Siguiente</span>
            <strong>{nextReservation ? nextReservation.start_time : '--:--'}</strong>
            <small>{nextReservation ? nextReservation.parking_spot_number : 'sin reservas'}</small>
          </div>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        {loading ? (
          <div className={styles.loadingWrap}><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState} data-tour="guard-list">No hay estacionamientos reservados para esta fecha.</div>
        ) : (
          <div className={styles.zoneGrid} data-tour="guard-list">
            {Object.entries(grouped).map(([zone, reservations]) => (
              <section key={zone} className={styles.zonePanel}>
                <div className={styles.zoneHeader}>
                  <h3>{zone}</h3>
                  <span>{reservations.length}</span>
                </div>
                <div className={styles.list}>
                  {reservations.map((reservation) => (
                    <article key={reservation.reservation_id} className={styles.card}>
                      <div className={styles.avatar}>
                        {reservation.user.profile_photo_url ? (
                          <img src={reservation.user.profile_photo_url} alt="" />
                        ) : (
                          <span>{initials(reservation.user)}</span>
                        )}
                      </div>
                      <div className={styles.cardMain}>
                        <div className={styles.cardTop}>
                          <strong>{reservation.user.first_name} {reservation.user.last_name}</strong>
                          <span className={styles.spotPill}>{reservation.parking_spot_number}</span>
                        </div>
                        <div className={styles.meta}>
                          <span>{reservation.start_time} - {reservation.end_time}</span>
                          <span>{reservation.floor_name} · {reservation.space_number}</span>
                          <span>#{reservation.reservation_code}</span>
                        </div>
                        <span className={`${styles.statusChip} ${reservation.status === 'activa' ? styles.statusActive : ''}`}>
                          {reservation.status === 'activa' ? 'Activa' : 'Confirmada'}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
