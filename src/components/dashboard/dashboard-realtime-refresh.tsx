"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher"

export function DashboardRealtimeRefresh() {
  const router = useRouter()

  useEffect(() => {
    const client = getPusherClient()
    const channel = client.subscribe(CHANNELS.DASHBOARD)

    const handleStatsUpdated = () => {
      router.refresh()
    }

    channel.bind(EVENTS.STATS_UPDATED, handleStatsUpdated)

    return () => {
      channel.unbind(EVENTS.STATS_UPDATED, handleStatsUpdated)
      client.unsubscribe(CHANNELS.DASHBOARD)
    }
  }, [router])

  return null
}
