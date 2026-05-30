import { useState, useCallback, useEffect, useMemo } from 'react'
import type { SpaceWithLayout, LayoutDirection } from '../../../types/floor'
import type { AiSpaceRecommendationMarker, SpaceOccupancy } from '../../../types/reservation'
import styles from './FloorPlanViewer.module.css'

export type SpaceStatus = 'available' | 'unavailable' | 'selected' | 'neutral'

interface FloorPlanViewerProps {
  imageUrl: string
  floorName: string
  spaces: SpaceWithLayout[]
  availableIds: Set<number>
  selectedId: number | null
  hasSearched: boolean
  occupancyBySpace: Map<number, SpaceOccupancy['intervals']>
  aiRecommendedSpaces: Map<number, AiSpaceRecommendationMarker>
  onClickSpace: (spaceId: number) => void
  onClickUnavailableSpace: (spaceId: number) => void
}

type OccupancyInterval = SpaceOccupancy['intervals'][number]

// Desk fills mirror room styling: solid stroke with translucent interior.
const DESK_FILL: Record<SpaceStatus, string> = {
  available:   'rgba(0, 201, 167, 0.24)',
  unavailable: 'rgba(192, 192, 192, 0.2)',
  selected:    'rgba(161, 0, 255, 0.3)',
  neutral:     'rgba(184, 196, 204, 0.16)',
}
const DESK_STROKE: Record<SpaceStatus, string> = {
  available:   '#00c9a7',
  unavailable: '#a8a8a8',
  selected:    '#a100ff',
  neutral:     '#8a9baa',
}
const DESK_STROKE_WIDTH: Record<SpaceStatus, number> = {
  available:   0.34,
  unavailable: 0.24,
  selected:    0.58,
  neutral:     0.24,
}

// Area fills — semi-transparent so floor plan shows through
const AREA_FILL: Record<SpaceStatus, string> = {
  available:   'rgba(0, 201, 167, 0.22)',
  unavailable: 'rgba(192, 192, 192, 0.18)',
  selected:    'rgba(161, 0, 255, 0.28)',
  neutral:     'rgba(184, 196, 204, 0.15)',
}
const AREA_STROKE: Record<SpaceStatus, string> = {
  available:   '#00c9a7',
  unavailable: '#b0b0b0',
  selected:    '#a100ff',
  neutral:     '#8a9baa',
}
const AREA_STROKE_WIDTH: Record<SpaceStatus, number> = {
  available:   0.45,
  unavailable: 0.25,
  selected:    0.7,
  neutral:     0.25,
}
const HOVER_STROKE: Record<SpaceStatus, string> = {
  available: '#00a98e',
  unavailable: '#5c6470',
  selected: '#7500c0',
  neutral: '#5f6f7a',
}
const AI_RECOMMENDATION_STROKE = '#ffb000'
const AI_RECOMMENDATION_FILL = 'rgba(255, 176, 0, 0.18)'

function getStatus(
  space: SpaceWithLayout,
  availableIds: Set<number>,
  selectedId: number | null,
  hasSearched: boolean
): SpaceStatus {
  if (space.id === selectedId) return 'selected'
  if (!hasSearched) return 'neutral'
  return availableIds.has(space.id) ? 'available' : 'unavailable'
}

