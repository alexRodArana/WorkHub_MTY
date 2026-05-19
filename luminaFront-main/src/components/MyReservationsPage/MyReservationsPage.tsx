import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ReservationStatus, UserReservation } from '../../types/reservation'
import { cancelReservation, checkInReservation, fetchMyReservations } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import AppShell from '../Layout/AppShell'
import {
  STATUS_LABEL,
  formatDate,
  formatTime,
  formatCheckInTimestamp,
  getCheckInAvailability,
} from '../../utils/checkInUtils'
import styles from './MyReservationsPage.module.css'

type ReservationStatusFilter = ReservationStatus | 'current' | undefined

const STATUS_TABS: { label: string; value: ReservationStatusFilter }[] = [
  { label: 'Activas', value: 'current' },
  { label: 'Historial', value: undefined },
]

const STATUS_CLASS: Record<ReservationStatus, string> = {
  confirmada: 'badgeConfirmada',
  activa: 'badgeActiva',
  cancelada: 'badgeCancelada',
  no_show: 'badgeNoShow',
}

function getReservationType(reservation: UserReservation): {
  label: string
  className: string
  parkingOnly: boolean
} {
  const hasParking = Boolean(reservation.parking_spot_number)
  const parkingOnly =
    reservation.floor_number === null ||
    reservation.space_number.toLowerCase() === 'solo estacionamiento'

  if (parkingOnly) {
    return { label: 'Solo estacionamiento', className: 'typeParkingOnly', parkingOnly: true }
  }

  if (hasParking) {
    return { label: 'Escritorio + estacionamiento', className: 'typeDeskParking', parkingOnly: false }
  }

  return { label: 'Solo escritorio', className: 'typeDeskOnly', parkingOnly: false }
}

