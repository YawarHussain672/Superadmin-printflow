"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher"

type RealtimeChannel = keyof typeof CHANNELS

/**
 * Subscribes to one or more Pusher channels and refreshes the page
 * whenever any relevant event fires.
 */
export function useRealtime(channels: RealtimeChannel[]) {
  const router = useRouter()

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    const client = getPusherClient()
    const subscriptions = channels.map((ch) => {
      const channel = client.subscribe(CHANNELS[ch])
      Object.values(EVENTS).forEach((event) => {
        channel.bind(event, refresh)
      })
      return channel
    })

    return () => {
      subscriptions.forEach((channel) => {
        Object.values(EVENTS).forEach((event) => {
          channel.unbind(event, refresh)
        })
        client.unsubscribe(channel.name)
      })
    }
  }, [channels, refresh])
}