function seatOffset(dir: LayoutDirection, dw: number, dh: number): { dx: number; dy: number } {
  const r = Math.min(dw, dh) * 0.38
  switch (dir) {
    case 'up':    return { dx: 0,  dy: -(dh / 2 + r) }
    case 'down':  return { dx: 0,  dy:  (dh / 2 + r) }
    case 'left':  return { dx: -(dw / 2 + r), dy: 0  }
    case 'right': return { dx:  (dw / 2 + r), dy: 0  }
  }
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function getSpaceAnchor(space: SpaceWithLayout, vbW: number): { x: number; y: number } | null {
  if (space.layout_cx != null && space.layout_cy != null) {
    return { x: space.layout_cx * vbW, y: space.layout_cy * 100 }
  }

  if (!space.layout_points || space.layout_points.length === 0) return null

  if (space.layout_type === 'desk' && space.layout_points.length >= 2) {
    const p0 = space.layout_points[0]
    const p1 = space.layout_points[1]
    return {
      x: ((p0.x + p1.x) / 2) * vbW,
      y: ((p0.y + p1.y) / 2) * 100,
    }
  }

  const sum = space.layout_points.reduce((acc, point) => ({
    x: acc.x + point.x * vbW,
    y: acc.y + point.y * 100,
  }), { x: 0, y: 0 })

  return {
    x: sum.x / space.layout_points.length,
    y: sum.y / space.layout_points.length,
  }
}

function getDeskBodyAnchor(space: SpaceWithLayout, vbW: number): { x: number; y: number; bodyHeight: number; direction: LayoutDirection } | null {
  if (space.layout_type !== 'desk' || !space.layout_points || space.layout_points.length < 2) return null
  const p0 = space.layout_points[0]
  const p1 = space.layout_points[1]
  const x1 = p0.x * vbW
  const y1 = p0.y * 100
  const x2 = p1.x * vbW
  const y2 = p1.y * 100
  const dh = y2 - y1
  const dir = space.layout_direction ?? 'up'

  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    bodyHeight: Math.abs(dh),
    direction: dir,
  }
}

function getOccupantMarkerAnchor(space: SpaceWithLayout, vbW: number): { x: number; y: number } | null {
  const deskAnchor = getDeskBodyAnchor(space, vbW)
  if (deskAnchor) {
    const verticalOffset = deskAnchor.direction === 'down'
      ? Math.max(5.2, deskAnchor.bodyHeight + 2.4)
      : deskAnchor.direction === 'up'
        ? -Math.max(5.2, deskAnchor.bodyHeight + 2.4)
        : deskAnchor.y < 52 ? Math.max(5.2, deskAnchor.bodyHeight + 2.4) : -Math.max(5.2, deskAnchor.bodyHeight + 2.4)
    return {
      x: deskAnchor.x,
      y: Math.max(4, Math.min(96, deskAnchor.y + verticalOffset)),
    }
  }

  const anchor = getSpaceAnchor(space, vbW)
  if (!anchor) return null
  return {
    x: anchor.x,
    y: anchor.y < 52 ? Math.min(96, anchor.y + 7) : Math.max(4, anchor.y - 7),
  }
}

const ROOM_DISPLAY_NAMES: Record<string, string> = {
  'PB-A1': 'Fundidora',
  'PB-A2': 'La Huasteca',
  'PB-A3': 'Monterrey',
  'MZ-A1': 'Sala Mitras',
  'MZ-A2': 'Chipinque',
  'MZ-AREA-72': 'Santa Lucia',
  'P3-A1': 'Sierra Madre',
  'P3-AREA-33': 'La Silla',
  'P9-A1': 'Estanzuela',
  'P9-A2': 'Area Colaborativa AC-9091',
  'P9-A3': 'Area D.T. SJ-9088',
}

function getSpaceDisplayName(space: SpaceWithLayout): string {
  return space.display_name || ROOM_DISPLAY_NAMES[space.space_number] || space.space_number
}

