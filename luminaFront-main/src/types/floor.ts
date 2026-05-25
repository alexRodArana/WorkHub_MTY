export interface FloorSummary {
  id: number
  floor_number: number
  name: string
  plan_image_url: string | null
  is_active: boolean
}

export interface LayoutPoint {
  x: number
  y: number
}

export type LayoutType = 'desk' | 'rect' | 'polygon'
export type LayoutDirection = 'up' | 'down' | 'left' | 'right'

export interface SpaceWithLayout {
  id: number
  space_number: string
  display_name: string | null
  floor_id: number
  priority_category: string | null
  is_active: boolean
  layout_type: LayoutType | null
  layout_direction: LayoutDirection | null
  layout_cx: number | null
  layout_cy: number | null
  layout_points: LayoutPoint[] | null
  visual_only: boolean
}
