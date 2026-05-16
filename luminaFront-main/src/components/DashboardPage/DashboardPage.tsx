import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { useCountUp } from '../../hooks/useCountUp'
import { Link, useNavigate } from 'react-router-dom'
import type { UserReservation } from '../../types/reservation'
import type { BadgeInfo, BadgeWithStatus, StreakInfo } from '../../types/gamification'
import { fetchMyReservations, checkInReservation, cancelReservation } from '../../services/reservationService'
import { fetchMyStats } from '../../services/gamificationService'
import { getSession } from '../../services/tokenStore'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import AppShell from '../Layout/AppShell'
import {
  STATUS_LABEL,
  STATUS_COLORS,
  getNormalizedDateString,
  getTodayString,
  formatTime,
  formatDateLong,
  formatTodayFull,
  formatCheckInTimestamp,
  getCheckInAvailability,
  getGreeting,
} from '../../utils/checkInUtils'
import { getBadgeImage } from '../../utils/badgeVisual'
import styles from './DashboardPage.module.css'

function getReservationLabel(reservation: UserReservation): string {
  return reservation.space_number
}

function getReservationLocation(reservation: UserReservation): string {
  return reservation.floor_name
}

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const session = getSession()
  const firstName = session?.user.first_name ?? ''

  const [allReservations, setAllReservations] = useState<UserReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const animatedStreak = useCountUp(streak?.current_streak ?? 0)
  const animatedBest   = useCountUp(streak?.longest_streak ?? 0)
  const [earnedBadges, setEarnedBadges] = useState<BadgeWithStatus[]>([])
  const [badgeToast, setBadgeToast] = useState<BadgeInfo[]>([])

  const today = getTodayString()

  const loadDashboardData = useCallback(async (showLoading = true) => {
    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    if (showLoading) setLoading(true)
    setError(null)

    const [reservationsResult, statsResult] = await Promise.all([
      fetchMyReservations(token),
      fetchMyStats(token),
    ])

    if (showLoading) setLoading(false)

    if (!reservationsResult.success) {
      if (reservationsResult.unauthorized) { navigate('/login', { replace: true }); return }
      setError('No se pudieron cargar las reservas.')
      return
    }
    setAllReservations(reservationsResult.data)

    if (statsResult.success) {
      setStreak(statsResult.data.streak)
      setEarnedBadges(statsResult.data.badges)
    }
  }, [navigate])

  const todayReservation = useMemo(() =>
    allReservations.find(
      (r) => getNormalizedDateString(r.reservation_date) === today &&
        (r.status === 'confirmada' || r.status === 'activa')
    ) ?? null,
    [allReservations, today]
  )

  const upcomingReservation = useMemo(() =>
    [...allReservations]
      .filter(
        (r) => getNormalizedDateString(r.reservation_date) > today && r.status === 'confirmada'
      )
      .sort((a, b) =>
        getNormalizedDateString(a.reservation_date).localeCompare(getNormalizedDateString(b.reservation_date))
      )[0] ?? null,
    [allReservations, today]
  )

  const recentHistory = useMemo(() =>
    allReservations
      .filter((r) => getNormalizedDateString(r.reservation_date) < today)
      .sort((a, b) =>
        getNormalizedDateString(b.reservation_date).localeCompare(getNormalizedDateString(a.reservation_date))
      )
      .slice(0, 3),
    [allReservations, today]
  )

  const recentEarned = useMemo(
    () => earnedBadges.filter((b) => b.earned_at !== null).slice(0, 3),
    [earnedBadges]
  )

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  useReservationRealtime((event) => {
    if (!event.reservation_date || event.reservation_date >= today) {
      void loadDashboardData(false)
    }
  })

  useEffect(() => {
    if (!todayReservation || todayReservation.status !== 'confirmada') return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [todayReservation])

  useEffect(() => {
    if (!error) return
    const timeoutId = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  useEffect(() => {
    if (!checkInError) return
    const timeoutId = window.setTimeout(() => setCheckInError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [checkInError])

  useEffect(() => {
    if (!cancelError) return
    const timeoutId = window.setTimeout(() => setCancelError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [cancelError])

  // Auto-dismiss toast after 5s
  useEffect(() => {
    if (badgeToast.length === 0) return
    const id = window.setTimeout(() => setBadgeToast([]), 5000)
    return () => window.clearTimeout(id)
  }, [badgeToast])

  async function handleCheckIn() {
    if (!todayReservation) return
    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    setCheckingIn(true)
    setCheckInError(null)

    const result = await checkInReservation(todayReservation.reservation_id, token)
    setCheckingIn(false)

    if (!result.success) {
      if (result.unauthorized) { navigate('/login', { replace: true }); return }
      const msg =
        result.error === 'CHECK_IN_NOT_AVAILABLE_YET' ? 'El check-in todavía no está disponible.' :
        result.error === 'CHECK_IN_WINDOW_CLOSED' ? 'La ventana de check-in ya cerró.' :
        result.error === 'CHECK_IN_OUTSIDE_ALLOWED_NETWORK' ? 'Debes estar en la red de la oficina.' :
        'No se pudo realizar el check-in.'
      setCheckInError(msg)
      return
    }

    setAllReservations((prev) =>
      prev.map((r) =>
        r.reservation_id === todayReservation.reservation_id
          ? { ...r, status: 'activa', check_in_time: new Date().toISOString() }
          : r
      )
    )

    if (result.data.streak) {
      setStreak(result.data.streak)
    }

    if (result.data.newBadges?.length) {
      setBadgeToast(result.data.newBadges)
      // Refresh full badge list to mark newly earned
      const token2 = getSession()?.access_token
      if (token2) {
        fetchMyStats(token2).then((s) => {
          if (s.success) {
            setStreak(s.data.streak)
            setEarnedBadges(s.data.badges)
          }
        })
      }
    }
  }

  async function handleCancelToday() {
    if (!todayReservation) return
    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    setCancelling(true)
    setCancelError(null)

    const result = await cancelReservation(todayReservation.reservation_id, token)
    setCancelling(false)

    if (!result.success) {
      if (result.unauthorized) { navigate('/login', { replace: true }); return }
      setCancelError('No se pudo cancelar la reserva.')
      return
    }

    setAllReservations((prev) =>
      prev.filter((r) => r.reservation_id !== todayReservation.reservation_id)
    )
  }

  const checkIn = todayReservation ? getCheckInAvailability(todayReservation, nowMs) : null

  return (
    <AppShell title="Inicio">
      <div className={styles.page}>

        {/* Badge toast */}
        {badgeToast.length > 0 && (
          <div className={styles.badgeToast} role="status" aria-live="polite">
            {badgeToast.map((b, index) => (
              <div
                key={b.id}
                className={styles.badgeToastItem}
                style={{ '--delay': `${index * 90}ms` } as CSSProperties}
              >
                <span className={styles.badgeHalo} aria-hidden="true" />
                <span className={styles.badgeSparkle} aria-hidden="true">✨</span>
                <img className={styles.badgeToastIcon} src={getBadgeImage(b.key, true)} alt="" />
                <div className={styles.badgeToastText}>
                  <span className={styles.badgeToastTitle}>Nuevo logro desbloqueado</span>
                  <span className={styles.badgeToastName}>{b.name}</span>
                  <span className={styles.badgeToastDescription}>{b.description}</span>
                  <Link to="/logros" className={styles.badgeToastLink}>Ver logro</Link>
                </div>
                <span className={styles.badgeToastProgress} aria-hidden="true" />
              </div>
            ))}
          </div>
        )}

        {/* Greeting */}
        <div className={styles.greeting}>
          <p className={styles.greetingDate}>{formatTodayFull()}</p>
          <h2 className={styles.greetingName}>{getGreeting(firstName)}</h2>
        </div>

        {loading ? (
          <div className={styles.loadingWrap}>
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className={styles.globalError}>{error}</div>
        ) : (
          <>
            {/* ── STREAK WIDGET ─────────────────────────────────── */}
            {streak && (
              <div className={styles.streakCard}>
                <span className={styles.streakFire}>
                  {streak.current_streak >= 10 ? '🔥' : streak.current_streak >= 3 ? '⚡' : '✨'}
                </span>
                <div className={styles.streakInfo}>
                  <span className={styles.streakCount}>{animatedStreak}</span>
                  <span className={styles.streakLabel}>
                    {streak.current_streak === 1 ? 'día de racha' : 'días de racha'}
                  </span>
                  {streak.longest_streak > streak.current_streak && (
                    <span className={styles.streakBest}>Mejor racha: {animatedBest} días</span>
                  )}
                </div>
                <Link to="/logros" className={styles.streakLink}>Ver logros →</Link>
              </div>
            )}

            {/* ── TODAY SECTION ─────────────────────────────────── */}
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Hoy</p>

              {todayReservation ? (
                <div className={styles.todayCard}>
                  <div className={styles.todayAccent} />
                  <div className={styles.todayInner}>
                    <div className={styles.todayTop}>
                      <span className={styles.todayChip}>HOY</span>
                      <span
                        className={styles.statusBadge}
                        style={STATUS_COLORS[todayReservation.status]}
                      >
                        {STATUS_LABEL[todayReservation.status]}
                      </span>
                    </div>

                    <div className={styles.todayMain}>
                      <div className={styles.spaceInfo}>
                        <span className={styles.spaceNumber}>{getReservationLabel(todayReservation)}</span>
                        <span className={styles.floorName}>{getReservationLocation(todayReservation)}</span>
                      </div>
                      <span className={styles.timeRange}>
                        {formatTime(todayReservation.start_time)}–{formatTime(todayReservation.end_time)}
                      </span>
                    </div>

                    <div className={styles.todayActions}>
                      {checkIn && (
                        <span
                          className={`${styles.checkInHelper} ${
                            checkIn.tone === 'ready' ? styles.helperReady :
                            checkIn.tone === 'done'  ? styles.helperDone :
                            checkIn.tone === 'closed' ? styles.helperClosed :
                            styles.helperPending
                          }`}
                        >
                          {checkIn.tone === 'ready' && <span className={styles.pulseDot} />}
                          {checkIn.helper}
                        </span>
                      )}

                      <div className={styles.actionBtns}>
                        {todayReservation.status === 'confirmada' && (
                          <button
                            type="button"
                            className={styles.cancelTodayBtn}
                            onClick={handleCancelToday}
                            disabled={cancelling}
                          >
                            {cancelling ? 'Cancelando...' : 'Cancelar'}
                          </button>
                        )}

                        {todayReservation.status === 'confirmada' && (
                          <button
                            type="button"
                            className={`${styles.checkInBtn} ${checkIn?.enabled ? styles.checkInBtnReady : ''}`}
                            onClick={handleCheckIn}
                            disabled={!checkIn?.enabled || checkingIn}
                          >
                            {checkingIn ? 'Procesando...' : (checkIn?.buttonLabel ?? 'Check in')}
                          </button>
                        )}

                        {todayReservation.status === 'activa' && (
                          <span className={styles.checkedInConfirm}>
                            ✓ Check-in realizado
                            {formatCheckInTimestamp(todayReservation.check_in_time)
                              ? ` a las ${formatCheckInTimestamp(todayReservation.check_in_time)}`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {checkInError && <p className={styles.inlineError}>{checkInError}</p>}
                    {cancelError && <p className={styles.inlineError}>{cancelError}</p>}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyTodayCard}>
                  <div className={styles.emptyTodayText}>
                    <p className={styles.emptyTodayTitle}>Sin reserva para hoy</p>
                    {upcomingReservation && (
                      <p className={styles.nextUp}>
                        Próxima: {formatDateLong(upcomingReservation.reservation_date)} · {getReservationLabel(upcomingReservation)} · {formatTime(upcomingReservation.start_time)}–{formatTime(upcomingReservation.end_time)}
                      </p>
                    )}
                  </div>
                  <Link to="/nueva-reserva" className={styles.bookNowBtn}>
                    + Reservar ahora
                  </Link>
                </div>
              )}
            </div>

            {/* ── QUICK ACTIONS ─────────────────────────────────── */}
            <div className={styles.quickActionsGrid}>
              <Link to="/nueva-reserva" className={styles.actionCard}>
                <span className={styles.actionIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                </span>
                <span className={styles.actionLabel}>Nueva Reserva</span>
                <span className={styles.actionSub}>Busca y reserva tu espacio</span>
              </Link>

              <Link to="/mis-reservas" className={styles.actionCard}>
                <span className={styles.actionIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/>
                    <line x1="8" y1="12" x2="21" y2="12"/>
                    <line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/>
                    <line x1="3" y1="12" x2="3.01" y2="12"/>
                    <line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </span>
                <span className={styles.actionLabel}>Mis Reservas</span>
                <span className={styles.actionSub}>Historial y gestión</span>
              </Link>
            </div>

            {/* ── RECENT HISTORY ────────────────────────────────── */}
            {recentHistory.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <p className={styles.sectionLabel}>Historial reciente</p>
                  <Link to="/mis-reservas" className={styles.sectionLink}>Ver todo →</Link>
                </div>
                <ul className={styles.recentList}>
                  {recentHistory.map((r) => (
                    <li key={r.reservation_id} className={styles.recentItem}>
                      <div className={styles.recentLeft}>
                        <span className={styles.recentSpace}>{getReservationLabel(r)}</span>
                        <span className={styles.recentFloor}>{getReservationLocation(r)}</span>
                      </div>
                      <span className={styles.recentDate}>
                        {formatDateLong(r.reservation_date)} · {formatTime(r.start_time)}–{formatTime(r.end_time)}
                      </span>
                      <span
                        className={styles.recentBadge}
                        style={STATUS_COLORS[r.status]}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── BADGE PREVIEW ─────────────────────────────────── */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <p className={styles.sectionLabel}>Logros recientes</p>
                <Link to="/logros" className={styles.sectionLink}>Ver todos →</Link>
              </div>
              {recentEarned.length > 0 ? (
                <div className={styles.badgePreviewList}>
                  {recentEarned.map((b) => (
                    <span
                      key={b.id}
                      className={styles.badgeChip}
                    >
                      🏅 {b.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.noBadgeHint}>Realiza tu primera reserva para desbloquear logros.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
