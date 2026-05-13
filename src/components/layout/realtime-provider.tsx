"use client"

import { useRealtime } from "@/hooks/use-realtime"

/**
 * Mounts real-time Pusher subscriptions for the entire dashboard.
 * Any mutation (project create/update, approval, dispatch) triggers
 * a router.refresh() so all server components re-fetch fresh data.
 */
export function RealtimeProvider() {
  useRealtime(["PROJECTS", "APPROVALS", "DISPATCH", "DASHBOARD", "NOTIFICATIONS"])
  return null
}
