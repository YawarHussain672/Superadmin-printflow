"use client"

import { useState, useEffect, useCallback } from "react"
import { NewProjectForm } from "./new-project-form"
import { useRouter } from "next/navigation"

// Global event name for triggering the modal
const OPEN_NEW_PROJECT_MODAL_EVENT = "open-new-project-modal"
const PROJECT_CREATED_EVENT = "project-created"

// Global function to open the modal from anywhere
export function openNewProjectModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_NEW_PROJECT_MODAL_EVENT))
  }
}

// Close icon SVG
const CloseIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export function NewProjectModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleSuccess = () => {
    setIsOpen(false)
    // Notify all components that a project was created
    window.dispatchEvent(new CustomEvent(PROJECT_CREATED_EVENT))
    router.refresh()
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  useEffect(() => {
    window.addEventListener(OPEN_NEW_PROJECT_MODAL_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_NEW_PROJECT_MODAL_EVENT, handleOpen)
  }, [handleOpen])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "900px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid var(--gray-200)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start"
          }}
        >
          <div>
            <h2 className="modal-title" style={{ fontSize: "24px", fontWeight: 800, color: "var(--gray-900)", marginBottom: "4px" }}>
              Create New Project
            </h2>
            <p className="modal-subtitle" style={{ fontSize: "14px", color: "var(--gray-500)" }}>
              Add multiple collaterals in a single project
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gray-400)",
              background: "transparent",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-100)"; e.currentTarget.style.color = "var(--gray-600)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--gray-400)" }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="modal-body"
          style={{
            padding: "32px",
            overflowY: "auto",
            flex: 1
          }}
        >
          <NewProjectForm onSuccess={handleSuccess} onCancel={handleClose} />
        </div>

      </div>
    </div>
  )
}
