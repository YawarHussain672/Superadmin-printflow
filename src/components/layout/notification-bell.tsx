"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher"
import { formatDate } from "@/utils/formatters"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  link: string | null
  createdAt: string
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Fetch notifications function (silent)
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?t=${Date.now()}`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // Silent fail
    }
  }, [])

  // Keep ref updated with latest function
  const fetchNotificationsRef = useRef(fetchNotifications)
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications
  }, [fetchNotifications])

  // Initial fetch + polling fallback
  useEffect(() => {
    fetchNotificationsRef.current()
    // Poll every 10 seconds as fallback (Pusher WebSocket failing)
    const interval = setInterval(() => fetchNotificationsRef.current(), 10000)
    return () => clearInterval(interval)
  }, [])

  // Handle real-time delete event (single, all, or project-related)
  const handleNotificationDeletedRef = useRef((data: { userId: string; notificationId?: string; allDeleted?: boolean; projectDeleted?: boolean }) => {
    if (data.allDeleted) {
      setNotifications([])
      setUnreadCount(0)
    } else if (data.notificationId) {
      setNotifications((prev) => prev.filter((n) => n.id !== data.notificationId))
      setUnreadCount((c) => Math.max(0, c - 1))
    } else if (data.projectDeleted) {
      // Project was deleted - refetch to get updated list
      fetchNotificationsRef.current()
    }
  })

  // Real-time updates via Pusher
  useEffect(() => {
    const client = getPusherClient()
    const channel = client.subscribe(CHANNELS.NOTIFICATIONS)

    // Create stable wrapper that calls the ref (always fresh)
    const handleNewNotification = () => {
      fetchNotificationsRef.current()
    }
    const handleDelete = (data: { userId: string; notificationId?: string; allDeleted?: boolean; projectDeleted?: boolean }) => {
      handleNotificationDeletedRef.current(data)
    }

    channel.bind(EVENTS.NOTIFICATION_CREATED, handleNewNotification)
    channel.bind(EVENTS.NOTIFICATION_DELETED, handleDelete)

    return () => {
      channel.unbind(EVENTS.NOTIFICATION_CREATED, handleNewNotification)
      channel.unbind(EVENTS.NOTIFICATION_DELETED, handleDelete)
      client.unsubscribe(CHANNELS.NOTIFICATIONS)
    }
  }, []) // Empty deps - stable

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const deleteAllNotifications = async () => {
    await fetch("/api/notifications", { method: "DELETE" })
    setNotifications([])
    setUnreadCount(0)
  }

  const handleClick = async (n: Notification) => {
    // Delete notification on click (Option 3: Delete on mark-read)
    await fetch(`/api/notifications/${n.id}`, { method: "DELETE" })
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    if (!n.read) {
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    if (n.link) {
      router.push(n.link)
      setOpen(false)
    }
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          border: "1px solid #e2e8f0",
          cursor: "pointer",
          color: "#64748b",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#f8fafc"
          e.currentTarget.style.borderColor = "#cbd5e1"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#fff"
          e.currentTarget.style.borderColor = "#e2e8f0"
        }}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {/* Notification Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              width: "8px",
              height: "8px",
              background: "#ef4444",
              borderRadius: "50%",
              border: "2px solid #fff",
            }}
          />
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: "0",
            width: "360px",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            border: "1px solid #e2e8f0",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#0f172a",
                margin: 0,
              }}
            >
              Notifications
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {notifications.length > 0 && (
                <button
                  onClick={deleteAllNotifications}
                  style={{
                    fontSize: "13px",
                    color: "#dc2626",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = "underline"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = "none"
                  }}
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5f9"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                }}
              >
                <svg
                  width="48"
                  height="48"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{
                    color: "#cbd5e1",
                    margin: "0 auto 12px",
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: n.read ? "#fff" : "#eff6ff",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = n.read ? "#f8fafc" : "#dbeafe"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = n.read ? "#fff" : "#eff6ff"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "14px",
                          fontWeight: n.read ? 400 : 500,
                          color: n.read ? "#475569" : "#0f172a",
                          margin: "0 0 4px 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            background: "#3b82f6",
                            borderRadius: "50%",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        margin: "0 0 4px 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {n.message}
                    </p>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                      {formatDate(new Date(n.createdAt))}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
