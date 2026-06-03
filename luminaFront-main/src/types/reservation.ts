import type { BadgeInfo } from './gamification'

// Categorías de prioridad de espacios
export type PriorityCategory =
  | 'escritorio'
  | 'colaborativo'
  | 'work_lab'
  | 'phone_booth'
  | 'garage';

// Estado visual de un asiento en el mapa
export type SeatStatus = 'available' | 'occupied' | 'unavailable' | 'selected';

// Códigos de error de la API de reservas
export type ReservationErrorCode =
  | 'MISSING_FIELDS'
  | 'INVALID_TIME_RANGE'
  | 'INVALID_DATE'
  | 'INVALID_ID'
  | 'UNAUTHORIZED'
  | 'SPACE_NOT_FOUND'
  | 'USER_CONFLICT'
  | 'SPACE_UNAVAILABLE'
  | 'INVALID_STATUS'
  | 'CHECK_IN_NOT_AVAILABLE_YET'
  | 'CHECK_IN_WINDOW_CLOSED'
  | 'CHECK_IN_OUTSIDE_ALLOWED_NETWORK'
  | 'CHECK_OUT_NOT_AVAILABLE'
  | 'PARKING_UNAVAILABLE'
  | 'PARKING_CONFLICT'
  | 'VEHICLE_REQUIRED'
  | 'VEHICLE_SELECTION_REQUIRED'
  | 'VEHICLE_NOT_FOUND'
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_ERROR'
  | 'DATABASE_ERROR';

// GET /reservations/availability — item de respuesta
export interface SpaceAvailability {
  id: number;
  space_number: string;
  display_name: string | null;
  floor_id: number;
  priority_category: PriorityCategory;
  is_active: boolean;
}

// POST /reservations — body de la petición
export interface ReservationRequest {
  space_id?: number | null;
  reservation_date: string; // YYYY-MM-DD
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  requiere_estacionamiento?: boolean;
  vehicle_id?: number | null;
}

// POST /reservations — respuesta exitosa (HTTP 201)
export interface ReservationResponse {
  reservation_id: number;
  reservation_code: string; // 8 chars uppercase
  space_id: number | null;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmada';
  requiere_estacionamiento: boolean;
  vehicle_id?: number | null;
  parking_spot: { zone_name: string; spot_number: string } | null;
  newBadges?: BadgeInfo[];
}

