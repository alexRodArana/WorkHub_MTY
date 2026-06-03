import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Cell, Row, Worksheet } from 'exceljs'
import AppShell from '../Layout/AppShell'
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner'
import { fetchAdminOverview, fetchAuditLogs, searchUsers } from '../../services/reservationService'
import { getSession } from '../../services/tokenStore'
import { useReservationRealtime } from '../../hooks/useReservationRealtime'
import type { AdminKpiOverview, AdminReservationDetail, AuditLogEntry, UserSearchResult } from '../../types/reservation'
import { PRIORITY_CATEGORY_LABELS } from '../../data/floorLayouts'
import styles from './AdminPage.module.css'

const STATUS_LABELS: Record<AdminKpiOverview['status_breakdown'][number]['status'], string> = {
  confirmada: 'Confirmadas',
  activa: 'En uso',
  finalizada: 'Finalizadas',
  cancelada: 'Canceladas',
  no_show: 'No show',
}

const STATUS_EXPORT_LABELS: Record<AdminReservationDetail['status'], string> = {
  confirmada: 'Confirmada',
  activa: 'En uso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  no_show: 'No presentó',
}

const RESERVATION_TYPE_LABELS: Record<AdminKpiOverview['reservation_type_breakdown'][number]['type'], string> = {
  desk_only: 'Solo escritorio',
  desk_parking: 'Escritorio + estacionamiento',
  parking_only: 'Solo estacionamiento',
}

type ReportCell = string | number
type ReportRow = ReportCell[]

type DetailKey =
  | `kpi:${string}`
  | 'panel:health'
  | 'panel:status'
  | 'panel:floors'
  | 'panel:categories'
  | 'panel:types'
  | 'panel:risk'
  | 'panel:hours'
  | 'panel:users'

type AdminPeriodMode = 'day' | 'week' | 'month' | 'range'

interface AdminPeriodRange {
  date_from: string
  date_to: string
  label: string
}

const PERIOD_OPTIONS: Array<{ value: AdminPeriodMode; label: string }> = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'range', label: 'Rango' },
]

