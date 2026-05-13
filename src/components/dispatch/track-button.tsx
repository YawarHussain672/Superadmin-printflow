"use client"

import { useState } from "react"
import { formatDate } from "@/utils/formatters"
import { toast } from "sonner"

// SVG Icons
const MapPinIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const TruckIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M21 12v7a1 1 0 01-1 1h-1" />
  </svg>
)

const PackageIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
)

const CopyIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const ExternalLinkIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
)

interface TrackButtonProps {
  courier: string
  trackingId: string
  dispatchDate: Date | string | null
  expectedDelivery: Date | string | null
  actualDelivery: Date | string | null
  variant?: "primary" | "secondary"
  fullWidth?: boolean
}

// Direct tracking URLs for each courier — lands on the actual tracking result page
function getTrackingUrl(courier: string, trackingId: string): { url: string; label: string } {
  const c = courier.toLowerCase()

  if (c.includes("blue dart") || c.includes("bluedart")) {
    return {
      url: `https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=${trackingId}`,
      label: "Blue Dart",
    }
  }
  if (c.includes("dtdc")) {
    return {
      url: `https://www.dtdc.in/tracking.asp?Ttype=awb&TNo=${trackingId}`,
      label: "DTDC",
    }
  }
  if (c.includes("fedex")) {
    return {
      url: `https://www.fedex.com/fedextrack/?trknbr=${trackingId}`,
      label: "FedEx",
    }
  }
  if (c.includes("delhivery")) {
    return {
      url: `https://www.delhivery.com/track/package/${trackingId}`,
      label: "Delhivery",
    }
  }
  if (c.includes("ekart") || c.includes("flipkart")) {
    return {
      url: `https://ekartlogistics.com/shipmenttrack/${trackingId}`,
      label: "Ekart",
    }
  }
  if (c.includes("xpressbees")) {
    return {
      url: `https://www.xpressbees.com/shipment/tracking?awbNo=${trackingId}`,
      label: "XpressBees",
    }
  }
  if (c.includes("shadowfax")) {
    return {
      url: `https://tracker.shadowfax.in/?awb=${trackingId}`,
      label: "Shadowfax",
    }
  }
  if (c.includes("ecom") || c.includes("ecom express")) {
    return {
      url: `https://ecomexpress.in/tracking/?awb_field=${trackingId}`,
      label: "Ecom Express",
    }
  }
  if (c.includes("india post") || c.includes("speed post")) {
    return {
      url: `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`,
      label: "India Post",
    }
  }
  // Fallback — Google search with courier name + tracking ID
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(courier)}+tracking+${encodeURIComponent(trackingId)}`,
    label: courier,
  }
}

export function TrackButton({
  courier,
  trackingId,
  dispatchDate,
  expectedDelivery,
  actualDelivery,
  variant = "primary",
  fullWidth = false
}: TrackButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { url, label } = getTrackingUrl(courier, trackingId)

  const isSecondary = variant === "secondary"

  const copyTrackingId = () => {
    navigator.clipboard.writeText(trackingId)
    setCopied(true)
    toast.success("Tracking ID copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const isDelivered = !!actualDelivery
  const closeModal = () => setOpen(false)

  return (
    <>
      {/* Track Button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: fullWidth ? '100%' : 'auto',
          padding: isSecondary ? '10px 16px' : '8px 14px',
          borderRadius: '8px',
          border: isSecondary ? '1px solid #e5e7eb' : '1px solid #003c71',
          background: isSecondary ? '#ffffff' : '#ffffff',
          color: isSecondary ? '#374151' : '#003c71',
          fontSize: isSecondary ? '14px' : '13px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 150ms ease'
        }}
        onMouseEnter={(e) => {
          if (isSecondary) {
            e.currentTarget.style.background = '#f9fafb'
            e.currentTarget.style.borderColor = '#d1d5db'
          } else {
            e.currentTarget.style.background = '#003c71'
            e.currentTarget.style.color = '#ffffff'
          }
        }}
        onMouseLeave={(e) => {
          if (isSecondary) {
            e.currentTarget.style.background = '#ffffff'
            e.currentTarget.style.borderColor = '#e5e7eb'
          } else {
            e.currentTarget.style.background = '#ffffff'
            e.currentTarget.style.color = '#003c71'
          }
        }}
      >
        <MapPinIcon />
        {isSecondary ? 'Track Shipment' : 'Track'}
      </button>

      {/* Track Shipment Modal */}
      {open && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Header with Brand Color */}
            <div
              style={{
                background: 'linear-gradient(135deg, #003c71 0%, #002a52 100%)',
                padding: '16px 20px',
                textAlign: 'center',
                color: '#ffffff',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  backdropFilter: 'blur(4px)'
                }}
              >
                <div style={{ color: '#ffffff', transform: 'scale(0.75)' }}>
                  <TruckIcon />
                </div>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Track Shipment
              </h2>
              <p style={{ fontSize: '11px', color: '#93c5fd', margin: '2px 0 0 0' }}>
                via {label}
              </p>
            </div>

            {/* Content - Scrollable */}
            <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
              {/* Courier & Tracking ID */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Courier</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{courier}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Tracking ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                      {trackingId}
                    </span>
                    <button
                      onClick={copyTrackingId}
                      style={{
                        padding: '4px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'transparent',
                        color: copied ? '#16a34a' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'color 150ms ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!copied) e.currentTarget.style.color = '#64748b'
                      }}
                      onMouseLeave={(e) => {
                        if (!copied) e.currentTarget.style.color = '#94a3b8'
                      }}
                    >
                      {copied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '12px' }}>
                  Shipment Timeline
                </h4>

                <div style={{ position: 'relative', paddingLeft: '24px' }}>
                  {/* Timeline Line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '6px',
                      bottom: '6px',
                      width: '2px',
                      background: '#e2e8f0'
                    }}
                  />

                  {/* Dispatched */}
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '-18px',
                        top: '2px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#003c71',
                        border: '2px solid #ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    />
                    <div
                      style={{
                        background: '#eff6ff',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        border: '1px solid #dbeafe'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <div style={{ color: '#003c71' }}>
                          <PackageIcon />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#003c71' }}>Dispatched</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {dispatchDate ? formatDate(dispatchDate) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Expected Delivery */}
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '-18px',
                        top: '2px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: isDelivered ? '#16a34a' : '#f59e0b',
                        border: '2px solid #ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    />
                    <div
                      style={{
                        background: isDelivered ? '#f0fdf4' : '#fffbeb',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        border: isDelivered ? '1px solid #bbf7d0' : '1px solid #fde68a'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <div style={{ color: isDelivered ? '#16a34a' : '#d97706' }}>
                          <CalendarIcon />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isDelivered ? '#16a34a' : '#d97706' }}>
                          {isDelivered ? 'Delivered On' : 'Expected Delivery'}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {expectedDelivery ? formatDate(expectedDelivery) : "TBD"}
                      </span>
                    </div>
                  </div>

                  {/* Actual Delivery */}
                  {isDelivered && (
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: '-18px',
                          top: '2px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#16a34a',
                          border: '2px solid #ffffff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                        }}
                      />
                      <div
                        style={{
                          background: '#f0fdf4',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          border: '1px solid #bbf7d0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <div style={{ color: '#16a34a' }}>
                            <MapPinIcon />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>
                            Delivered ✓
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {formatDate(actualDelivery!)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Track Button */}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #003c71 0%, #002a52 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderRadius: '8px',
                  transition: 'all 150ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #002a52 0%, #001f3d 100%)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #003c71 0%, #002a52 100%)'
                }}
              >
                <ExternalLinkIcon />
                Track on {label}
              </a>
              <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', margin: '8px 0 0 0' }}>
                Opens official {label} tracking page
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