export function MyReservationsPage(): JSX.Element {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [reservations, setReservations] = useState<UserReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [checkingIn, setCheckingIn] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const currentStatus = STATUS_TABS[activeTab].value

  const loadReservations = useCallback(async (showLoading = true) => {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (showLoading) setLoading(true)
    setError(null)

    const result = await fetchMyReservations(token, currentStatus)
    if (showLoading) setLoading(false)

    if (!result.success) {
      if ('unauthorized' in result && result.unauthorized) {
        navigate('/login', { replace: true })
        return
      }

      setError('No se pudieron cargar las reservas.')
      return
    }

    setReservations(result.data)
  }, [currentStatus, navigate])

  useEffect(() => {
    if (activeTab !== 0) return
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [activeTab])

  useEffect(() => {
    if (!error) return
    const timeoutId = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  useEffect(() => {
    if (!successMessage) return
    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  useEffect(() => {
    void loadReservations()
  }, [loadReservations])

  useReservationRealtime(() => {
    void loadReservations(false)
  })

  async function handleCancel(id: number) {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setCancelling(id)
    setError(null)
    setSuccessMessage(null)

    const result = await cancelReservation(id, token)

    setCancelling(null)

    if (!result.success) {
      if ('unauthorized' in result && result.unauthorized) {
        navigate('/login', { replace: true })
        return
      }

      setError('No se pudo cancelar la reserva. Inténtalo de nuevo.')
      return
    }

    setReservations((prev) => prev.filter((reservation) => reservation.reservation_id !== id))
  }

  async function handleCheckIn(id: number) {
    const token = getSession()?.access_token
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setCheckingIn(id)
    setError(null)
    setSuccessMessage(null)

    const result = await checkInReservation(id, token)

    setCheckingIn(null)

    if (!result.success) {
      if ('unauthorized' in result && result.unauthorized) {
        navigate('/login', { replace: true })
        return
      }

      if ('error' in result && result.error === 'CHECK_IN_NOT_AVAILABLE_YET') {
        setError('El check-in todavía no está disponible para esa reserva.')
        return
      }

      if ('error' in result && result.error === 'CHECK_IN_WINDOW_CLOSED') {
        setError('La ventana de check-in ya cerró para esa reserva.')
        return
      }

      if ('error' in result && result.error === 'CHECK_IN_OUTSIDE_ALLOWED_NETWORK') {
        setError('El check-in solo puede hacerse dentro de la oficina.')
        return
      }

      setError('No se pudo realizar el check-in. Inténtalo de nuevo.')
      return
    }

    const checkedInAt = new Date().toISOString()
    const checkedReservation = reservations.find((reservation) => reservation.reservation_id === id)
    const checkedReservationLabel = checkedReservation?.space_number

    setReservations((prev) =>
      prev.map((reservation) =>
        reservation.reservation_id === id
          ? { ...reservation, status: 'activa', check_in_time: checkedInAt }
          : reservation
      )
    )

    setSuccessMessage(
      checkedReservationLabel
        ? `Check-in realizado para ${checkedReservationLabel}.`
        : 'Check-in realizado.'
    )
  }

  return (
    <AppShell
      title="Mis reservas"
      subtitle="Consulta y administra tus reservaciones"
      action={
        <Link to="/nueva-reserva" className={styles.newReservationBtn}>
          + Nueva reserva
        </Link>
      }
    >
      <div className={styles.wrapper}>
        <div className={styles.tabs} role="tablist">
          {STATUS_TABS.map((tab, index) => (
            <button
              key={index}
              role="tab"
              aria-selected={activeTab === index}
              className={`${styles.tab} ${activeTab === index ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab(index)
                setError(null)
                setSuccessMessage(null)
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className={styles.errorMsg}>
            <span>{error}</span>
            <button type="button" className={styles.dismissBtn} onClick={() => setError(null)} aria-label="Cerrar">×</button>
          </div>
        )}
        {successMessage && (
          <div className={styles.successMsg}>
            <span>{successMessage}</span>
            <button type="button" className={styles.dismissBtn} onClick={() => setSuccessMessage(null)} aria-label="Cerrar">×</button>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingWrap}>
            <LoadingSpinner />
          </div>
        ) : (
          (() => {
            // Historial: exclude confirmada (those belong to Activas tab)
            const displayed = activeTab === 1
              ? reservations.filter((r) => r.status !== 'confirmada')
              : reservations

            if (displayed.length === 0) {
              return (
                <p className={styles.emptyMsg}>
                  {activeTab === 0 ? 'No tienes reservas activas.' : 'No hay reservas en el historial.'}
                </p>
              )
            }

            return (
              <ul className={styles.list}>
                {displayed.map((reservation) => {
                  const isHistorial = activeTab === 1
                  const displaySpace = reservation.space_number
                  const displayFloor = reservation.floor_name
                  const reservationType = getReservationType(reservation)
                  const checkIn = isHistorial || reservationType.parkingOnly
                    ? null
                    : getCheckInAvailability(reservation, nowMs)
                  const helperClassName =
                    checkIn?.tone === 'ready'
                      ? styles.actionHintReady
                      : checkIn?.tone === 'done'
                        ? styles.actionHintDone
                        : checkIn?.tone === 'closed'
                          ? styles.actionHintClosed
                          : styles.actionHint

                  return (
                    <li key={reservation.reservation_id} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div>
                          <span className={styles.spaceNum}>{displaySpace}</span>
                          <span className={styles.floorName}>{displayFloor}</span>
                        </div>

                        <div className={styles.cardBadges}>
                          <span className={`${styles.typeBadge} ${styles[reservationType.className]}`}>
                            {reservationType.label}
                          </span>
                          <span className={`${styles.badge} ${styles[STATUS_CLASS[reservation.status]]}`}>
                            {STATUS_LABEL[reservation.status]}
                          </span>
                        </div>
                      </div>

                      <div className={styles.cardMeta}>
                        <span>{formatDate(reservation.reservation_date)}</span>
                        <span>{formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}</span>
                        <span className={styles.code}>#{reservation.reservation_code}</span>
                        {reservation.parking_spot_number && (
                          <span className={styles.parkingBadge}>
                            🚗 {reservation.parking_zone_name} · {reservation.parking_spot_number}
                          </span>
                        )}
                        {isHistorial && reservation.status === 'activa' && reservation.check_in_time && (
                          <span className={styles.checkInRecord}>
                            ✓ Check-in {formatCheckInTimestamp(reservation.check_in_time)}
                          </span>
                        )}
                      </div>

                      {!isHistorial && (reservation.status === 'confirmada' || reservation.status === 'activa') && (
                        <div className={styles.actionsWrap}>
                          <div className={styles.primaryActions}>
                            <button
                              type="button"
                              className={styles.cancelBtn}
                              disabled={cancelling === reservation.reservation_id || reservation.status !== 'confirmada'}
                              onClick={() => handleCancel(reservation.reservation_id)}
                            >
                              {cancelling === reservation.reservation_id ? 'Cancelando...' : 'Cancelar reserva'}
                            </button>

                            {checkIn && (
                              <button
                                type="button"
                                className={`${styles.checkInBtn} ${
                                  checkIn.tone === 'done'
                                    ? styles.checkInBtnDone
                                    : checkIn.enabled
                                      ? styles.checkInBtnActive
                                      : ''
                                }`}
                                disabled={
                                  !checkIn.enabled ||
                                  checkingIn === reservation.reservation_id ||
                                  reservation.status === 'activa'
                                }
                                onClick={() => {
                                  void handleCheckIn(reservation.reservation_id)
                                }}
                              >
                                {checkingIn === reservation.reservation_id
                                  ? 'Haciendo check in...'
                                  : checkIn.buttonLabel}
                              </button>
                            )}
                          </div>

                          {checkIn && (
                            <span className={helperClassName}>
                              {checkIn.helper}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )
          })()
        )}
      </div>
    </AppShell>
  )
}
