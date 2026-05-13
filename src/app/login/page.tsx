"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

// SVG Icons
const MailIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
  </svg>
)

const LockIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

const EyeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
)

const LoaderIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({ email: "", password: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })
      if (result?.error) {
        toast.error("Invalid email or password")
      } else {
        toast.success("Welcome back!")
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row' }}>
      {/* LEFT - Brand Side */}
      <div style={{
        display: 'none',
        width: '50%',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #00264c 0%, #003c71 50%, #001a33 100%)'
      }} className="lg-flex">
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        {/* Decorative blur circles */}
        <div style={{
          position: 'absolute',
          top: '-8rem',
          right: '-8rem',
          width: '24rem',
          height: '24rem',
          borderRadius: '50%',
          opacity: 0.2,
          background: 'radial-gradient(circle, #b5ebff 0%, transparent 70%)',
          filter: 'blur(60px)'
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '-5rem',
          width: '20rem',
          height: '20rem',
          borderRadius: '50%',
          opacity: 0.15,
          background: 'radial-gradient(circle, #58d5fb 0%, transparent 70%)',
          filter: 'blur(80px)'
        }} />

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          padding: '0 4rem',
          width: '100%'
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4rem' }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              backgroundColor: 'rgba(255,255,255,0.1)'
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem' }}>A</span>
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '1.125rem' }}>Axis Max Life</p>
              <p style={{ color: '#b5ebff', fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.05em' }}>PRINT MANAGEMENT</p>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.1,
            marginBottom: '1.5rem'
          }}>
            Streamline Your<br />
            <span style={{ color: '#b5ebff' }}>Print Operations</span>
          </h1>

          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.25rem', maxWidth: '28rem', marginBottom: '3rem' }}>
            The Modern Precisionist • Editorial Print Systems
          </p>

          {/* Feature Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {["Real-time Tracking", "Smart Queue", "Fleet Analytics"].map((feature) => (
              <span key={feature} style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '9999px',
                color: 'rgba(255,255,255,0.9)',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                backgroundColor: 'rgba(255,255,255,0.05)'
              }}>
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT - Form Side */}
      <div style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: '#faf8ff'
      }} className="lg-w-50">
        <div style={{ width: '100%', maxWidth: '28rem' }}>
          {/* Mobile Logo - Hidden on large screens */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '3rem',
            justifyContent: 'center'
          }} className="lg-hidden">
            <div style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              background: 'linear-gradient(135deg, #00264c, #003c71)'
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '1.125rem' }}>A</span>
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '1.125rem', color: '#1a1b20' }}>Axis Max Life</p>
              <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#003c71' }}>PRINT MANAGEMENT</p>
            </div>
          </div>

          {/* Welcome */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.75rem', color: '#1a1b20' }}>Welcome Back</h2>
            <p style={{ color: '#42474f' }}>Please enter your credentials to access your dashboard.</p>
          </div>

          {/* Form Card */}
          <div style={{
            borderRadius: '0.75rem',
            padding: '2rem',
            border: '1px solid rgba(195,198,209,0.15)',
            backgroundColor: 'white',
            boxShadow: '0 12px 32px rgba(0,26,51,0.08)'
          }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1a1b20' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#737780' }}>
                    <MailIcon />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@company.com"
                    required
                    style={{
                      width: '100%',
                      paddingLeft: '3rem',
                      paddingRight: '1rem',
                      paddingTop: '0.75rem',
                      paddingBottom: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(195,198,209,0.2)',
                      backgroundColor: '#f4f3fa',
                      color: '#1a1b20',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1a1b20' }}>Password</label>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#737780' }}>
                    <LockIcon />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      paddingLeft: '3rem',
                      paddingRight: '3rem',
                      paddingTop: '0.75rem',
                      paddingBottom: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(195,198,209,0.2)',
                      backgroundColor: '#f4f3fa',
                      color: '#1a1b20',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#737780',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Forgot Password */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link href="/forgot-password" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#003c71', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 1rem',
                  color: 'white',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  background: 'linear-gradient(90deg, #00264c, #003c71)',
                  boxShadow: '0 12px 32px rgba(0,38,76,0.25)',
                  transition: 'opacity 0.2s'
                }}
              >
                {isLoading ? (
                  <>
                    <LoaderIcon />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRightIcon />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Contact Admin */}
          <p style={{ marginTop: '2rem', textAlign: 'center', color: '#42474f' }}>
            Don&apos;t have an account?{" "}
            <a href="mailto:admin@axismaxlife.com" style={{ fontWeight: 600, color: '#003c71', textDecoration: 'none' }}>
              Contact administrator
            </a>
          </p>

          {/* Footer */}
          <div style={{ marginTop: '3rem', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#737780' }}>
            © 2024 Axis Max Life Insurance
          </div>
        </div>
      </div>

      {/* Media query styles */}
      <style jsx>{`
        @media (min-width: 1024px) {
          .lg-flex {
            display: flex !important;
          }
          .lg-w-50 {
            width: 50% !important;
          }
          .lg-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
