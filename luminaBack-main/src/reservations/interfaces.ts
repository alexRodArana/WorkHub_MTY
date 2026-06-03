export type PriorityCategory =
  | "escritorio"
  | "colaborativo"
  | "work_lab"
  | "phone_booth"
  | "garage"

export type ReservationStatus =
  | "confirmada"
  | "activa"
  | "finalizada"
  | "cancelada"
  | "no_show"

export interface Floor {
  id: number
  floor_number: number
  building_id: number
  name: string
  plan_image_url: string | null
  is_active: boolean
}

export interface LayoutPoint {
  x: number
  y: number
}

export interface Space {
  id: number
  space_number: string
  display_name: string | null
  floor_id: number
  priority_category: PriorityCategory | null
  is_active: boolean
  layout_type: "desk" | "rect" | "polygon" | null
  layout_direction: "up" | "down" | "left" | "right" | null
  layout_cx: number | null
  layout_cy: number | null
  layout_points: LayoutPoint[] | null
  visual_only: boolean
}

export interface ParkingSpotInfo {
  zone_name: string
  spot_number: string
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
  created_at: Date
  updated_at: Date
}

export interface PublicUserProfile {
  id: number
  first_name: string
  last_name: string
  email: string
  department: string
  profile_photo_url: string | null
}

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
  check_in_time?: Date | null
  check_out_time?: Date | null
  parking_spot_number: string | null
  parking_zone_name: string | null
  vehicle_plate: string | null
  vehicle_label: string | null
}

export interface SpaceOccupancy {
  space_id: number
  intervals: Array<{
    start_time: string
    end_time: string
    status: Extract<ReservationStatus, "confirmada" | "activa">
    user: PublicUserProfile
  }>
}

export interface RecommendationSignal {
  label: string
  value: string
  weight: number
  strength: number
}

export interface IntelligentRecommendation {
  space: Space
  score: number
  confidence: number
  ai_summary: string
  reasons: string[]
  signals: RecommendationSignal[]
  nearby_user: PublicUserProfile | null
  predicted_occupancy: number
}

export interface RecommendationResult {
  model: {
    name: string
    version: string
    confidence: number
    factors: string[]
  }
  predicted_occupancy: number
  prediction_label: "baja" | "media" | "alta"
  recommendations: IntelligentRecommendation[]
}

export interface AssistantRecommendationSummary {
  space_id: number
  space_number: string
  floor_id: number
  score: number
  reason: string
}

export interface AssistantResponse {
  answer: string
  confidence: number
  intent: "recommendation" | "reservation_status" | "admin_insight" | "parking" | "general"
  recommendations: AssistantRecommendationSummary[]
  actions: Array<{
    label: string
    to: string
  }>
}

export interface UserPreferenceSignals {
  total_reservations: number
  spaces: Map<number, number>
  floors: Map<number, number>
  categories: Map<PriorityCategory, number>
}

export interface Reservation {
  id: number
  user_id: number
  space_id: number | null
  reservation_date: string        // ISO 8601: "YYYY-MM-DD"
  start_time: string              // "HH:MM"
  end_time: string                // "HH:MM"
  status: ReservationStatus
  check_in_time: Date | null
  check_out_time: Date | null
  grace_period_minutes: number
  reservation_code: string        // 8 chars uppercase alphanumeric
  requiere_estacionamiento: boolean
  parking_spot_id: number | null
  vehicle_id: number | null
  created_at: Date
  updated_at: Date
}

export interface ReservationEventDetails {
  reservation_id: number
  reservation_date: string
  space_id: number | null
  floor_id?: number
  parking: boolean
}

export interface AvailabilityFilter {
  reservation_date: string        // "YYYY-MM-DD"
  start_time: string              // "HH:MM"
  end_time: string                // "HH:MM"
  floor_id?: number
  priority_category?: PriorityCategory
}

export interface CreateReservationInput {
  space_id?: number | null
  reservation_date: string
  start_time: string
  end_time: string
  requiere_estacionamiento?: boolean
  vehicle_id?: number | null
}

export interface ReservationResult {
  reservation_id: number
  reservation_code: string
  space_id: number | null
  reservation_date: string
  start_time: string
  end_time: string
  status: ReservationStatus
  requiere_estacionamiento: boolean
  vehicle_id?: number | null
  parking_spot: ParkingSpotInfo | null
  newBadges?: BadgeInfo[]
}

export interface CheckOutResult {
  check_out_time: Date
}

export interface NewReservationRecord {
  user_id: number
  space_id: number | null
  reservation_date: string
  start_time: string
  end_time: string
  reservation_code: string
  status: "confirmada"
  grace_period_minutes: number
  requiere_estacionamiento: boolean
  vehicle_id?: number | null
  check_in_time: null
  check_out_time: null
}

export interface StreakInfo {
  current_streak: number
  longest_streak: number
  last_check_in_date: string | null
}

export interface BadgeInfo {
  id: number
  key: string
  name: string
  description: string
  earned_percentage?: number
}

export interface CheckInResult {
  streak: StreakInfo
  newBadges: BadgeInfo[]
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
    type: "desk_only" | "desk_parking" | "parking_only"
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
  type: "desk_only" | "desk_parking" | "parking_only"
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
  created_at: Date
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
  created_at: Date
}

export interface ParkingReservationForGuard {
  reservation_id: number
  reservation_code: string
  reservation_date: string
  start_time: string
  end_time: string
  status: Extract<ReservationStatus, "confirmada" | "activa">
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
  created_at: Date
}