interface ShapeProps {
  space: SpaceWithLayout
  vbW: number
  status: SpaceStatus
  hovered: boolean
  onClick: () => void
  aiRecommendation: AiSpaceRecommendationMarker | null
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function OccupantMarker({
  space,
  vbW,
  intervals,
}: {
  space: SpaceWithLayout
  vbW: number
  intervals: OccupancyInterval[]
}) {
  const anchor = getOccupantMarkerAnchor(space, vbW)
  if (!anchor || intervals.length === 0) return null

  const primary = intervals[0]
  const user = primary.user
  const clipId = `occupant-avatar-${space.id}-${user.id}`
  const radius = 2.75
  const x = anchor.x
  const y = anchor.y

  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle
        cx={x.toFixed(3)}
        cy={y.toFixed(3)}
        r={(radius + 0.55).toFixed(3)}
        fill="#ffffff"
        stroke="#7500c0"
        strokeWidth="0.32"
        filter="url(#occupantAvatarLift)"
      />
      <clipPath id={clipId}>
        <circle cx={x.toFixed(3)} cy={y.toFixed(3)} r={radius.toFixed(3)} />
      </clipPath>
      {user.profile_photo_url ? (
        <image
          href={user.profile_photo_url}
          x={(x - radius).toFixed(3)}
          y={(y - radius).toFixed(3)}
          width={(radius * 2).toFixed(3)}
          height={(radius * 2).toFixed(3)}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <>
          <circle cx={x.toFixed(3)} cy={y.toFixed(3)} r={radius.toFixed(3)} fill="#460073" />
          <text
            x={x.toFixed(3)}
            y={(y + 0.08).toFixed(3)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="1.65"
            fontWeight="bold"
            fill="#ffffff"
          >
            {getInitials(user.first_name, user.last_name)}
          </text>
        </>
      )}
      {intervals.length > 1 && (
        <g>
          <circle
            cx={(x + 3.8).toFixed(3)}
            cy={(y + 1.8).toFixed(3)}
            r="1.8"
            fill="#18151f"
            stroke="#ffffff"
            strokeWidth="0.28"
          />
          <text
            x={(x + 3.8).toFixed(3)}
            y={(y + 1.88).toFixed(3)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="1.25"
            fontWeight="bold"
            fill="#ffffff"
          >
            +{intervals.length - 1}
          </text>
        </g>
      )}
    </g>
  )
}

function AreaShape({
  space,
  vbW,
  status,
  hovered,
  onClick,
  aiRecommendation,
  onMouseEnter,
  onMouseLeave,
}: ShapeProps) {
  if (!space.layout_points || space.layout_points.length < 2) return null

  const pts = space.layout_points
    .map((p) => `${(p.x * vbW).toFixed(3)},${(p.y * 100).toFixed(3)}`)
    .join(' ')

  const clickable = status !== 'neutral'
  const isSelected = status === 'selected'

  const baseFill   = AREA_FILL[status]
  const baseStroke = AREA_STROKE[status]
  const strokeW    = AREA_STROKE_WIDTH[status]
  const cx = space.layout_cx != null ? space.layout_cx * vbW : null
  const cy = space.layout_cy != null ? space.layout_cy * 100 : null

  // Hover: slightly brighter fill
  const fill   = hovered && clickable ? baseFill.replace(/[\d.]+\)$/, (m) => {
    const v = parseFloat(m) + 0.12
    return Math.min(v, 0.55).toFixed(2) + ')'
  }) : baseFill

  return (
    <g
      onClick={clickable ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      role={clickable ? 'button' : undefined}
      aria-label={getSpaceDisplayName(space)}
    >
      {aiRecommendation && status === 'available' && (
        <polygon
          points={pts}
          fill={AI_RECOMMENDATION_FILL}
          stroke={AI_RECOMMENDATION_STROKE}
          strokeWidth={0.86}
          strokeLinejoin="round"
          filter="url(#aiRecommendationGlow)"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <polygon
        points={pts}
        fill={fill}
        stroke={hovered ? HOVER_STROKE[status] : baseStroke}
        strokeWidth={hovered && clickable ? strokeW + 0.48 : strokeW}
        strokeDasharray={isSelected ? '2 0.8' : undefined}
        strokeLinejoin="round"
        filter={hovered || isSelected ? 'url(#spaceLift)' : undefined}
        style={{ transition: 'fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease' }}
      />
      {aiRecommendation && status === 'available' && cx !== null && cy !== null && !hovered && !isSelected && (
        <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <circle cx={(cx + 5.2).toFixed(3)} cy={(cy - 4.2).toFixed(3)} r="1.1" fill="#ffcf52" filter="url(#aiRecommendationGlow)">
            <animate attributeName="opacity" values="0.45;1;0.45" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="r" values="0.85;1.35;0.85" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </g>
  )
}

function DeskShape({
  space,
  vbW,
  status,
  hovered,
  onClick,
  aiRecommendation,
  onMouseEnter,
  onMouseLeave,
}: ShapeProps) {
  if (!space.layout_points || space.layout_points.length < 2) return null

  const p0 = space.layout_points[0]
  const p1 = space.layout_points[1]
  const x1 = p0.x * vbW, y1 = p0.y * 100
  const x2 = p1.x * vbW, y2 = p1.y * 100
  const dw = x2 - x1, dh = y2 - y1
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const dir = space.layout_direction ?? 'up'
  const seatR = Math.min(dw, dh) * 0.38
  const off = seatOffset(dir, dw, dh)
  const fill   = DESK_FILL[status]
  const stroke = DESK_STROKE[status]
  const strokeW = DESK_STROKE_WIDTH[status]
  const clickable = status !== 'neutral'
  const isSelected = status === 'selected'
  const sparkleY = Math.max(4, my - dh / 2 - seatR - 3.8)

  return (
    <g
      onClick={clickable ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      role={clickable ? 'button' : undefined}
      aria-label={getSpaceDisplayName(space)}
    >
      {aiRecommendation && status === 'available' && (
        <>
          <rect
            x={(x1 - 0.85).toFixed(3)} y={(y1 - 0.85).toFixed(3)}
            width={(dw + 1.7).toFixed(3)} height={(dh + 1.7).toFixed(3)}
            rx={(Math.min(dw, dh) * 0.26).toFixed(3)}
            fill={AI_RECOMMENDATION_FILL}
            stroke={AI_RECOMMENDATION_STROKE}
            strokeWidth={0.52}
            filter="url(#aiRecommendationGlow)"
            style={{ pointerEvents: 'none' }}
          />
          <circle
            cx={(mx + off.dx).toFixed(3)}
            cy={(my + off.dy).toFixed(3)}
            r={(seatR + 0.72).toFixed(3)}
            fill={AI_RECOMMENDATION_FILL}
            stroke={AI_RECOMMENDATION_STROKE}
            strokeWidth={0.52}
            filter="url(#aiRecommendationGlow)"
            style={{ pointerEvents: 'none' }}
          />
        </>
      )}
      {(hovered || isSelected) && (
        <>
          <rect
            x={(x1 - 0.45).toFixed(3)} y={(y1 - 0.45).toFixed(3)}
            width={(dw + 0.9).toFixed(3)} height={(dh + 0.9).toFixed(3)}
            rx={(Math.min(dw, dh) * 0.22).toFixed(3)}
            fill="none"
            stroke={HOVER_STROKE[status]}
            strokeWidth={0.55}
            opacity={0.78}
            filter="url(#spaceLift)"
          />
          <circle
            cx={(mx + off.dx).toFixed(3)}
            cy={(my + off.dy).toFixed(3)}
            r={(seatR + 0.42).toFixed(3)}
            fill="none"
            stroke={HOVER_STROKE[status]}
            strokeWidth={0.55}
            opacity={0.78}
            filter="url(#spaceLift)"
          />
        </>
      )}
      <rect
        x={x1.toFixed(3)} y={y1.toFixed(3)}
        width={dw.toFixed(3)} height={dh.toFixed(3)}
        rx={(Math.min(dw, dh) * 0.15).toFixed(3)}
        fill={fill}
        stroke={hovered ? HOVER_STROKE[status] : stroke}
        strokeWidth={hovered || isSelected ? strokeW + 0.24 : strokeW}
        style={{ transition: 'fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease' }}
      />
      <circle
        cx={(mx + off.dx).toFixed(3)}
        cy={(my + off.dy).toFixed(3)}
        r={seatR.toFixed(3)}
        fill={fill}
        stroke={hovered ? HOVER_STROKE[status] : stroke}
        strokeWidth={hovered || isSelected ? strokeW + 0.24 : strokeW}
        style={{ transition: 'fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease' }}
      />
      {aiRecommendation && status === 'available' && !hovered && !isSelected && (
        <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <circle cx={(mx + 4.9).toFixed(3)} cy={(sparkleY - 0.05).toFixed(3)} r="1.05" fill="#ffcf52" filter="url(#aiRecommendationGlow)">
            <animate attributeName="opacity" values="0.45;1;0.45" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="r" values="0.8;1.3;0.8" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </g>
  )
}

export function FloorPlanViewer({
  imageUrl,
  floorName,
  spaces,
  availableIds,
  selectedId,
  hasSearched,
  occupancyBySpace,
  aiRecommendedSpaces,
  onClickSpace,
  onClickUnavailableSpace,
}: FloorPlanViewerProps) {
  const [vbW, setVbW] = useState(177.78)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth && img.naturalHeight) {
      setVbW((img.naturalWidth / img.naturalHeight) * 100)
    }
  }, [])

  const { areas, desks, visuals } = useMemo(() => ({
    areas: spaces.filter((s) => !s.visual_only && s.layout_type !== 'desk'),
    desks: spaces.filter((s) => !s.visual_only && s.layout_type === 'desk'),
    visuals: spaces.filter((s) => s.visual_only),
  }), [spaces])
  const spaceSignature = useMemo(() => spaces.map((space) => space.id).join('|'), [spaces])
  const spacesById = useMemo(() => new Map(spaces.map((space) => [space.id, space])), [spaces])
  const hoveredSpace = hoveredId !== null ? spacesById.get(hoveredId) ?? null : null
  const hoveredIntervals = hoveredId !== null ? occupancyBySpace.get(hoveredId) ?? [] : []
  const hoveredRecommendation = hoveredId !== null ? aiRecommendedSpaces.get(hoveredId) ?? null : null
  const hoverAnchor = hoveredSpace ? getSpaceAnchor(hoveredSpace, vbW) : null
  const popupLeft = hoverAnchor ? `${(hoverAnchor.x / vbW) * 100}%` : '0%'
  const popupTop = hoverAnchor ? `${hoverAnchor.y}%` : '0%'
  const popupPositionClass = hoverAnchor && hoverAnchor.x > vbW * 0.62
    ? styles.mapPopupLeft
    : styles.mapPopupRight
  const popupVerticalClass = hoverAnchor && hoverAnchor.y > 58
    ? styles.mapPopupAbove
    : styles.mapPopupBelow

  useEffect(() => {
    setHoveredId(null)
  }, [hasSearched, selectedId, spaceSignature])

  function handleShapeClick(space: SpaceWithLayout, status: SpaceStatus) {
    setHoveredId(null)

    if (status === 'unavailable') {
      onClickUnavailableSpace(space.id)
      return
    }

    if (status === 'available' || status === 'selected') {
      onClickSpace(space.id)
    }
  }

  return (
    <div
      className={styles.container}
      onPointerLeave={() => setHoveredId(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHoveredId(null)
        }
      }}
    >
      <img
        src={imageUrl}
        alt="Plano del piso"
        className={styles.floorImage}
        onLoad={handleImgLoad}
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${vbW.toFixed(3)} 100`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.overlay}
        aria-label="Mapa interactivo de espacios"
      >
        <defs>
          <filter id="spaceLift" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0.55" stdDeviation="0.65" floodColor="#18151f" floodOpacity="0.28" />
          </filter>
          <filter id="occupantAvatarLift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.52" floodColor="#18151f" floodOpacity="0.32" />
          </filter>
          <filter id="aiRecommendationGlow" x="-35%" y="-35%" width="170%" height="170%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.05" floodColor="#ffb000" floodOpacity="0.72" />
            <feDropShadow dx="0" dy="0.65" stdDeviation="0.45" floodColor="#7a5800" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* Visual-only background shapes */}
        {visuals.map((space) => {
          if (!space.layout_points || space.layout_points.length < 2) return null
          const pts = space.layout_points
            .map((p) => `${(p.x * vbW).toFixed(3)},${(p.y * 100).toFixed(3)}`)
            .join(' ')
          return (
            <polygon
              key={space.id}
              points={pts}
              fill="var(--floor-visual-fill)"
              stroke="var(--floor-visual-stroke)"
              strokeWidth={0.15}
            />
          )
        })}

        {/* Areas (polygons) — rendered first, behind desks */}
        {areas.map((space) => {
          const status = getStatus(space, availableIds, selectedId, hasSearched)
          return (
            <AreaShape
              key={space.id}
              space={space}
              vbW={vbW}
              status={status}
              hovered={hoveredId === space.id}
              onClick={() => handleShapeClick(space, status)}
              aiRecommendation={hasSearched ? aiRecommendedSpaces.get(space.id) ?? null : null}
              onMouseEnter={() => setHoveredId(space.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          )
        })}

        {/* Desks — on top of areas */}
        {desks.map((space) => {
          const status = getStatus(space, availableIds, selectedId, hasSearched)
          return (
            <DeskShape
              key={space.id}
              space={space}
              vbW={vbW}
              status={status}
              hovered={hoveredId === space.id}
              onClick={() => handleShapeClick(space, status)}
              aiRecommendation={hasSearched ? aiRecommendedSpaces.get(space.id) ?? null : null}
              onMouseEnter={() => setHoveredId(space.id)}
              onMouseLeave={() => setHoveredId(null)}
            />
          )
        })}

        {spaces.map((space) => {
          if (space.visual_only) return null
          const intervals = occupancyBySpace.get(space.id) ?? []
          return (
            <OccupantMarker
              key={`occupant-${space.id}`}
              space={space}
              vbW={vbW}
              intervals={intervals}
            />
          )
        })}

      </svg>

      {hoveredSpace && hoverAnchor && (
        <div
          className={`${styles.mapPopup} ${popupPositionClass} ${popupVerticalClass}`}
          style={{ left: popupLeft, top: popupTop }}
        >
          <div className={styles.popupHeader}>
            <strong>{getSpaceDisplayName(hoveredSpace)}</strong>
            <span>{floorName}</span>
          </div>
          {hoveredRecommendation && (
            <div className={styles.popupRecommendation}>
              <span className={styles.popupRecommendationMark} aria-hidden="true" />
              <p>{hoveredRecommendation.reason}</p>
            </div>
          )}
          {hoveredIntervals.length > 0 ? (
            <div className={styles.popupOccupants}>
              {hoveredIntervals.slice(0, 3).map((interval) => (
                <div key={`${interval.user.id}-${interval.start_time}-${interval.end_time}`} className={styles.popupOccupant}>
                  <span className={styles.popupAvatar}>
                    {interval.user.profile_photo_url ? (
                      <img src={interval.user.profile_photo_url} alt="" />
                    ) : (
                      getInitials(interval.user.first_name, interval.user.last_name)
                    )}
                  </span>
                  <span>
                    <b>{interval.user.first_name} {interval.user.last_name}</b>
                    <small>{interval.start_time} - {interval.end_time}</small>
                  </span>
                </div>
              ))}
              {hoveredIntervals.length > 3 && <em>+{hoveredIntervals.length - 3} horarios más</em>}
            </div>
          ) : (
            <p className={styles.popupEmpty}>Sin ocupación registrada para este día.</p>
          )}
        </div>
      )}
    </div>
  )
}
