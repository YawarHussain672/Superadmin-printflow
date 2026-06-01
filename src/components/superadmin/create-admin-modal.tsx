"use client"

import { useState, useEffect, useRef } from "react"
import {
  X, Building, Mail, MapPin, Lock, Upload,
  Eye, EyeOff, RefreshCw, ShieldCheck
} from "lucide-react"
import { toast } from "sonner"

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu and Kashmir", "Ladakh", "Puducherry"
]

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const iStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb",
  borderRadius: "10px", fontSize: "14px", outline: "none", fontFamily: "inherit",
  backgroundColor: "#fafafa", color: "#111827", transition: "border-color 0.15s, background 0.15s",
  boxSizing: "border-box",
}
const iIconStyle: React.CSSProperties = { ...iStyle, paddingLeft: "40px" }

export function CreateAdminModal() {
  const [open, setOpen] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [location, setLocation] = useState("")
  const [streetAddress, setStreetAddress] = useState("")
  const [state, setState] = useState("")
  const [pinCode, setPinCode] = useState("")
  const [country, setCountry] = useState("India")
  const [clientPan, setClientPan] = useState("")
  const [clientGst, setClientGst] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Listen for global event from header/sidebar
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("openCreateAdmin", handler)
    return () => window.removeEventListener("openCreateAdmin", handler)
  }, [])

  // Reset form on open
  useEffect(() => {
    if (open) {
      setCompanyName(""); setClientEmail(""); setLocation(""); setStreetAddress("")
      setState(""); setPinCode(""); setCountry("India"); setClientPan(""); setClientGst("")
      setPassword(""); setShowPassword(false); setLogo(null); setLogoPreview(null)
    }
  }, [open])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    if (open) document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let pass = ""
    pass += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]
    pass += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]
    pass += "0123456789"[Math.floor(Math.random() * 10)]
    pass += "!@#$%^&*"[Math.floor(Math.random() * 8)]
    for (let i = 4; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)]
    setPassword(pass.split("").sort(() => 0.5 - Math.random()).join(""))
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB."); return }
    setLogo(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName || !clientEmail || !location || !streetAddress || !state || !pinCode || !country || !password) {
      toast.error("Please fill in all required fields."); return
    }
    setIsSubmitting(true)
    const fullAddress = `${streetAddress.trim()}, ${location.trim()}, ${state.trim()} - ${pinCode.trim()}, ${country.trim()}`
    const formData = new FormData()
    formData.append("companyName", companyName)
    formData.append("clientEmail", clientEmail)
    formData.append("location", location)
    formData.append("branchLocation", fullAddress)
    formData.append("state", state)
    formData.append("clientPan", clientPan)
    formData.append("clientGst", clientGst)
    formData.append("password", password)
    if (logo) formData.append("logo", logo)

    try {
      const res = await fetch("/api/superadmin/clients", { method: "POST", body: formData })
      if (res.ok) {
        toast.success("Client Admin account created successfully!")
        setOpen(false)
        // Refresh the admins list if on that page
        window.dispatchEvent(new CustomEvent("refreshAdminsList"))
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to create client admin.")
      }
    } catch {
      toast.error("Failed to create client admin.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={(e) => { if (e.target === overlayRef.current) setOpen(false) }}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px", animation: "caBackdropIn 0.2s ease forwards"
        }}
      >
        {/* Modal */}
        <div style={{
          background: "white", borderRadius: "20px", width: "100%", maxWidth: "880px",
          maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 32px 100px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.05)",
          animation: "caModalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards",
          position: "relative", display: "flex", flexDirection: "column"
        }}>

          {/* Header */}
          <div style={{
            padding: "24px 28px 20px",
            background: "linear-gradient(180deg, #002a52 0%, #001a33 100%)",
            borderRadius: "20px 20px 0 0",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            position: "sticky", top: 0, zIndex: 2, flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: "rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <ShieldCheck size={22} color="white" />
              </div>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "white", margin: 0, lineHeight: 1.3 }}>
                  Onboard New Admin
                </h2>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "3px" }}>
                  Configure profile, billing, credentials &amp; branding
                </p>
              </div>
            </div>
            <button
              type="button" onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "10px",
                width: "36px", height: "36px", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "white",
                flexShrink: 0, marginLeft: "16px", transition: "background 0.15s"
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} style={{ padding: "28px", flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>

              {/* LEFT: Organization Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "4px", height: "20px", background: "linear-gradient(180deg,#002a52,#0050a0)", borderRadius: "4px" }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Organization Details
                  </span>
                </div>

                <Field label="Company Name" required>
                  <div style={{ position: "relative" }}>
                    <Building size={16} style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input type="text" required placeholder="e.g. Axis Max Life" value={companyName} onChange={e => setCompanyName(e.target.value)} style={iIconStyle} />
                  </div>
                </Field>

                <Field label="Administrator Email" required>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                    <input type="email" required placeholder="e.g. admin@axismaxlife.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} style={iIconStyle} />
                  </div>
                </Field>

                <div style={{ borderTop: "1.5px dashed #e5e7eb", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Billing Address
                  </span>

                  <Field label="Street / Building" required>
                    <textarea
                      required rows={2}
                      placeholder="e.g. 3rd Floor, Operations Centre, 90-A, Udyog Vihar, Sector 18"
                      value={streetAddress} onChange={e => setStreetAddress(e.target.value)}
                      style={{ ...iStyle, resize: "vertical", minHeight: "70px" }}
                    />
                  </Field>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <Field label="City" required>
                      <div style={{ position: "relative" }}>
                        <MapPin size={15} style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                        <input type="text" required placeholder="e.g. Gurugram" value={location} onChange={e => setLocation(e.target.value)} style={iIconStyle} />
                      </div>
                    </Field>
                    <Field label="State" required>
                      <select required value={state} onChange={e => setState(e.target.value)} style={iStyle}>
                        <option value="">Select State</option>
                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <Field label="Pin Code" required>
                      <input type="text" required placeholder="e.g. 122015" value={pinCode} onChange={e => setPinCode(e.target.value)} style={iStyle} />
                    </Field>
                    <Field label="Country" required>
                      <input type="text" required value={country} onChange={e => setCountry(e.target.value)} style={iStyle} />
                    </Field>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    <Field label="PAN / IT No.">
                      <input type="text" placeholder="e.g. AACCM3201E" value={clientPan} onChange={e => setClientPan(e.target.value)} style={iStyle} />
                    </Field>
                    <Field label="GST No.">
                      <input type="text" placeholder="e.g. 06AACCM3201E1Z7" value={clientGst} onChange={e => setClientGst(e.target.value)} style={iStyle} />
                    </Field>
                  </div>
                </div>
              </div>

              {/* RIGHT: Credentials & Branding */}
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "4px", height: "20px", background: "linear-gradient(180deg,#002a52,#0050a0)", borderRadius: "4px" }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Credentials &amp; Branding
                  </span>
                </div>

                <Field label="Temporary Password" required>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Lock size={16} style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                      <input
                        type={showPassword ? "text" : "password"} required
                        placeholder="Set temporary password"
                        value={password} onChange={e => setPassword(e.target.value)}
                        style={{ ...iIconStyle, paddingRight: "44px" }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", alignItems: "center", padding: 0 }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button type="button" onClick={generatePassword}
                      style={{ padding: "0 14px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#374151", whiteSpace: "nowrap", transition: "all 0.15s", fontFamily: "inherit" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#002a52"; e.currentTarget.style.color = "#002a52" }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#374151" }}
                    >
                      <RefreshCw size={13} /> Auto
                    </button>
                  </div>
                  {password && (
                    <div style={{ marginTop: "8px", padding: "10px 14px", borderRadius: "8px", background: "#f0f4ff", border: "1px solid #bfdbfe", fontSize: "12px", color: "#001a33", fontFamily: "monospace", wordBreak: "break-all" }}>
                      {password}
                    </div>
                  )}
                </Field>

                <Field label="Company Logo Branding">
                  <div
                    style={{ border: "2px dashed #d1d5db", borderRadius: "14px", padding: logoPreview ? "16px" : "28px 20px", textAlign: "center", cursor: "pointer", background: "linear-gradient(135deg, #fafafa 0%, #eff6ff 100%)", position: "relative", transition: "border-color 0.2s", minHeight: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#002a52" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d5db" }}
                    onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "#002a52" }}
                    onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d5db" }}
                    onDrop={e => {
                      e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d5db"
                      const file = e.dataTransfer.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB."); return }
                      setLogo(file)
                      const reader = new FileReader()
                      reader.onloadend = () => setLogoPreview(reader.result as string)
                      reader.readAsDataURL(file)
                    }}
                  >
                    <input type="file" accept="image/*" onChange={handleLogoChange} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                    {logoPreview ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "76px", height: "76px", borderRadius: "12px", overflow: "hidden", border: "2px solid #e5e7eb", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                          <img src={logoPreview} alt="Logo Preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                        </div>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "#374151", margin: 0 }}>{logo?.name}</p>
                          <p style={{ fontSize: "12px", color: "#9ca3af", margin: "2px 0 0" }}>{Math.round((logo?.size || 0) / 1024)} KB · Click to change</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,42,82,0.12)", border: "1.5px solid #bfdbfe" }}>
                          <Upload size={20} color="#002a52" />
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "#374151", margin: 0 }}>Upload organization logo</p>
                          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>Drag &amp; drop or click to browse · Max 2MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Field>

                <div style={{ padding: "14px 16px", borderRadius: "12px", background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: "12px", color: "#002a52", lineHeight: 1.6 }}>
                  <strong>Note:</strong> The admin will receive login credentials and must change the password on first login. PAN and GST details will appear on all invoices generated by their tenant.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "28px", paddingTop: "20px", borderTop: "1.5px solid #f3f4f6" }}>
              <button type="button" onClick={() => setOpen(false)} disabled={isSubmitting}
                style={{ padding: "11px 24px", borderRadius: "10px", border: "1.5px solid #e5e7eb", background: "white", fontSize: "14px", fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                style={{ padding: "11px 28px", borderRadius: "10px", background: isSubmitting ? "#336b99" : "linear-gradient(135deg, #002a52, #001a33)", border: "none", fontSize: "14px", fontWeight: 600, color: "white", cursor: isSubmitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(0,42,82,0.35)", transition: "all 0.15s" }}
              >
                {isSubmitting ? (
                  <><div style={{ width: "15px", height: "15px", border: "2px solid rgba(255,255,255,0.35)", borderTop: "2px solid white", borderRadius: "50%", animation: "caSpin 0.8s linear infinite" }} />Creating...</>
                ) : (
                  <><ShieldCheck size={15} /> Create Admin Account</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes caBackdropIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes caModalIn { from { opacity: 0; transform: scale(0.94) translateY(16px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes caSpin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
        input:focus, textarea:focus, select:focus {
          border-color: #002a52 !important;
          background: white !important;
          box-shadow: 0 0 0 3px rgba(0,42,82,0.1) !important;
        }
      `}</style>
    </>
  )
}