function today(): string {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function safeBarWidth(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`
}

function formatMinutes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Sin datos'
  if (value < 60) return `${Math.round(value)} min`
  const hours = Math.floor(value / 60)
  const minutes = Math.round(value % 60)
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
}

function formatReportDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatPeriodLabel(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return formatReportDate(dateFrom)
  return `${formatReportDate(dateFrom)} - ${formatReportDate(dateTo)}`
}

function getAdminPeriodRange(mode: AdminPeriodMode, anchorDate: string, rangeStart: string, rangeEnd: string): AdminPeriodRange {
  if (mode === 'week') {
    const baseDate = parseIsoDate(anchorDate)
    const mondayOffset = (baseDate.getDay() + 6) % 7
    const start = toIsoDate(addDays(baseDate, -mondayOffset))
    const end = toIsoDate(addDays(parseIsoDate(start), 6))
    return { date_from: start, date_to: end, label: `Semana: ${formatPeriodLabel(start, end)}` }
  }

  if (mode === 'month') {
    const [year, month] = anchorDate.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = toIsoDate(new Date(year, month, 0))
    return { date_from: start, date_to: end, label: `Mes: ${formatPeriodLabel(start, end)}` }
  }

  if (mode === 'range') {
    const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd
    const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart
    return { date_from: start, date_to: end, label: `Rango: ${formatPeriodLabel(start, end)}` }
  }

  return { date_from: anchorDate, date_to: anchorDate, label: `Día: ${formatReportDate(anchorDate)}` }
}

function formatGeneratedAt(): string {
  return new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeLabel(value: string): string {
  return value.slice(0, 5)
}

function getReservationUserName(reservation: AdminReservationDetail): string {
  return `${reservation.first_name} ${reservation.last_name}`.trim()
}

function getReservationSpaceLabel(reservation: AdminReservationDetail): string {
  if (reservation.type === 'parking_only') return 'No aplica'
  return reservation.display_name || reservation.space_number || 'Sin espacio'
}

function getReservationFloorLabel(reservation: AdminReservationDetail): string {
  if (reservation.type === 'parking_only') return 'No aplica'
  return reservation.floor_name || 'Sin piso'
}

function getReservationParkingLabel(reservation: AdminReservationDetail): string {
  return [reservation.parking_zone_name, reservation.parking_spot_number].filter(Boolean).join(' - ') || 'Sin estacionamiento'
}

function getReservationVehicleLabel(reservation: AdminReservationDetail): string {
  return [reservation.vehicle_label, reservation.vehicle_plate].filter(Boolean).join(' - ') || 'Sin vehículo'
}

const REPORT_COLUMN_COUNT = 13

const REPORT_COLORS = {
  primary: 'FF7500C0',
  primaryDark: 'FF520083',
  primarySoft: 'FFF4EAFF',
  text: 'FF18151F',
  muted: 'FF5C5268',
  border: 'FFE8DEF8',
  white: 'FFFFFFFF',
  success: 'FFE8F8F3',
  warning: 'FFFFF4D8',
}

function setThinBorder(cell: Cell): void {
  cell.border = {
    top: { style: 'thin', color: { argb: REPORT_COLORS.border } },
    left: { style: 'thin', color: { argb: REPORT_COLORS.border } },
    bottom: { style: 'thin', color: { argb: REPORT_COLORS.border } },
    right: { style: 'thin', color: { argb: REPORT_COLORS.border } },
  }
}

function styleMergedRow(row: Row, fillArgb: string, fontColor: string): void {
  row.height = 24
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillArgb },
    }
    cell.font = { bold: true, color: { argb: fontColor } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    setThinBorder(cell)
  })
}

function addMergedTitleRow(sheet: Worksheet, title: string, fillArgb = REPORT_COLORS.primary): Row {
  const row = sheet.addRow([title])
  sheet.mergeCells(row.number, 1, row.number, REPORT_COLUMN_COUNT)
  styleMergedRow(row, fillArgb, REPORT_COLORS.white)
  return row
}

function addReportTable(sheet: Worksheet, title: string, headers: ReportRow, rows: ReportRow[]): void {
  addMergedTitleRow(sheet, title, REPORT_COLORS.primaryDark)

  const headerRow = sheet.addRow(headers)
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: REPORT_COLORS.primarySoft },
    }
    cell.font = { bold: true, color: { argb: REPORT_COLORS.primaryDark } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    setThinBorder(cell)
  })

  rows.forEach((values) => {
    const dataRow = sheet.addRow(values)
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { color: { argb: REPORT_COLORS.text } }
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
      setThinBorder(cell)
    })
  })

  sheet.addRow([])
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function reservationMatchesKey(reservation: AdminReservationDetail, key: DetailKey): boolean {
  if (key === 'panel:status' || key === 'panel:types' || key === 'panel:hours' || key === 'panel:users') return true
  if (key === 'panel:health') return reservation.status === 'confirmada' || reservation.status === 'activa'
  if (!key.startsWith('kpi:')) return true
  const kpi = key.slice(4)
  if (kpi === 'active') return reservation.status === 'activa'
  if (kpi === 'confirmed') return reservation.status === 'confirmada'
  if (kpi === 'parking') return reservation.parking_spot_number !== null
  if (kpi === 'central-parking') return reservation.parking_zone_name === 'Central'
  if (kpi === 'vehicles') return reservation.vehicle_id !== null
  if (kpi === 'parking-only') return reservation.type === 'parking_only'
  if (kpi === 'desk-parking') return reservation.type === 'desk_parking'
  if (kpi === 'desk-only') return reservation.type === 'desk_only'
  if (kpi === 'cancel') return reservation.status === 'cancelada'
  if (kpi === 'no-show') return reservation.status === 'no_show'
  if (kpi === 'occupancy') return reservation.space_id !== null && (reservation.status === 'confirmada' || reservation.status === 'activa')
  return true
}

export function AdminPage(): JSX.Element {
  const navigate = useNavigate()
  const [date, setDate] = useState(today)
  const [periodMode, setPeriodMode] = useState<AdminPeriodMode>('day')
  const [rangeStart, setRangeStart] = useState(today)
  const [rangeEnd, setRangeEnd] = useState(today)
  const [overview, setOverview] = useState<AdminKpiOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<DetailKey | null>(null)
  const [detailQuery, setDetailQuery] = useState('')
  const [detailStatus, setDetailStatus] = useState('all')
  const [detailType, setDetailType] = useState('all')
  const [detailFloor, setDetailFloor] = useState('all')
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [auditQuery, setAuditQuery] = useState('')
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])

  const token = getSession()?.access_token
  const periodRange = useMemo(
    () => getAdminPeriodRange(periodMode, date, rangeStart, rangeEnd),
    [date, periodMode, rangeEnd, rangeStart]
  )

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setLoading(true)
    setError(null)
    fetchAdminOverview(token, periodRange).then((overviewResult) => {
      setLoading(false)
      if (!overviewResult.success) {
        if (overviewResult.unauthorized) navigate('/login', { replace: true })
        else setError(overviewResult.error === 'FORBIDDEN' ? 'No tienes permisos de administrador.' : 'No se pudieron cargar los KPIs.')
        return
      }
      setOverview(overviewResult.data)
    })
  }, [navigate, periodRange, token])

  useEffect(() => {
    if (!error) return
    const id = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(id)
  }, [error])

  useEffect(() => {
    if (!expandedKey) return
    setDetailQuery('')
    setDetailStatus('all')
    setDetailType('all')
    setDetailFloor('all')
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setExpandedKey(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [expandedKey])

  useEffect(() => {
    if (!token || userQuery.trim().length < 2) {
      setUserResults([])
      return
    }
    let cancelled = false
    const id = window.setTimeout(() => {
      searchUsers(token, userQuery).then((result) => {
        if (cancelled) return
        if (result.success) setUserResults(result.data)
        else if (result.unauthorized) navigate('/login', { replace: true })
      })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [navigate, token, userQuery])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const id = window.setTimeout(() => {
      fetchAuditLogs(token, auditQuery).then((result) => {
        if (cancelled) return
        if (result.success) setAuditLogs(result.data)
      })
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [auditQuery, token])

  const statusTotal = useMemo(() => (
    overview?.status_breakdown.reduce((sum, item) => sum + item.count, 0) ?? 0
  ), [overview])

  const hourlyMax = useMemo(() => (
    Math.max(1, ...(overview?.hourly_distribution.map((item) => item.reservations) ?? [0]))
  ), [overview])

  const peakHour = useMemo(() => {
    if (!overview || overview.hourly_distribution.length === 0) return null
    return overview.hourly_distribution.reduce((peak, item) => (
      item.reservations > peak.reservations ? item : peak
    ), overview.hourly_distribution[0])
  }, [overview])

  const busiestFloor = useMemo(() => {
    if (!overview || overview.by_floor.length === 0) return null
    return overview.by_floor.reduce((peak, item) => (
      item.occupancy_rate > peak.occupancy_rate ? item : peak
    ), overview.by_floor[0])
  }, [overview])

  const topCategory = useMemo(() => {
    if (!overview || overview.by_category.length === 0) return null
    return overview.by_category.reduce((peak, item) => (
      item.occupancy_rate > peak.occupancy_rate ? item : peak
    ), overview.by_category[0])
  }, [overview])

  const reservationTypeTotal = useMemo(() => (
    overview?.reservation_type_breakdown.reduce((sum, item) => sum + item.count, 0) ?? 0
  ), [overview])

  const kpis = useMemo(() => {
    if (!overview) return []
    return [
      {
        key: 'total',
        label: 'Reservas del periodo',
        value: overview.total_reservations.toString(),
        detail: `${overview.confirmed_reservations} confirmadas · ${overview.active_reservations} en uso · ${overview.finalized_reservations} finalizadas`,
        description: 'Mide la demanda total operativa para el periodo seleccionado.',
      },
      {
        key: 'occupancy',
        label: 'Ocupación',
        value: percent(overview.occupancy_rate),
        detail: `${overview.occupied_spaces}/${overview.total_spaces} espacios ocupados`,
        description: 'Relación entre espacios ocupados y espacios disponibles en el inventario activo.',
      },
      {
        key: 'available',
        label: 'Disponibles',
        value: overview.available_spaces.toString(),
        detail: `${overview.blocked_space_count} bloqueos por horario`,
        description: 'Espacios libres después de considerar reservas y bloqueos vigentes.',
      },
      {
        key: 'active',
        label: 'En uso ahora',
        value: overview.active_reservations.toString(),
        detail: `${percent(overview.check_in_rate)} de check-in`,
        description: 'Reservas activas que ya tienen check-in registrado.',
      },
      {
        key: 'finalized',
        label: 'Check-outs',
        value: overview.finalized_reservations.toString(),
        detail: 'Reservas liberadas antes de terminar',
        description: 'Espacios que fueron usados y liberados mediante check-out anticipado.',
      },
      {
        key: 'parking',
        label: 'Estacionamiento',
        value: percent(overview.parking_rate),
        detail: `${overview.parking_reservations} cajones reservados`,
        description: 'Porcentaje de reservas del periodo que usan estacionamiento.',
      },
      {
        key: 'central-parking',
        label: 'Central',
        value: overview.reservations_detail.filter((item) => item.parking_zone_name === 'Central').length.toString(),
        detail: 'Reservas con flujo especial de acceso',
        description: 'Reservas asignadas a Central que requieren aviso previo con guardias de T1 o T2.',
      },
      {
        key: 'vehicles',
        label: 'Vehículos',
        value: new Set(overview.reservations_detail.filter((item) => item.vehicle_id !== null).map((item) => item.vehicle_id)).size.toString(),
        detail: 'Vehículos únicos en reservas',
        description: 'Vehículos registrados y asociados a reservas de estacionamiento del periodo.',
      },
      {
        key: 'parking-only',
        label: 'Solo parking',
        value: overview.parking_only_reservations.toString(),
        detail: 'Reservas sin escritorio asociado',
        description: 'Casos donde el usuario solo necesitó un cajón de estacionamiento.',
      },
      {
        key: 'desk-parking',
        label: 'Desk + parking',
        value: overview.desk_parking_reservations.toString(),
        detail: 'Reservas combinadas',
        description: 'Usuarios que reservaron escritorio y estacionamiento en el mismo flujo.',
      },
      {
        key: 'desk-only',
        label: 'Solo escritorio',
        value: overview.desk_only_reservations.toString(),
        detail: `${overview.workspace_reservations} reservas con escritorio`,
        description: 'Reservas de escritorio que no requieren estacionamiento.',
      },
      {
        key: 'duration',
        label: 'Duración media',
        value: formatMinutes(overview.average_duration_minutes),
        detail: 'Promedio de las reservas del periodo',
        description: 'Ayuda a detectar uso parcial, jornadas completas y ventanas de alta rotación.',
      },
      {
        key: 'users',
        label: 'Usuarios únicos',
        value: overview.unique_users.toString(),
        detail: 'Personas con reserva',
        description: 'Cantidad de colaboradores distintos con actividad en la fecha.',
      },
      {
        key: 'confirmed',
        label: 'Pendientes',
        value: overview.confirmed_reservations.toString(),
        detail: 'Reservas confirmadas sin check-in',
        description: 'Reservas que todavía no pasan a estado activo.',
      },
      {
        key: 'peak-hour',
        label: 'Pico de demanda',
        value: peakHour?.hour ?? '--',
        detail: peakHour ? `${peakHour.reservations} reservas` : 'Sin datos suficientes',
        description: 'Horario con mayor concentración de reservas confirmadas o activas.',
      },
      {
        key: 'busiest-floor',
        label: 'Piso más activo',
        value: busiestFloor?.floor_name ?? '--',
        detail: busiestFloor ? percent(busiestFloor.occupancy_rate) : 'Sin datos suficientes',
        description: 'Piso con mayor ocupación relativa en el periodo seleccionado.',
      },
      {
        key: 'blocked',
        label: 'Bloqueos',
        value: overview.blocked_space_count.toString(),
        detail: `${overview.blocked_area_count} áreas bloqueadas`,
        description: 'Espacios y áreas no disponibles por mantenimiento, eventos u operación.',
      },
      {
        key: 'cancel',
        label: 'Cancelaciones',
        value: percent(overview.cancellation_rate),
        detail: `${overview.cancelled_reservations} reservas canceladas`,
        description: 'Indicador de cambios de último momento que afectan capacidad y planeación.',
      },
      {
        key: 'no-show',
        label: 'No show',
        value: percent(overview.no_show_rate),
        detail: `${overview.no_show_reservations} reservas vencidas`,
        description: 'Reservas que no se usaron y pueden indicar fricción o sobre-reserva.',
      },
      {
        key: 'top-category',
        label: 'Tipo más usado',
        value: topCategory ? (PRIORITY_CATEGORY_LABELS[topCategory.priority_category] ?? topCategory.priority_category) : '--',
        detail: topCategory ? percent(topCategory.occupancy_rate) : 'Sin datos suficientes',
        description: 'Categoría de espacio con mayor presión de ocupación.',
      },
    ]
  }, [busiestFloor, overview, peakHour, topCategory])

  const selectedKpi = expandedKey?.startsWith('kpi:')
    ? kpis.find((item) => item.key === expandedKey.slice(4))
    : undefined

  function openPanel(key: DetailKey) {
    setExpandedKey(key)
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLElement>, key: DetailKey) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openPanel(key)
  }

  const detailRows = useMemo(() => {
    if (!overview || !expandedKey) return []
    const query = detailQuery.trim().toLowerCase()
    return overview.reservations_detail
      .filter((reservation) => reservationMatchesKey(reservation, expandedKey))
      .filter((reservation) => detailStatus === 'all' || reservation.status === detailStatus)
      .filter((reservation) => detailType === 'all' || reservation.type === detailType)
      .filter((reservation) => detailFloor === 'all' || String(reservation.floor_id ?? 'parking') === detailFloor)
      .filter((reservation) => {
        if (!query) return true
        const haystack = [
          reservation.first_name,
          reservation.last_name,
          reservation.email,
          reservation.department,
          reservation.space_number,
          reservation.display_name,
          reservation.floor_name,
          reservation.parking_zone_name,
          reservation.parking_spot_number,
          reservation.vehicle_plate,
          reservation.vehicle_label,
          reservation.reservation_code,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 120)
  }, [detailFloor, detailQuery, detailStatus, detailType, expandedKey, overview])

  async function exportOverviewXlsx(): Promise<void> {
    if (!overview) return
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'WorkHub MTY'
    workbook.company = 'WorkHub MTY'
    workbook.subject = 'Reporte administrativo de reservas'
    workbook.title = `Reporte WorkHub MTY ${periodRange.label}`
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Reporte administrativo', {
      views: [{ state: 'frozen', ySplit: 5 }],
      properties: { defaultRowHeight: 22 },
    })

    sheet.columns = [
      { key: 'a', width: 22 },
      { key: 'b', width: 20 },
      { key: 'c', width: 24 },
      { key: 'd', width: 28 },
      { key: 'e', width: 22 },
      { key: 'f', width: 26 },
      { key: 'g', width: 22 },
      { key: 'h', width: 18 },
      { key: 'i', width: 26 },
      { key: 'j', width: 28 },
      { key: 'k', width: 18 },
      { key: 'l', width: 16 },
      { key: 'm', width: 16 },
    ]

    const titleRow = addMergedTitleRow(sheet, 'Reporte WorkHub MTY - Dashboard administrativo')
    titleRow.height = 30
    titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: REPORT_COLORS.white } }

    const metadataRows: ReportRow[] = [
      ['Periodo analizado', periodRange.label],
      ['Desde', formatReportDate(periodRange.date_from)],
      ['Hasta', formatReportDate(periodRange.date_to)],
      ['Generado el', formatGeneratedAt()],
    ]
    metadataRows.forEach((values) => {
      const row = sheet.addRow(values)
      row.getCell(1).font = { bold: true, color: { argb: REPORT_COLORS.primaryDark } }
      row.getCell(2).font = { color: { argb: REPORT_COLORS.text } }
      row.eachCell({ includeEmpty: true }, setThinBorder)
    })
    sheet.addRow([])

    addReportTable(sheet, 'Resumen ejecutivo', ['Indicador', 'Valor', 'Descripción'], [
      ['Reservas totales', overview.total_reservations, 'Reservas registradas para el periodo seleccionado'],
      ['Reservas confirmadas', overview.confirmed_reservations, 'Reservas pendientes de uso o check-in'],
      ['Reservas en uso', overview.active_reservations, 'Reservas con check-in realizado'],
      ['Reservas finalizadas', overview.finalized_reservations, 'Reservas concluidas'],
      ['Reservas canceladas', overview.cancelled_reservations, 'Reservas canceladas por usuarios o administración'],
      ['No presentó', overview.no_show_reservations, 'Reservas marcadas como no show'],
      ['Usuarios únicos', overview.unique_users, 'Personas distintas con reserva'],
      ['Espacios ocupados', `${overview.occupied_spaces} de ${overview.total_spaces}`, 'Espacios con ocupación en el periodo'],
      ['Ocupación general', percent(overview.occupancy_rate), 'Porcentaje de espacios ocupados'],
      ['Uso de estacionamiento', percent(overview.parking_rate), 'Porcentaje de reservas con estacionamiento'],
      ['Tasa de check-in', percent(overview.check_in_rate), 'Proporción de reservas usadas correctamente'],
      ['Tasa de cancelación', percent(overview.cancellation_rate), 'Proporción de reservas canceladas'],
      ['Tasa de no show', percent(overview.no_show_rate), 'Proporción de reservas donde el usuario no se presentó'],
      ['Duración promedio', formatMinutes(overview.average_duration_minutes), 'Duración promedio de las reservas'],
      ['Áreas bloqueadas', overview.blocked_area_count, 'Áreas completas no disponibles'],
      ['Espacios bloqueados', overview.blocked_space_count, 'Espacios individuales no disponibles'],
    ])

    addReportTable(sheet, 'Distribución por estado', ['Estado', 'Cantidad'], overview.status_breakdown.map((item) => [
      STATUS_EXPORT_LABELS[item.status],
      item.count,
    ]))

    addReportTable(sheet, 'Distribución por tipo de reserva', ['Tipo de reserva', 'Cantidad'], overview.reservation_type_breakdown.map((item) => [
      RESERVATION_TYPE_LABELS[item.type],
      item.count,
    ]))

    addReportTable(sheet, 'Ocupación por piso', ['Piso', 'Espacios totales', 'Espacios ocupados', 'Ocupación'], overview.by_floor.map((floor) => [
      floor.floor_name,
      floor.total_spaces,
      floor.occupied_spaces,
      percent(floor.occupancy_rate),
    ]))

    addReportTable(sheet, 'Ocupación por categoría', ['Categoría', 'Espacios totales', 'Espacios ocupados', 'Ocupación'], overview.by_category.map((category) => [
      PRIORITY_CATEGORY_LABELS[category.priority_category] ?? category.priority_category,
      category.total_spaces,
      category.occupied_spaces,
      percent(category.occupancy_rate),
    ]))

    addReportTable(sheet, 'Demanda por hora', ['Hora', 'Reservas'], overview.hourly_distribution.map((item) => [
      formatTimeLabel(item.hour),
      item.reservations,
    ]))

    addReportTable(sheet, 'Usuarios con más reservas', ['Usuario', 'Correo', 'Reservas'], overview.top_users.map((user) => [
      `${user.first_name} ${user.last_name}`.trim(),
      user.email,
      user.reservations,
    ]))

    addReportTable(sheet, 'Espacios más reservados', ['Espacio', 'Piso', 'Reservas'], overview.top_spaces.map((space) => [
      space.display_name || space.space_number,
      space.floor_name,
      space.reservations,
    ]))

    addReportTable(sheet, 'Espacios con menor uso', ['Espacio', 'Piso', 'Reservas', 'Última reserva'], overview.underused_spaces.map((space) => [
      space.display_name || space.space_number,
      space.floor_name,
      space.reservations,
      space.last_reservation_date ? formatReportDate(space.last_reservation_date) : 'Sin registro',
    ]))

    addReportTable(sheet, 'Bloqueos de espacios', ['Espacio', 'Piso', 'Horario', 'Motivo', 'Estado'], overview.blocked_spaces.map((block) => [
      block.space_number,
      block.floor_name,
      `${formatTimeLabel(block.start_time)} - ${formatTimeLabel(block.end_time)}`,
      block.reason || 'Sin motivo registrado',
      block.is_active ? 'Activo' : 'Inactivo',
    ]))

    addReportTable(sheet, 'Detalle de reservas', [
      'Código de reserva',
      'Fecha',
      'Usuario',
      'Correo',
      'Departamento',
      'Tipo de reserva',
      'Espacio',
      'Piso',
      'Estacionamiento',
      'Vehículo',
      'Estado',
      'Hora de inicio',
      'Hora de fin',
    ], overview.reservations_detail.map((reservation) => [
      reservation.reservation_code,
      formatReportDate(reservation.reservation_date),
      getReservationUserName(reservation),
      reservation.email,
      reservation.department || 'Sin departamento',
      RESERVATION_TYPE_LABELS[reservation.type],
      getReservationSpaceLabel(reservation),
      getReservationFloorLabel(reservation),
      getReservationParkingLabel(reservation),
      getReservationVehicleLabel(reservation),
      STATUS_EXPORT_LABELS[reservation.status],
      formatTimeLabel(reservation.start_time),
      formatTimeLabel(reservation.end_time),
    ]))

    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { ...cell.alignment, vertical: cell.alignment?.vertical ?? 'middle' }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `workhub-reporte-administrativo-${periodRange.date_from}-${periodRange.date_to}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  function renderReservationTable(rows: AdminReservationDetail[]): JSX.Element {
    return (
      <div className={styles.detailTableWrap}>
        <div className={styles.detailFilters}>
          <input
            value={detailQuery}
            onChange={(event) => setDetailQuery(event.target.value)}
            placeholder="Buscar usuario, espacio, vehículo, código..."
          />
          <select value={detailStatus} onChange={(event) => setDetailStatus(event.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="confirmada">Confirmadas</option>
            <option value="activa">Activas</option>
            <option value="finalizada">Finalizadas</option>
            <option value="cancelada">Canceladas</option>
            <option value="no_show">No show</option>
          </select>
          <select value={detailType} onChange={(event) => setDetailType(event.target.value)}>
            <option value="all">Todos los tipos</option>
            <option value="desk_only">Solo escritorio</option>
            <option value="desk_parking">Escritorio + parking</option>
            <option value="parking_only">Solo parking</option>
          </select>
          <select value={detailFloor} onChange={(event) => setDetailFloor(event.target.value)}>
            <option value="all">Todos los pisos</option>
            <option value="parking">Solo estacionamiento</option>
            {overview?.by_floor.map((floor) => (
              <option key={floor.floor_id} value={String(floor.floor_id)}>
                {floor.floor_name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.detailTable}>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Reserva</th>
                <th>Espacio</th>
                <th>Parking</th>
                <th>Vehículo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}>Sin resultados para estos filtros.</td></tr>
              ) : rows.map((reservation) => (
                <tr key={reservation.reservation_id}>
                  <td>
                    <strong>{reservation.first_name} {reservation.last_name}</strong>
                    <span>{reservation.email}</span>
                  </td>
                  <td>
                    <strong>{reservation.start_time} - {reservation.end_time}</strong>
                    <span>#{reservation.reservation_code}</span>
                  </td>
                  <td>
                    <strong>{reservation.display_name || reservation.space_number}</strong>
                    <span>{reservation.floor_name}</span>
                  </td>
                  <td>
                    <strong>{reservation.parking_zone_name ?? 'Sin parking'}</strong>
                    <span>{reservation.parking_spot_number ?? '—'}</span>
                  </td>
                  <td>
                    <strong>{reservation.vehicle_plate ?? '—'}</strong>
                    <span>{reservation.vehicle_label ?? 'Sin vehículo'}</span>
                  </td>
                  <td><span className={styles.statusBadge}>{STATUS_LABELS[reservation.status] ?? reservation.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  async function refresh() {
    if (!token) return
    const result = await fetchAdminOverview(token, periodRange)
    if (result.success) setOverview(result.data)
  }

  useReservationRealtime((event) => {
    const isAreaEvent = event.type.startsWith('area_block.')
    const eventDate = event.reservation_date
    if (isAreaEvent || !eventDate || (eventDate >= periodRange.date_from && eventDate <= periodRange.date_to)) {
      void refresh()
    }
  }, Boolean(token))

  function renderExpandedDetail(): JSX.Element | null {
    if (!overview || !expandedKey) return null

    if (selectedKpi) {
      return (
        <>
          <p>{selectedKpi.description}</p>
          <div className={styles.detailHero}>
            <span>{selectedKpi.label}</span>
            <strong>{selectedKpi.value}</strong>
            <small>{selectedKpi.detail}</small>
          </div>
          <div className={styles.detailMetricGrid}>
            <div><span>Periodo</span><strong>{periodRange.label}</strong></div>
            <div><span>Reservas activas</span><strong>{overview.active_reservations}</strong></div>
            <div><span>Ocupación</span><strong>{percent(overview.occupancy_rate)}</strong></div>
            <div><span>Estacionamiento</span><strong>{overview.parking_reservations}</strong></div>
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:health') {
      return (
        <>
          <p>Lectura combinada de capacidad, estacionamiento y presión de demanda para el periodo seleccionado.</p>
          <div className={styles.detailMetricGrid}>
            <div><span>Espacios totales</span><strong>{overview.total_spaces}</strong></div>
            <div><span>Ocupados</span><strong>{overview.occupied_spaces}</strong></div>
            <div><span>Disponibles</span><strong>{overview.available_spaces}</strong></div>
            <div><span>Bloqueados</span><strong>{overview.blocked_space_count}</strong></div>
            <div><span>Uso parking</span><strong>{percent(overview.parking_rate)}</strong></div>
            <div><span>Duración promedio</span><strong>{formatMinutes(overview.average_duration_minutes)}</strong></div>
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:status') {
      return (
        <>
          <p>Distribución del ciclo de vida de las reservas para detectar carga actual, cancelaciones y no-shows.</p>
          <div className={styles.detailList}>
            {overview.status_breakdown.map((item) => (
              <div key={item.status}>
                <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:floors') {
      return (
        <>
          <p>Comparativo de ocupación por piso, útil para balancear demanda y decidir bloqueos operativos.</p>
          <div className={styles.detailList}>
            {overview.by_floor.map((floor) => (
              <div key={floor.floor_id}>
                <span>{floor.floor_name}</span>
                <strong>{floor.occupied_spaces}/{floor.total_spaces} · {percent(floor.occupancy_rate)}</strong>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:categories') {
      return (
        <>
          <p>Ocupación por categoría de espacio para identificar qué tipo de recurso está bajo mayor presión.</p>
          <div className={styles.detailList}>
            {overview.by_category.map((category) => (
              <div key={category.priority_category}>
                <span>{PRIORITY_CATEGORY_LABELS[category.priority_category] ?? category.priority_category}</span>
                <strong>{category.occupied_spaces}/{category.total_spaces} · {percent(category.occupancy_rate)}</strong>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:types') {
      return (
        <>
          <p>Mezcla de uso entre escritorio, estacionamiento y reservas combinadas.</p>
          <div className={styles.detailList}>
            {overview.reservation_type_breakdown.map((item) => (
              <div key={item.type}>
                <span>{RESERVATION_TYPE_LABELS[item.type]}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:risk') {
      return (
        <>
          <p>Indicadores que ayudan a detectar fricción operativa y posible desperdicio de capacidad.</p>
          <div className={styles.detailMetricGrid}>
            <div><span>Check-in</span><strong>{percent(overview.check_in_rate)}</strong></div>
            <div><span>Cancelación</span><strong>{percent(overview.cancellation_rate)}</strong></div>
            <div><span>No show</span><strong>{percent(overview.no_show_rate)}</strong></div>
            <div><span>Canceladas</span><strong>{overview.cancelled_reservations}</strong></div>
            <div><span>No show</span><strong>{overview.no_show_reservations}</strong></div>
            <div><span>Usuarios únicos</span><strong>{overview.unique_users}</strong></div>
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:hours') {
      return (
        <>
          <p>Concentración de demanda por hora de inicio para anticipar saturación en accesos y áreas comunes.</p>
          <div className={styles.detailList}>
            {overview.hourly_distribution.map((item) => (
              <div key={item.hour}>
                <span>{item.hour}</span>
                <strong>{item.reservations} reservas</strong>
              </div>
            ))}
          </div>
        </>
      )
    }

    if (expandedKey === 'panel:users') {
      return (
        <>
          <p>Usuarios con mayor actividad en el periodo seleccionado.</p>
          <div className={styles.detailList}>
            {overview.top_users.map((user) => (
              <div key={user.user_id}>
                <span>{user.first_name} {user.last_name}</span>
                <strong>{user.reservations} reservas</strong>
              </div>
            ))}
          </div>
        </>
      )
    }

    return null
  }

  function detailTitle(): string {
    if (selectedKpi) return selectedKpi.label
    if (expandedKey?.startsWith('kpi:')) return 'KPI'
    const titles: Record<Exclude<DetailKey, `kpi:${string}`>, string> = {
      'panel:health': 'Salud operativa',
      'panel:status': 'Estado de reservas',
      'panel:floors': 'Ocupación por piso',
      'panel:categories': 'Ocupación por tipo',
      'panel:types': 'Tipo de reserva',
      'panel:risk': 'Riesgo operativo',
      'panel:hours': 'Demanda por hora',
      'panel:users': 'Usuarios con más actividad',
    }
    return expandedKey ? titles[expandedKey as Exclude<DetailKey, `kpi:${string}`>] : 'Detalle'
  }

  return (
    <AppShell title="Dashboard" subtitle="KPIs operativos del workspace">
      <div className={styles.page}>
        <div className={styles.toolbar} data-tour="admin-date-filter">
          <label className={styles.userSearch}>
            <span>Buscar usuario</span>
            <input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Nombre, correo, área..."
            />
          </label>
          <div className={styles.periodControl}>
            <span>Periodo</span>
            <div className={styles.periodTabs} role="group" aria-label="Periodo del dashboard">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={periodMode === option.value ? styles.periodTabActive : undefined}
                  aria-pressed={periodMode === option.value}
                  onClick={() => setPeriodMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {periodMode === 'range' ? (
            <div className={styles.rangeFields}>
              <label>
                <span>Desde</span>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(event) => {
                    if (event.target.value) setRangeStart(event.target.value)
                  }}
                />
              </label>
              <label>
                <span>Hasta</span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(event) => {
                    if (event.target.value) setRangeEnd(event.target.value)
                  }}
                />
              </label>
            </div>
          ) : (
            <label className={styles.periodInput}>
              <span>{periodMode === 'month' ? 'Mes' : periodMode === 'week' ? 'Semana base' : 'Fecha'}</span>
              <input
                type={periodMode === 'month' ? 'month' : 'date'}
                value={periodMode === 'month' ? date.slice(0, 7) : date}
                onChange={(event) => {
                  if (!event.target.value) return
                  setDate(periodMode === 'month' ? `${event.target.value}-01` : event.target.value)
                }}
              />
            </label>
          )}
          <small className={styles.periodSummary}>{periodRange.label}</small>
          <button type="button" className={styles.exportBtn} onClick={() => void exportOverviewXlsx()} disabled={!overview}>
            Exportar XLSX
          </button>
        </div>

        {userResults.length > 0 && (
          <section className={styles.userSearchResults}>
            {userResults.map((user) => (
              <article key={user.id}>
                <span className={styles.searchAvatar}>{initials(user.first_name, user.last_name)}</span>
                <div>
                  <strong>{user.first_name} {user.last_name}</strong>
                  <small>{user.email} · {user.role}</small>
                </div>
                <b>{user.active_reservation_count} activas</b>
                <b>{user.vehicle_count} veh.</b>
              </article>
            ))}
          </section>
        )}

        {error && <div className={styles.errorMsg}>{error}</div>}
        {loading ? (
          <div className={styles.loadingWrap}><LoadingSpinner /></div>
        ) : overview ? (
          <>
            <section className={styles.kpiGrid} data-tour="admin-kpis">
              {kpis.map((kpi) => (
                <button
                  key={kpi.key}
                  type="button"
                  className={styles.kpiCard}
                  onClick={() => openPanel(`kpi:${kpi.key}`)}
                >
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                  <small>{kpi.detail}</small>
                </button>
              ))}
            </section>

            <section className={styles.insightGrid} data-tour="admin-insights">
              <article
                className={`${styles.panel} ${styles.gaugePanel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:health')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:health')}
              >
                <div className={styles.panelHeader}>
                  <h3>Salud operativa</h3>
                  <span>Ver detalle</span>
                </div>
                <div className={styles.gaugeList}>
                  <div className={styles.gaugeItem}>
                    <div
                      className={styles.gaugeRing}
                      style={{ '--value': safeBarWidth(overview.occupancy_rate) } as CSSProperties}
                    >
                      <span>{percent(overview.occupancy_rate)}</span>
                    </div>
                    <div>
                      <strong>Ocupación total</strong>
                      <small>{overview.occupied_spaces} espacios ocupados de {overview.total_spaces}</small>
                    </div>
                  </div>
                  <div className={styles.gaugeItem}>
                    <div
                      className={`${styles.gaugeRing} ${styles.gaugeRingAlt}`}
                      style={{ '--value': safeBarWidth(overview.parking_rate) } as CSSProperties}
                    >
                      <span>{percent(overview.parking_rate)}</span>
                    </div>
                    <div>
                      <strong>Uso de estacionamiento</strong>
                      <small>{overview.parking_reservations} reservas con cajón asignado</small>
                    </div>
                  </div>
                </div>
                <div className={styles.insightStrip}>
                  <span>Pico: {peakHour ? `${peakHour.hour} · ${peakHour.reservations}` : 'sin datos'}</span>
                  <span>Piso más activo: {busiestFloor ? busiestFloor.floor_name : 'sin datos'}</span>
                </div>
              </article>

              <article
                className={`${styles.panel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:status')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:status')}
              >
                <div className={styles.panelHeader}>
                  <h3>Estado de reservas</h3>
                  <span>Ver detalle</span>
                </div>
                <div className={styles.statusList}>
                  {overview.status_breakdown.length === 0 ? (
                    <p className={styles.emptyState}>Sin reservas para este periodo.</p>
                  ) : overview.status_breakdown.map((item) => {
                    const ratio = statusTotal > 0 ? item.count / statusTotal : 0
                    return (
                      <div key={item.status} className={styles.statusRow}>
                        <div className={styles.statusMeta}>
                          <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                          <strong>{item.count}</strong>
                        </div>
                        <div className={styles.statusTrack}>
                          <span className={styles[`status_${item.status}`]} style={{ width: safeBarWidth(ratio) }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            </section>

            <section className={styles.panelGrid} data-tour="admin-charts">
              <article
                className={`${styles.panel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:floors')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:floors')}
              >
                <div className={styles.panelHeader}>
                  <h3>Ocupación por piso</h3>
                  <span>Ver detalle</span>
                </div>
                <div className={styles.barList}>
                  {overview.by_floor.map((floor) => (
                    <div key={floor.floor_id} className={styles.barRow}>
                      <div className={styles.barMeta}>
                        <span>{floor.floor_name}</span>
                        <strong>{percent(floor.occupancy_rate)}</strong>
                      </div>
                      <div className={styles.barTrack}>
                        <span style={{ width: safeBarWidth(floor.occupancy_rate) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article
                className={`${styles.panel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:categories')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:categories')}
              >
                <div className={styles.panelHeader}>
                  <h3>Ocupación por tipo</h3>
                  <span>Ver detalle</span>
                </div>
                <div className={styles.barList}>
                  {overview.by_category.map((category) => (
                    <div key={category.priority_category} className={styles.barRow}>
                      <div className={styles.barMeta}>
                        <span>{PRIORITY_CATEGORY_LABELS[category.priority_category] ?? category.priority_category}</span>
                        <strong>{percent(category.occupancy_rate)}</strong>
                      </div>
                      <div className={styles.barTrack}>
                        <span style={{ width: safeBarWidth(category.occupancy_rate) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className={styles.panelGrid}>
              <article
                className={`${styles.panel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:types')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:types')}
              >
                <div className={styles.panelHeader}>
                  <h3>Tipo de reserva</h3>
                  <span>Ver detalle</span>
                </div>
                <div className={styles.typeList}>
                  {overview.reservation_type_breakdown.map((item) => {
                    const ratio = reservationTypeTotal > 0 ? item.count / reservationTypeTotal : 0
                    return (
                      <div key={item.type} className={styles.typeRow}>
                        <div className={styles.typeMeta}>
                          <span>{RESERVATION_TYPE_LABELS[item.type]}</span>
                          <strong>{item.count}</strong>
                        </div>
                        <div className={styles.typeTrack}>
                          <span style={{ width: safeBarWidth(ratio) }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article
                className={`${styles.panel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:risk')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:risk')}
              >
                <div className={styles.panelHeader}>
                  <h3>Riesgo operativo</h3>
                  <span>Ver detalle</span>
                </div>
                <div className={styles.riskGrid}>
                  <div>
                    <strong>{percent(overview.check_in_rate)}</strong>
                    <span>Check-in</span>
                  </div>
                  <div>
                    <strong>{percent(overview.cancellation_rate)}</strong>
                    <span>Cancelación</span>
                  </div>
                  <div>
                    <strong>{percent(overview.no_show_rate)}</strong>
                    <span>No show</span>
                  </div>
                  <div>
                    <strong>{formatMinutes(overview.average_duration_minutes)}</strong>
                    <span>Duración media</span>
                  </div>
                </div>
              </article>
            </section>

            <section className={styles.panelGrid}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3>Espacios más usados</h3>
                  <span>Periodo</span>
                </div>
                <div className={styles.detailList}>
                  {overview.top_spaces.map((space) => (
                    <div key={space.space_id}>
                      <span>{space.display_name || space.space_number} · {space.floor_name}</span>
                      <strong>{space.reservations} reservas</strong>
                    </div>
                  ))}
                </div>
              </article>
              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <h3>Espacios subutilizados</h3>
                  <span>Periodo</span>
                </div>
                <div className={styles.detailList}>
                  {overview.underused_spaces.map((space) => (
                    <div key={space.space_id}>
                      <span>{space.display_name || space.space_number} · {space.floor_name}</span>
                      <strong>{space.reservations} usos</strong>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className={styles.auditPanel}>
              <div className={styles.panelHeader}>
                <h3>Auditoría reciente</h3>
                <input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Buscar acción, usuario o entidad..." />
              </div>
              <div className={styles.auditList}>
                {auditLogs.length === 0 ? (
                  <p className={styles.emptyState}>Sin eventos de auditoría.</p>
                ) : auditLogs.slice(0, 8).map((log) => (
                  <article key={log.id}>
                    <strong>{log.action}</strong>
                    <span>{log.actor_email ?? 'Sistema'} · {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
                    <small>{new Date(log.created_at).toLocaleString('es-MX')}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.panelGrid}>
              <article
                className={`${styles.panel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:hours')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:hours')}
              >
                <div className={styles.panelHeader}>
                  <h3>Demanda por hora</h3>
                  <span>Ver detalle</span>
                </div>
                {overview.hourly_distribution.length === 0 ? (
                  <p className={styles.emptyState}>Sin reservas confirmadas para graficar.</p>
                ) : (
                  <div className={styles.hourChart}>
                    {overview.hourly_distribution.map((item) => (
                      <div key={item.hour} className={styles.hourColumn}>
                        <div className={styles.hourBarWrap}>
                          <span style={{ height: `${Math.max(8, Math.round((item.reservations / hourlyMax) * 100))}%` }} />
                        </div>
                        <strong>{item.reservations}</strong>
                        <small>{item.hour}</small>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article
                className={`${styles.panel} ${styles.clickablePanel}`}
                role="button"
                tabIndex={0}
                onClick={() => openPanel('panel:users')}
                onKeyDown={(event) => handlePanelKeyDown(event, 'panel:users')}
              >
                <div className={styles.panelHeader}>
                  <h3>Usuarios con más actividad</h3>
                  <span>Ver detalle</span>
                </div>
                <div className={styles.topUserList}>
                  {overview.top_users.length === 0 ? (
                    <p className={styles.emptyState}>Sin usuarios con reserva activa.</p>
                  ) : overview.top_users.map((user, index) => (
                    <div key={user.user_id} className={styles.topUserItem}>
                      <span className={styles.rank}>{index + 1}</span>
                      <span className={styles.avatar}>{initials(user.first_name, user.last_name)}</span>
                      <div>
                        <strong>{user.first_name} {user.last_name}</strong>
                        <small>{user.email}</small>
                      </div>
                      <b>{user.reservations}</b>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            {expandedKey && createPortal((
              <div
                className={styles.detailBackdrop}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setExpandedKey(null)
                }}
              >
                <section className={styles.detailModal} role="dialog" aria-modal="true" aria-label={`Detalle de ${detailTitle()}`}>
                  <button type="button" className={styles.detailClose} onClick={() => setExpandedKey(null)} aria-label="Cerrar detalle">
                    ×
                  </button>
                  <span className={styles.detailEyebrow}>Detalle operativo</span>
                  <h2>{detailTitle()}</h2>
                  {renderExpandedDetail()}
                  {overview && renderReservationTable(detailRows)}
                </section>
              </div>
            ), document.body)}

          </>
        ) : null}
      </div>
    </AppShell>
  )
}