export interface UserVehicle {
  id: number
  user_id: number
  alias: string | null
  plate: string
  make: string | null
  model: string | null
  color: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// Valores del formulario de filtros
export interface FilterValues {
  reservation_date: string;
  start_time: string;
  end_time: string;
  floor_id: number | null;
  priority_category: PriorityCategory | null;
}

// Elemento individual en el layout estático de un piso
export interface SpaceLayoutItem {
  id: string;                              // space_number (ej. "PB001")
  row: number;
  col: number;
  type: PriorityCategory | 'non-bookable';
  label?: string;                          // etiqueta visual opcional
}

// Layout completo de un piso
export interface FloorLayout {
  floorId: number | string;
  floorName: string;
  rows: number;
  cols: number;
  spaces: SpaceLayoutItem[];
}

// GET /reservations/my — item de respuesta
export type ReservationStatus = 'confirmada' | 'activa' | 'finalizada' | 'cancelada' | 'no_show'

export interface UserReservation {
  reservation_id: number
  reservation_code: string
  space_number: string
  floor_name: string
  floor_number: number | null
  reservation_date: string
  start_time: string
  end_time: string
  status: ReservationStatus
  grace_period_minutes?: number
  check_in_time?: string | null
  check_out_time?: string | null
  parking_spot_number: string | null
  parking_zone_name: string | null
  vehicle_plate: string | null
  vehicle_label: string | null
}

export interface PublicUserProfile {
  id: number
  first_name: string
  last_name: string
  email: string
  department: string
  profile_photo_url: string | null
}

export interface SpaceOccupancy {
  space_id: number
  intervals: Array<{
    start_time: string
    end_time: string
    status: 'confirmada' | 'activa'
    user: PublicUserProfile
  }>
}

export interface RecommendationResult {
  model: {
    name: string
    version: string
    confidence: number
    factors: string[]
  }
  predicted_occupancy: number
  prediction_label: 'baja' | 'media' | 'alta'
  recommendations: Array<{
    space: SpaceAvailability
    score: number
    confidence: number
    ai_summary: string
    reasons: string[]
    signals: Array<{
      label: string
      value: string
      weight: number
      strength: number
    }>
    nearby_user: PublicUserProfile | null
    predicted_occupancy: number
  }>
}

export interface AssistantResponse {
  answer: string
  confidence: number
  intent: 'recommendation' | 'reservation_status' | 'admin_insight' | 'parking' | 'general'
  recommendations: Array<{
    space_id: number
    space_number: string
    floor_id: number
    score: number
    reason: string
  }>
  actions: Array<{
    label: string
    to: string
  }>
}

export interface AiSpaceRecommendationMarker {
  floor_id: number
  score: number
  reason: string
}

export interface AdminKpiOverview {
  date: string
  date_from: string
  date_to: string
  total_reservations: number
  active_reservations: number
  confirmed_reservations: number
  finalized_reservations: number
  cancelled_reservations: number
  no_show_reservations: number
  parking_reservations: number
  parking_rate: number
  workspace_reservations: number
  desk_only_reservations: number
  desk_parking_reservations: number
  parking_only_reservations: number
  available_spaces: number
  average_duration_minutes: number
  check_in_rate: number
  cancellation_rate: number
  no_show_rate: number
  unique_users: number
  total_spaces: number
  occupied_spaces: number
  occupancy_rate: number
  blocked_area_count: number
  blocked_space_count: number
  status_breakdown: Array<{
    status: ReservationStatus
    count: number
  }>
  reservation_type_breakdown: Array<{
    type: 'desk_only' | 'desk_parking' | 'parking_only'
    count: number
  }>
  hourly_distribution: Array<{
    hour: string
    reservations: number
  }>
  top_users: Array<{
    user_id: number
    first_name: string
    last_name: string
    email: string
    reservations: number
  }>
  top_spaces: Array<{
    space_id: number
    space_number: string
    display_name: string | null
    floor_name: string
    reservations: number
  }>
  underused_spaces: Array<{
    space_id: number
    space_number: string
    display_name: string | null
    floor_name: string
    reservations: number
    last_reservation_date: string | null
  }>
  by_floor: Array<{
    floor_id: number
    floor_name: string
    total_spaces: number
    occupied_spaces: number
    occupancy_rate: number
  }>
  by_category: Array<{
    priority_category: PriorityCategory
    total_spaces: number
    occupied_spaces: number
    occupancy_rate: number
  }>
  blocked_areas: AreaBlock[]
  blocked_spaces: SpaceBlock[]
  reservations_detail: AdminReservationDetail[]
}

export interface AdminReservationDetail {
  reservation_id: number
  reservation_code: string
  reservation_date: string
  start_time: string
  end_time: string
  status: ReservationStatus
  type: 'desk_only' | 'desk_parking' | 'parking_only'
  user_id: number
  first_name: string
  last_name: string
  email: string
  department: string | null
  space_id: number | null
  space_number: string
  display_name: string | null
  floor_id: number | null
  floor_name: string
  floor_number: number | null
  parking_spot_number: string | null
  parking_zone_name: string | null
  vehicle_id: number | null
  vehicle_plate: string | null
  vehicle_label: string | null
}

export interface AreaBlock {
  id: number
  floor_id: number
  floor_name: string
  priority_category: PriorityCategory
  reason: string | null
  is_active: boolean
  created_at: string
}

export interface SpaceBlock {
  id: number
  space_id: number
  space_number: string
  floor_id: number
  floor_name: string
  block_date: string
  start_time: string
  end_time: string
  reason: string | null
  is_active: boolean
  created_at: string
}

export interface ParkingReservationForGuard {
  reservation_id: number
  reservation_code: string
  reservation_date: string
  start_time: string
  end_time: string
  status: 'confirmada' | 'activa'
  parking_spot_number: string
  parking_zone_name: string
  user: PublicUserProfile
  space_number: string
  floor_name: string
  vehicle_plate: string | null
  vehicle_label: string | null
}

export interface UserSearchResult {
  id: number
  first_name: string
  last_name: string
  email: string
  role: string
  department: string | null
  profile_photo_url: string | null
  reservation_count: number
  active_reservation_count: number
  parking_reservation_count: number
  vehicle_count: number
  last_reservation_date: string | null
}

export interface AuditLogEntry {
  id: number
  actor_user_id: number | null
  actor_first_name: string | null
  actor_last_name: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type ReservationRealtimeEventType =
  | 'sync.requested'
  | 'reservation.created'
  | 'reservation.cancelled'
  | 'reservation.checked_in'
  | 'reservation.checked_out'
  | 'area_block.created'
  | 'area_block.deleted'
  | 'space_block.created'
  | 'space_block.deleted'

export interface ReservationRealtimeEvent {
  id: number
  type: ReservationRealtimeEventType
  timestamp: string
  actor_user_id?: number
  reservation_id?: number
  reservation_date?: string
  floor_id?: number
  space_id?: number | null
  parking?: boolean
}

// Respuesta de error genérica de la API
export interface ApiErrorResponse {
  error: string;
  message: string;
}

// Resultado genérico de un servicio
export type ServiceResult<T> =
  | { success: true; data: T; error?: never; unauthorized?: never }
  | { success: false; error: string; unauthorized: boolean };
