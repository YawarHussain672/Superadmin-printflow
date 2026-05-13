import Pusher from "pusher"
import PusherJS from "pusher-js"

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

// Client-side Pusher instance (singleton)
let pusherClient: PusherJS | null = null

export function getPusherClient(): PusherJS {
  if (!pusherClient) {
    pusherClient = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      enabledTransports: ["ws", "wss"],
    })

    // Debug connection state
    if (typeof window !== "undefined") {
      pusherClient.connection.bind("connected", () => {
        // Connection established
      })
      pusherClient.connection.bind("disconnected", () => {
        // Connection lost
      })
      pusherClient.connection.bind("error", () => {
        // Silent fail - polling will handle notifications
      })
    }
  }
  return pusherClient
}

// Channel and event constants
export const CHANNELS = {
  PROJECTS: "projects",
  APPROVALS: "approvals",
  DISPATCH: "dispatch",
  DASHBOARD: "dashboard",
  NOTIFICATIONS: "notifications",
} as const

export const EVENTS = {
  PROJECT_CREATED: "project:created",
  PROJECT_UPDATED: "project:updated",
  PROJECT_DELETED: "project:deleted",
  APPROVAL_UPDATED: "approval:updated",
  DISPATCH_UPDATED: "dispatch:updated",
  STATS_UPDATED: "stats:updated",
  NOTIFICATION_CREATED: "notification:created",
  NOTIFICATION_DELETED: "notification:deleted",
} as const
