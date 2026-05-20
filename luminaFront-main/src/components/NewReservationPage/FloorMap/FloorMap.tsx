import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AiSpaceRecommendationMarker, SpaceAvailability, SpaceOccupancy } from '../../../types/reservation'
import type { FloorSummary, SpaceWithLayout } from '../../../types/floor'
import { fetchFloors, fetchFloorSpaces } from '../../../services/floorService'
import { fetchFloorOccupancy } from '../../../services/reservationService'
import { getSession } from '../../../services/tokenStore'
import { LoadingSpinner } from '../../LoadingSpinner/LoadingSpinner'
import { FloorPlanViewer } from './FloorPlanViewer'
import { SpaceLegend } from './SpaceLegend'
import styles from './FloorMap.module.css'

const EMPTY_ID_SET = new Set<number>()

interface FloorMapProps {
  floorId: number | null
  availableSpaces: SpaceAvailability[]
  selectedSpaceId: number | null
  onSelectSpace: (space: SpaceAvailability) => void
  isLoading: boolean
  hasSearched: boolean
  reservationDate: string
  aiRecommendedSpaces?: Map<number, AiSpaceRecommendationMarker>
  refreshKey?: number
  onCategoriesLoaded?: (categories: string[]) => void
  onVisibleFloorChange?: (floorId: number) => void
  mode?: 'reservation' | 'management'
  onSelectLayoutSpace?: (space: SpaceWithLayout) => void
  managementUnavailableSpaceIds?: Set<number>
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function FloorMap({
  floorId,
  availableSpaces,
  selectedSpaceId,
  onSelectSpace,
  isLoading,
  hasSearched,
  reservationDate,
  aiRecommendedSpaces = new Map(),
  refreshKey = 0,
  onCategoriesLoaded,
  onVisibleFloorChange,
  mode = 'reservation',
  onSelectLayoutSpace,
  managementUnavailableSpaceIds = EMPTY_ID_SET,
}: FloorMapProps) {
  const navigate = useNavigate()
  const [floors, setFloors] = useState<FloorSummary[]>([])
  const [activeFloorId, setActiveFloorId] = useState<number | null>(null)
  const [spaces, setSpaces] = useState<SpaceWithLayout[]>([])
  const [loadingFloors, setLoadingFloors] = useState(true)
  const [loadingSpaces, setLoadingSpaces] = useState(false)
  const [occupancy, setOccupancy] = useState<SpaceOccupancy[]>([])
  const [selectedOccupiedSpaceId, setSelectedOccupiedSpaceId] = useState<number | null>(null)
  const didFetchFloors = useRef(false)
  const spacesRequestIdRef = useRef(0)
  const lastVisibleFloorIdRef = useRef<number | null>(null)
  const userSelectedFloorRef = useRef(false)
  const lastAutoRecommendationSignatureRef = useRef("")
  // Ref keeps latest callback without being a fetchSpaces dep (avoids infinite loop)
  const onCategoriesLoadedRef = useRef(onCategoriesLoaded)
  useEffect(() => { onCategoriesLoadedRef.current = onCategoriesLoaded })

  const resolvedFloorId = floorId !== null ? floorId : activeFloorId

  // Fetch floors once on mount
  useEffect(() => {
    if (didFetchFloors.current) return
    didFetchFloors.current = true

    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    fetchFloors(token).then((result) => {
      if (!result.success) {
        if (result.unauthorized) navigate('/login', { replace: true })
        setLoadingFloors(false)
        return
      }
      setFloors(result.data)
      // Default active tab to first floor or to provided floorId
      if (result.data.length > 0) {
        setActiveFloorId(floorId !== null ? floorId : result.data[0].id)
      }
      setLoadingFloors(false)
    })
  }, [navigate, floorId])

  // When floorId prop changes (filter updated), sync active tab
  useEffect(() => {
    if (floorId !== null) {
      userSelectedFloorRef.current = false
      setActiveFloorId(floorId)
    }
  }, [floorId])

  useEffect(() => {
    if (resolvedFloorId === null || lastVisibleFloorIdRef.current === resolvedFloorId) return
    lastVisibleFloorIdRef.current = resolvedFloorId
    onVisibleFloorChange?.(resolvedFloorId)
  }, [onVisibleFloorChange, resolvedFloorId])

  // Fetch spaces when resolved floor changes
  const fetchSpaces = useCallback(async (fid: number) => {
    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    const requestId = spacesRequestIdRef.current + 1
    spacesRequestIdRef.current = requestId

    setLoadingSpaces(true)
    setSpaces([])
    setOccupancy([])
    setSelectedOccupiedSpaceId(null)

    const result = await fetchFloorSpaces(fid, token)
    if (requestId !== spacesRequestIdRef.current) return

    setLoadingSpaces(false)
    if (!result.success) {
      if (result.unauthorized) navigate('/login', { replace: true })
      return
    }
    setSpaces(result.data)
    const cb = onCategoriesLoadedRef.current
    if (cb) {
      const cats = [...new Set(
        result.data
          .filter((s) => !s.visual_only && s.priority_category)
          .map((s) => s.priority_category as string)
      )]
      cb(cats)
    }
  }, [navigate])

  useEffect(() => {
    if (resolvedFloorId !== null) {
      fetchSpaces(resolvedFloorId)
    }
  }, [resolvedFloorId, fetchSpaces])

  useEffect(() => {
    if (resolvedFloorId === null || !reservationDate) {
      setOccupancy([])
      return
    }

    let cancelled = false
    const token = getSession()?.access_token
    if (!token) { navigate('/login', { replace: true }); return }

    fetchFloorOccupancy(resolvedFloorId, reservationDate, token).then((result) => {
      if (cancelled) return
      if (!result.success) {
        if (result.unauthorized) navigate('/login', { replace: true })
        setOccupancy([])
        return
      }
      setOccupancy(result.data)
    })

    return () => {
      cancelled = true
    }
  }, [navigate, reservationDate, resolvedFloorId, refreshKey])

  // Memoized lookups — only recompute when availableSpaces reference changes
  const availableMap = useMemo(
    () => new Map<number, SpaceAvailability>(availableSpaces.map((s) => [s.id, s])),
    [availableSpaces]
  )
  const availableIds = useMemo(() => new Set<number>(availableMap.keys()), [availableMap])
  const occupancyBySpace = useMemo(
    () => new Map<number, SpaceOccupancy['intervals']>(
      occupancy.map((item) => [item.space_id, item.intervals])
    ),
    [occupancy]
  )
  const spacesById = useMemo(
    () => new Map<number, SpaceWithLayout>(spaces.map((space) => [space.id, space])),
    [spaces]
  )
  const managementAvailableIds = useMemo(
    () => new Set(
      spaces
        .filter((space) => !space.visual_only)
        .filter((space) => !managementUnavailableSpaceIds.has(space.id))
        .filter((space) => !occupancyBySpace.has(space.id))
        .map((space) => space.id)
    ),
    [managementUnavailableSpaceIds, occupancyBySpace, spaces]
  )
  const recommendationCountsByFloor = useMemo(() => {
    const counts = new Map<number, number>()
    for (const recommendation of aiRecommendedSpaces.values()) {
      counts.set(recommendation.floor_id, (counts.get(recommendation.floor_id) ?? 0) + 1)
    }
    return counts
  }, [aiRecommendedSpaces])
  const recommendationSignature = useMemo(
    () => Array.from(aiRecommendedSpaces.entries())
      .map(([spaceId, recommendation]) => `${spaceId}:${recommendation.floor_id}:${recommendation.score}`)
      .sort()
      .join("|"),
    [aiRecommendedSpaces]
  )

  useEffect(() => {
    if (floorId !== null || aiRecommendedSpaces.size === 0) return
    if (lastAutoRecommendationSignatureRef.current === recommendationSignature) return

    lastAutoRecommendationSignatureRef.current = recommendationSignature
    if (userSelectedFloorRef.current) return
    if (activeFloorId !== null && recommendationCountsByFloor.has(activeFloorId)) return

    const firstRecommendedFloorId = Array.from(aiRecommendedSpaces.values())[0]?.floor_id
    if (typeof firstRecommendedFloorId === 'number') {
      setActiveFloorId(firstRecommendedFloorId)
      setSelectedOccupiedSpaceId(null)
    }
  }, [activeFloorId, aiRecommendedSpaces, floorId, recommendationCountsByFloor, recommendationSignature])

  function handleClickSpace(spaceId: number) {
    if (mode === 'management') {
      const space = spacesById.get(spaceId)
      if (space) onSelectLayoutSpace?.(space)
      return
    }

    const avail = availableMap.get(spaceId)
    if (avail) onSelectSpace(avail)
  }

  function handleClickUnavailableSpace(spaceId: number) {
    if (mode === 'management') {
      const space = spacesById.get(spaceId)
      if (space) onSelectLayoutSpace?.(space)
      return
    }

    setSelectedOccupiedSpaceId(spaceId)
  }

  const activeFloor = floors.find((f) => f.id === resolvedFloorId)
  const imageUrl = activeFloor?.plan_image_url ?? null
  const selectedOccupiedSpace = selectedOccupiedSpaceId !== null
    ? spacesById.get(selectedOccupiedSpaceId) ?? null
    : null
  const selectedOccupiedIntervals = selectedOccupiedSpaceId !== null
    ? occupancyBySpace.get(selectedOccupiedSpaceId) ?? []
    : []

  const isBusy = isLoading || loadingFloors || loadingSpaces

  return (
    <div className={styles.wrapper}>
      {floorId === null && (
        <div className={styles.mapToolbar}>
          {floors.length > 0 ? (
            <div className={styles.tabRow} role="tablist" aria-label="Seleccionar piso" data-tour="floor-tabs">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  role="tab"
                  aria-selected={activeFloorId === floor.id}
                  className={`${styles.tab} ${activeFloorId === floor.id ? styles.tabActive : ''}`}
                  onClick={() => {
                    userSelectedFloorRef.current = true
                    setActiveFloorId(floor.id)
                    setSelectedOccupiedSpaceId(null)
                  }}
                  type="button"
                >
                  <span>{floor.name}</span>
                  {recommendationCountsByFloor.has(floor.id) && (
                    <span className={styles.tabRecommendation} aria-label={`${recommendationCountsByFloor.get(floor.id)} recomendaciones IA`}>
                      ✨{recommendationCountsByFloor.get(floor.id)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}

        </div>
      )}

      {/* Map area */}
      <div className={styles.mapArea} data-tour="floor-map">
        {isBusy && (
          <div className={styles.loadingOverlay}>
            <LoadingSpinner />
          </div>
        )}

        {!isBusy && imageUrl && spaces.length > 0 && (
          <div className={styles.mapWrap}>
            <FloorPlanViewer
              key={`${resolvedFloorId ?? 'floor'}-${imageUrl}`}
              imageUrl={imageUrl}
              floorName={activeFloor?.name ?? 'Piso'}
              spaces={spaces}
              availableIds={mode === 'management' ? managementAvailableIds : availableIds}
              selectedId={selectedSpaceId}
              hasSearched={hasSearched}
              occupancyBySpace={occupancyBySpace}
              aiRecommendedSpaces={aiRecommendedSpaces}
              onClickSpace={handleClickSpace}
              onClickUnavailableSpace={handleClickUnavailableSpace}
            />
            {!hasSearched && (
              <div className={styles.searchHintOverlay}>
                <span>Selecciona fecha y horario para ver disponibilidad</span>
              </div>
            )}
          </div>
        )}

        {!isBusy && !imageUrl && !hasSearched && (
          <div className={styles.centeredHint}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Selecciona fecha y horario para ver disponibilidad</span>
          </div>
        )}

        {!isBusy && !imageUrl && hasSearched && (
          <p className={styles.emptyMessage}>Plano no disponible para este piso.</p>
        )}
      </div>

      <div className={styles.legend} data-tour="map-legend">
        <SpaceLegend />
      </div>

      {selectedOccupiedSpace && (
        <div
          className={styles.occupancyBackdrop}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedOccupiedSpaceId(null)
          }}
        >
          <div className={styles.occupancyDialog} role="dialog" aria-modal="true" aria-labelledby="occupied-space-title">
            <div className={styles.occupancyHeader}>
              <div>
                <span className={styles.occupancyEyebrow}>Ocupación del día</span>
                <h3 id="occupied-space-title" className={styles.occupancyTitle}>
                  {selectedOccupiedSpace.space_number}
                </h3>
              </div>
              <button
                type="button"
                className={styles.occupancyClose}
                onClick={() => setSelectedOccupiedSpaceId(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {selectedOccupiedIntervals.length > 0 ? (
              <ul className={styles.occupancyList}>
                {selectedOccupiedIntervals.map((interval) => (
                  <li key={`${interval.start_time}-${interval.end_time}`} className={styles.occupancyItem}>
                    <div className={styles.occupantInfo}>
                      <span className={styles.occupantAvatar}>
                        {interval.user.profile_photo_url ? (
                          <img src={interval.user.profile_photo_url} alt="" />
                        ) : (
                          initials(interval.user.first_name, interval.user.last_name)
                        )}
                      </span>
                      <span>
                        <strong>{interval.user.first_name} {interval.user.last_name}</strong>
                        <small>{interval.start_time} - {interval.end_time}</small>
                      </span>
                    </div>
                    <span>{interval.status === 'activa' ? 'En uso' : 'Reservado'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.occupancyEmpty}>
                No hay horarios ocupados registrados para este espacio en la fecha seleccionada.
              </p>
            )}

            {selectedOccupiedIntervals.length > 0 && (
              <p className={styles.occupancyHint}>
                Se libera a las {selectedOccupiedIntervals[selectedOccupiedIntervals.length - 1].end_time}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
