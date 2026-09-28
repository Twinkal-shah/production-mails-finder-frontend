'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { apiPost } from '@/lib/api'
 

/**
 * Only same-origin relative paths are honoured, so a crafted `returnTo` can't
 * bounce a freshly signed-in user to another site.
 */
function safeReturnTo(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

/**
 * Read at build time, as every NEXT_PUBLIC_* value is. The Client ID is not a secret — it
 * ships in the page source of every site using Google Sign-In; what protects the flow is
 * the origin allowlist in Google Cloud plus server-side token verification.
 *
 * Empty means the feature is simply not offered: the button is not rendered at all.
 */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

/** Just the slice of the Google Identity Services global this page touches. */
interface GoogleIdentityServices {
  accounts?: {
    id?: {
      initialize: (config: {
        client_id: string
        callback: (response: { credential?: string }) => void
      }) => void
      renderButton: (
        parent: HTMLElement,
        options: { theme?: string; size?: string; width?: string; text?: string }
      ) => void
    }
  }
}

/**
 * The shape both the password login and Google sign-in return, since the backend answers
 * both with the same envelope.
 */
function readSession(responseData: Record<string, unknown>) {
  if (responseData.data && typeof responseData.data === 'object' && 'user' in responseData.data && 'access_token' in responseData.data) {
    const data = responseData.data as { user: unknown; access_token: string }
    return {
      accessToken: data.access_token,
      refreshToken: (responseData.data as Record<string, unknown>)['refresh_token'] as string | undefined,
      user: data.user,
    }
  }
  if (responseData.accessToken && responseData.user) {
    return {
      accessToken: responseData.accessToken as string,
      refreshToken: responseData.refreshToken as string | undefined,
      user: responseData.user,
    }
  }
  return null
}

/**
 * Stores the signed-in session and redirects.
 *
 * Shared by the password and Google paths so the two can never drift apart in what they
 * persist — the dashboard reads all three keys.
 */
function storeSessionAndRedirect(
  session: { accessToken: string; refreshToken?: string; user: unknown },
  returnTo: string
) {
  try {
    localStorage.setItem('access_token', session.accessToken)
    if (session.refreshToken) localStorage.setItem('refresh_token', session.refreshToken)
    localStorage.setItem('user_data', JSON.stringify(session.user))
  } catch (e) {
    console.error('Error storing in localStorage:', e)
  }

  // Full reload so auth state is picked up everywhere.
  setTimeout(() => {
    window.location.href = returnTo
  }, 100)
}

function LoginInner() {
  const params = useSearchParams()
  /* Where to land after login. Used by flows that must resume where they
     started — e.g. AppSumo activation, which carries a single-use code in the
     query string. Falls back to the dashboard. */
  const returnTo = safeReturnTo(params.get('returnTo')) || '/home'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(params.get('signup') === '1')
  const [gsiLoaded, setGsiLoaded] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  

  const handleBackendLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Use our apiPost helper so the token is stored automatically
      const res = await apiPost('/api/user/auth/login', { email, password }, { includeAuth: false })
      console.log('Login response:', res)
      if (!res.ok) {
        const errorMsg = res.error && typeof res.error === 'object' ? (res.error.message || res.error.error || `Login failed (${res.status})`) : `Login failed (${res.status})`
        setError(errorMsg as string)
        return
      }
      const session = readSession(res.data as Record<string, unknown>)

      if (!session?.accessToken || !session.user) {
        setError('Invalid login response format')
        return
      }

      console.log('Login successful, redirecting...')
      storeSessionAndRedirect(session, returnTo)
      
    } catch (e: unknown) {
      console.error('Login error:', e)
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Exchanges the Google ID token for a MailsFinder session.
   *
   * Only the token is sent. The backend reads the address out of it after verifying the
   * signature, so the browser never gets to say which account it wants.
   */
  const handleGoogleCredential = useCallback(async (credential: string) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await apiPost('/api/user/auth/google', { credential }, { includeAuth: false })
      if (!res.ok) {
        // Carries the disposable-domain message verbatim when that is the reason.
        const errorMsg = res.error && typeof res.error === 'object'
          ? (res.error.message || res.error.error || `Google sign-in failed (${res.status})`)
          : `Google sign-in failed (${res.status})`
        setError(errorMsg as string)
        return
      }

      const session = readSession(res.data as Record<string, unknown>)
      if (!session?.accessToken || !session.user) {
        setError('Invalid login response format')
        return
      }

      storeSessionAndRedirect(session, returnTo)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setIsLoading(false)
    }
  }, [returnTo])

  /**
   * Renders the Google button once the Identity Services script has loaded.
   *
   * The script is loaded directly rather than through a wrapper package, so initialisation
   * has to wait for both the script and the container element to exist — hence the flag
   * and the ref rather than a plain effect on mount.
   */
  useEffect(() => {
    if (!gsiLoaded || !googleButtonRef.current || !GOOGLE_CLIENT_ID) return

    const google = (window as unknown as { google?: GoogleIdentityServices }).google
    if (!google?.accounts?.id) return

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential?: string }) => {
        if (response?.credential) void handleGoogleCredential(response.credential)
      },
    })

    google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      // Google Identity Services takes a pixel string here and caps it at 400. A
      // percentage is silently ignored, which is why the container is centred instead.
      width: '360',
      text: 'continue_with',
    })
  }, [gsiLoaded, handleGoogleCredential])

  const registerInBackend = async (payload: { email: string; password: string; full_name: string; phone?: string; company?: string | null }) => {
    try {
      // Create minimal payload - include required fields only to avoid "additional properties" error
      const minimalPayload: { email: string; password: string; full_name: string; phone?: string; company?: string } = {
        email: payload.email,
        password: payload.password,
        full_name: payload.full_name // This is required by backend
      };
      
      // Only add optional fields if they exist and have values
      if (payload.phone && payload.phone.trim() !== '') {
        minimalPayload.phone = payload.phone;
      }
      
      if (payload.company && payload.company.trim() !== '') {
        minimalPayload.company = payload.company;
      }
      
      console.log('Sending minimal signup payload:', minimalPayload);
      
      // Use apiPost helper for consistency
      const res = await apiPost('/api/user/auth/signup', minimalPayload, { includeAuth: false })
      console.log('Signup API response:', res)
      
      if (res.ok && res.data) {
        return { ok: true, data: res.data }
      }
      
      // Handle "email already exists" case - we need to try login instead
      const errorMsg = res.error && typeof res.error === 'object' ? (res.error.message || res.error.error || '') : (res.error || '')
      if (res.status === 400 && typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('already registered')) {
        console.log('Email already registered, will proceed to login...')
        return { ok: true, data: null } // Signal that we should try login
      }
      
      // Handle 409 conflict (already exists)
      if (res.status === 409) {
        console.log('Email already exists, will proceed to login...')
        return { ok: true, data: null } // Signal that we should try login
      }
      
      // Other errors
      const msg = typeof errorMsg === 'string' ? errorMsg : `HTTP ${res.status}`
      return { ok: false, error: msg }
    } catch (e: Error | unknown) {
      console.error('Signup error:', e)
      return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        // Register only in backend - include full_name as it's required
        console.log('Attempting signup with:', { email, fullName })
        
        // Backend requires full_name, so include it
        const testPayload = {
          email: email.trim(),
          password: password,
          full_name: fullName.trim()
        };
        
        console.log('Testing signup payload with full_name:', testPayload);
        const backendResult = await registerInBackend(testPayload)
        console.log('Signup result:', backendResult)
        if (!backendResult.ok) {
          // The backend's own wording is shown as-is. It is written for the user — the
          // disposable-domain refusal in particular has exact copy — and prefixing it with
          // internal phrasing put debug text in front of customers.
          // registerInBackend yields '' when the response carried no message, so a generic
          // fallback keeps an empty alert from silently swallowing the failure.
          setError(backendResult.error || 'Signup failed. Please try again.')
          return
        }
        
        // Check if we got signup data or need to login
        if (backendResult.data) {
          // Signup successful - redirect to login page to force login
          console.log('Signup successful, redirecting to login...')
          // Clear the form and switch to login mode
          setIsSignUp(false)
          setSuccess('Account created successfully! Please log in to continue.')
          setError(null) // Clear any previous errors
          // Optionally clear password field for security
          setPassword('')
        } else {
          // Email already exists or no data returned - try login
          console.log('Email exists or no signup data, attempting login...')
          await handleBackendLogin()
        }
      } else {
        // Sign in via backend only
        await handleBackendLogin()
      }
    } catch (error: Error | unknown) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
      setSuccess(null) // Clear success message on error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp 
              ? 'Enter your details to create your account'
              : 'Enter your email and password to access your account'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isSignUp}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required={isSignUp}
                placeholder="Enter your phone number"
              />
            </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company (Optional)</Label>
                  <Input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Enter your company name"
                  />
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                minLength={6}
              />
              {!isSignUp && (
                <div className="text-right mt-2">
                  <Link href="/forgot-password" className="text-sm font-medium" style={{ color: 'var(--brand-ink)' }}>
                    Forgot your password?
                  </Link>
                </div>
              )}
            </div>

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <>
              <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onLoad={() => setGsiLoaded(true)}
              />
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              {/* One button serves both modes: a single Google click signs in an existing
                  account or creates a new one. */}
              <div ref={googleButtonRef} className="flex justify-center" />
            </>
          )}

          <div className="mt-4 text-center">
            {!isSignUp && (
              <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(183,29,63,0.06)', border: '1px solid rgba(183,29,63,0.25)' }}>
                <p className="text-sm mb-2" style={{ color: 'var(--brand-ink)' }}>
                  <strong>New to MailsFinder?</strong>
                </p>
                <p className="text-sm mb-3" style={{ color: 'var(--brand-ink)' }}>
                  Create an account to start finding and verifying emails today!
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setSuccess(null) // Clear success message when switching modes
                setFullName('')
                setCompany('')
                setPhone('')
              }}
              className="text-sm font-medium"
              style={{ color: 'var(--brand-ink)' }}
            >
              {isSignUp 
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"
              }
            </button>
          </div>


        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}> 
      <LoginInner />
    </Suspense>
  )
}
