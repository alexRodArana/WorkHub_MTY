import { Response } from "express"

export type ReservationRealtimeEventType =
  | "sync.requested"
  | "reservation.created"
  | "reservation.cancelled"
  | "reservation.checked_in"
  | "reservation.checked_out"
  | "area_block.created"
  | "area_block.deleted"
  | "space_block.created"
  | "space_block.deleted"

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

interface Client {
  id: number
  res: Response
  heartbeat: NodeJS.Timeout
}

let nextEventId = 1
let nextClientId = 1
const MAX_BACKLOG_SIZE = 100

function writeEvent(res: Response, eventName: string, data: unknown, id?: number): void {
  if (id !== undefined) res.write(`id: ${id}\n`)
  res.write("retry: 3000\n")
  res.write(`event: ${eventName}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export class ReservationEventHub {
  private readonly clients = new Map<number, Client>()
  private readonly backlog: ReservationRealtimeEvent[] = []

  subscribe(res: Response, lastEventId?: number): () => void {
    const clientId = nextClientId++

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache, no-transform")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders?.()

    writeEvent(res, "connected", {
      timestamp: new Date().toISOString(),
      client_id: clientId,
    })

    if (lastEventId && Number.isInteger(lastEventId)) {
      for (const event of this.backlog.filter((item) => item.id > lastEventId)) {
        writeEvent(res, "reservation", event, event.id)
      }
    }

    writeEvent(res, "reservation", {
      id: nextEventId,
      type: "sync.requested",
      timestamp: new Date().toISOString(),
    } satisfies ReservationRealtimeEvent)

    const heartbeat = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`)
    }, 25_000)

    const client: Client = { id: clientId, res, heartbeat }
    this.clients.set(clientId, client)

    const cleanup = () => {
      clearInterval(heartbeat)
      this.clients.delete(clientId)
      if (!res.writableEnded) res.end()
    }

    res.on("close", cleanup)
    res.on("error", cleanup)

    return cleanup
  }

  publish(event: Omit<ReservationRealtimeEvent, "id" | "timestamp">): ReservationRealtimeEvent {
    const payload: ReservationRealtimeEvent = {
      ...event,
      id: nextEventId++,
      timestamp: new Date().toISOString(),
    }

    this.backlog.push(payload)
    if (this.backlog.length > MAX_BACKLOG_SIZE) {
      this.backlog.splice(0, this.backlog.length - MAX_BACKLOG_SIZE)
    }

    for (const client of this.clients.values()) {
      if (client.res.writableEnded) {
        clearInterval(client.heartbeat)
        this.clients.delete(client.id)
        continue
      }
      writeEvent(client.res, "reservation", payload, payload.id)
    }

    return payload
  }
}

export const reservationEventHub = new ReservationEventHub()
