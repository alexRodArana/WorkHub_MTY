import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BadgeWithStatus, StreakInfo } from '../../types/gamification'
import { fetchMyStats } from '../../services/gamificationService'
import { getSession } from '../../services/tokenStore'
import { useCountUp } from '../../hooks/useCountUp'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import AppShell from '../Layout/AppShell'
import { Tooltip } from '../Tooltip/Tooltip'
import { getBadgeImage } from '../../utils/badgeVisual'
import styles from './BadgesPage.module.css'

function formatEarnedDate(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getBadgePercentageTooltip(badge: BadgeWithStatus): string {
  const percentage = Math.round(badge.earned_percentage ?? 0)
  const status = badge.earned_at
    ? `Ya desbloqueaste este badge el ${formatEarnedDate(badge.earned_at)}.`
    : `Para desbloquearlo: ${badge.description}.`

  return `El ${percentage}% indica cuántos usuarios activos ya han conseguido este badge. ${status}`
}

export function BadgesPage(): JSX.Element {
  const navigate = useNavigate()
  const [streak, setStreak] = useState<StreakInfo | null>(null)
  const [badges, setBadges] = useState<BadgeWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBadge, setSelectedBadge] = useState<BadgeWithStatus | null>(null)

  useEffect(() => {
    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    fetchMyStats(token).then((result) => {
      setLoading(false)
      if (!result.success) {
        if (result.unauthorized) { navigate('/login', { replace: true }); return }
        setError('No se pudieron cargar los logros.')
        return
      }
      setStreak(result.data.streak)
      setBadges(result.data.badges)
    })
  }, [navigate])

  useEffect(() => {
    if (!error) return
    const timeoutId = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  useEffect(() => {
    if (!selectedBadge) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedBadge(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedBadge])

  const earnedCount = badges.filter((b) => b.earned_at !== null).length
  const completion = badges.length > 0 ? Math.round((earnedCount / badges.length) * 100) : 0
  const sortedBadges = useMemo(
    () => [...badges].sort((a, b) => Number(b.earned_at !== null) - Number(a.earned_at !== null) || a.name.localeCompare(b.name)),
    [badges]
  )
  const animatedStreak = useCountUp(streak?.current_streak ?? 0)
  const animatedBest = useCountUp(streak?.longest_streak ?? 0)
  const animatedEarned = useCountUp(earnedCount)
  const animatedCompletion = useCountUp(completion)

  return (
    <AppShell title="Logros" subtitle="Tus insignias y progreso dentro de WorkHub">
      <div className={styles.wrapper}>

        {loading ? (
          <div className={styles.loadingWrap}><LoadingSpinner /></div>
        ) : error ? (
          <p className={styles.errorMsg}>{error}</p>
        ) : (
          <>
            <div className={styles.statsBar} data-tour="badges-progress">
              <div className={styles.statItem}>
                <span className={styles.statValue}>{animatedStreak}</span>
                <span className={styles.statLabel}>Racha actual</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValue}>{animatedBest}</span>
                <span className={styles.statLabel}>Mejor racha</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValue}>{animatedEarned}</span>
                <span className={styles.statLabel}>de {badges.length} logros</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValue}>{animatedCompletion}%</span>
                <span className={styles.statLabel}>completado</span>
              </div>
            </div>

            <div className={styles.badgeGrid} data-tour="badges-grid">
              {sortedBadges.map((badge) => {
                const earned = badge.earned_at !== null
                return (
                  <article
                    key={badge.id}
                    className={`${styles.badgeCard} ${earned ? styles.badgeCardEarned : styles.badgeCardLocked}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver detalle de ${badge.name}`}
                    onClick={() => setSelectedBadge(badge)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedBadge(badge)
                      }
                    }}
                  >
                    <img
                      className={styles.badgeImage}
                      src={getBadgeImage(badge.key, earned)}
                      alt=""
                    />
                    <div className={styles.badgeCardBody}>
                      <div className={styles.badgeHeader}>
                        <strong>{badge.name}</strong>
                        <Tooltip content={getBadgePercentageTooltip(badge)} className={styles.percentageTooltip}>
                          <span className={styles.percentagePill}>{Math.round(badge.earned_percentage ?? 0)}%</span>
                        </Tooltip>
                      </div>
                      <p>{badge.description}</p>
                      <small>
                        {earned && badge.earned_at
                          ? `Desbloqueado ${formatEarnedDate(badge.earned_at)}`
                          : 'Aún no desbloqueado'}
                      </small>
                    </div>
                  </article>
                )
              })}
            </div>

            {selectedBadge && (
              <div
                className={styles.badgeModalBackdrop}
                onClick={(event) => {
                  if (event.target === event.currentTarget) setSelectedBadge(null)
                }}
              >
                <section className={styles.badgeModal} role="dialog" aria-modal="true" aria-labelledby="badge-detail-title">
                  <button
                    type="button"
                    className={styles.badgeModalClose}
                    onClick={() => setSelectedBadge(null)}
                    aria-label="Cerrar detalle del badge"
                  >
                    ×
                  </button>
                  <div className={styles.badgeModalImageWrap}>
                    <img
                      src={getBadgeImage(selectedBadge.key, selectedBadge.earned_at !== null)}
                      alt=""
                    />
                  </div>
                  <div className={styles.badgeModalBody}>
                    <span className={styles.badgeModalEyebrow}>
                      {selectedBadge.earned_at ? 'Badge desbloqueada' : 'Badge pendiente'}
                    </span>
                    <h3 id="badge-detail-title">{selectedBadge.name}</h3>
                    <p>{selectedBadge.description}</p>
                    <dl className={styles.badgeDetailGrid}>
                      <div>
                        <dt>Conseguida</dt>
                        <dd>{selectedBadge.earned_at ? formatEarnedDate(selectedBadge.earned_at) : 'Aún no desbloqueada'}</dd>
                      </div>
                      <div>
                        <dt>Cómo se consigue</dt>
                        <dd>{selectedBadge.description}</dd>
                      </div>
                      <div>
                        <dt>Usuarios que la tienen</dt>
                        <dd>{Math.round(selectedBadge.earned_percentage ?? 0)}%</dd>
                      </div>
                    </dl>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
