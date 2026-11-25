import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/client'

export type UserRole = 'employee' | 'manager' | 'leader'

export interface User {
  id: string
  name: string
  role: UserRole
  title: string
  team: string
  avatar: string
  email?: string
}

export const PRESET_USERS: Record<string, User> = {
  EMP101: {
    id: 'EMP101',
    name: 'Priya Sharma',
    role: 'employee',
    title: 'Lead AR Specialist',
    team: 'Claims Adjudication Team Alpha',
    avatar: 'PS',
    email: 'priya.sharma@novaarc-rcm.com'
  },
  EMP102: {
    id: 'EMP102',
    name: 'Marcus Chen',
    role: 'employee',
    title: 'Senior Claims Associate',
    team: 'Denial Resolution Team Beta',
    avatar: 'MC',
    email: 'marcus.chen@novaarc-rcm.com'
  },
  EMP103: {
    id: 'EMP103',
    name: 'Aaliyah Patel',
    role: 'employee',
    title: 'Billing & Denial Analyst',
    team: 'Claims Adjudication Team Alpha',
    avatar: 'AP',
    email: 'aaliyah.patel@novaarc-rcm.com'
  },
  EMP104: {
    id: 'EMP104',
    name: 'David Kim',
    role: 'employee',
    title: 'Claims Adjudicator',
    team: 'High-Dollar Claims Team',
    avatar: 'DK',
    email: 'david.kim@novaarc-rcm.com'
  },
  MGR101: {
    id: 'MGR101',
    name: 'Sarah Jenkins',
    role: 'manager',
    title: 'Claims Operations Supervisor',
    team: 'Operations Team Alpha',
    avatar: 'SJ',
    email: 'sarah.jenkins@novaarc-rcm.com'
  },
  MGR102: {
    id: 'MGR102',
    name: 'Robert Vance',
    role: 'manager',
    title: 'Team Lead - Denial Mgmt',
    team: 'Operations Team Beta',
    avatar: 'RV',
    email: 'robert.vance@novaarc-rcm.com'
  },
  LEADER01: {
    id: 'LEADER01',
    name: 'Eleanor Vance',
    role: 'leader',
    title: 'VP of Revenue Cycle Operations',
    team: 'Executive Leadership',
    avatar: 'EV',
    email: 'eleanor.vance@novaarc-rcm.com'
  }
}

export interface LoginResult {
  ok: boolean
  error?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  workstationId: string
  activeSessionId: string | null
  authNotice: string | null
  clearAuthNotice: () => void
  login: (userId: string, role?: UserRole, password?: string, deviceOverride?: string) => Promise<LoginResult>
  logout: () => void
  switchUser: (userId: string) => Promise<LoginResult>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'novaarc_tms_auth_user'
const TOKEN_KEY = 'novaarc_tms_auth_token'
const DEVICE_KEY = 'tms_workstation_device_id'
const SESSION_KEY = 'tms_workstation_session_id'
const SESSION_BROWSER_OWNED_KEY = 'tms_workstation_session_browser_owned'

function normalizeDeviceId(raw?: string | null): string {
  const clean = (raw || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return clean.slice(0, 8)
}

export function getOrCreateWorkstationDeviceId(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = normalizeDeviceId(params.get('device'))
    if (fromUrl.length >= 6) {
      localStorage.setItem(DEVICE_KEY, fromUrl)
      return fromUrl
    }
    const stored = normalizeDeviceId(localStorage.getItem(DEVICE_KEY))
    if (stored.length >= 6) {
      return stored
    }
    const generated = (Math.random().toString(16).slice(2) + Date.now().toString(16)).replace(/[^a-z0-9]/g, '').slice(0, 8)
    localStorage.setItem(DEVICE_KEY, generated)
    return generated
  } catch {
    return 'web00001'
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workstationId, setWorkstationId] = useState<string>(() => getOrCreateWorkstationDeviceId())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })
  const [browserOwnedSession, setBrowserOwnedSession] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SESSION_BROWSER_OWNED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // fallback to null
    }
    return null
  })

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      if (token) {
        localStorage.setItem(TOKEN_KEY, token)
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    } catch {
      // ignore storage errors
    }
  }, [user, token])

  const login = async (
    userId: string,
    role?: UserRole,
    password: string = 'demo1234',
    deviceOverride?: string
  ): Promise<LoginResult> => {
    const cleanId = userId.trim().toUpperCase()
    if (!cleanId) {
      return { ok: false, error: 'Please enter a valid Employee ID.' }
    }

    const myDev = normalizeDeviceId(deviceOverride) || workstationId || getOrCreateWorkstationDeviceId()
    if (myDev && myDev !== workstationId) {
      setWorkstationId(myDev)
      try {
        localStorage.setItem(DEVICE_KEY, myDev)
      } catch {}
    }

    let backendAuthRes: any = null
    const inferredRole: UserRole =
      role || (cleanId.startsWith('MGR') ? 'manager' : cleanId.startsWith('LEAD') ? 'leader' : 'employee')

    // 1. Try real backend login API (respects HTTP 409 lock conflicts immediately)
    try {
      backendAuthRes = await api.login(cleanId, password, role, myDev)
    } catch (err: any) {
      const msg = err?.message || `Login blocked for ${cleanId}.`
      return { ok: false, error: msg }
    }

    const effectiveRole: UserRole =
      backendAuthRes?.user?.role === 'manager' || backendAuthRes?.user?.role === 'leader' || backendAuthRes?.user?.role === 'employee'
        ? backendAuthRes.user.role
        : inferredRole

    // 2. Enforce live workstation lock for Employee logins (works against live Hostinger today)
    let resolvedSessId: string | null = backendAuthRes?.session_id || null
    let isOwnedByBrowser = false
    if (effectiveRole === 'employee') {
      const lockCheck = await api.checkWorkstationLock(cleanId, myDev)
      if (lockCheck.locked) {
        return {
          ok: false,
          error: lockCheck.reason || `Employee ${cleanId} is already logged in on workstation DEV-${lockCheck.ownerDevice || 'OTHER'}.`
        }
      }

      if (lockCheck.existingSameDeviceSessionId) {
        resolvedSessId = lockCheck.existingSameDeviceSessionId
        isOwnedByBrowser = false
      } else {
        const assocTag = cleanId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'emp'
        if (!resolvedSessId) {
          resolvedSessId = `sess-${assocTag}-d${myDev}-t${Math.floor(Date.now() / 1000)}`
        }
        try {
          await api.startWorkstationSession(cleanId, resolvedSessId, myDev)
          await api.sendWorkstationHeartbeat(cleanId, resolvedSessId, myDev)
          isOwnedByBrowser = true
        } catch (err: any) {
          if (err?.isLockConflict) {
            return { ok: false, error: err.message }
          }
        }
      }
    }

    // Release any previous employee session if switching cleanly on this workstation
    if (user && user.id !== cleanId && user.role === 'employee' && browserOwnedSession) {
      api.endWorkstationSession(user.id, activeSessionId, myDev).catch(() => {})
    }

    let authedUser: User
    let issuedToken = backendAuthRes?.token || `tms_token_${cleanId}`

    if (backendAuthRes && backendAuthRes.user) {
      const u = backendAuthRes.user
      authedUser = {
        id: u.id,
        name: u.name,
        role: effectiveRole,
        title: u.title || (effectiveRole === 'leader' ? 'VP of RCM Operations' : effectiveRole === 'manager' ? 'Supervisor' : 'Associate'),
        team: u.team || 'RCM Operations',
        avatar: u.avatar || cleanId.slice(0, 2),
        email: u.email
      }
    } else if (PRESET_USERS[cleanId]) {
      authedUser = PRESET_USERS[cleanId]
    } else {
      authedUser = {
        id: cleanId,
        name: `User ${cleanId}`,
        role: effectiveRole,
        title: effectiveRole === 'leader' ? 'Executive Director' : effectiveRole === 'manager' ? 'Supervisor' : 'Associate',
        team: 'RCM Operations',
        avatar: cleanId.slice(0, 2),
        email: `${cleanId.toLowerCase()}@novaarc-rcm.com`
      }
    }

    setAuthNotice(null)
    setActiveSessionId(resolvedSessId)
    setBrowserOwnedSession(isOwnedByBrowser)
    try {
      if (resolvedSessId) localStorage.setItem(SESSION_KEY, resolvedSessId)
      else localStorage.removeItem(SESSION_KEY)
      localStorage.setItem(SESSION_BROWSER_OWNED_KEY, isOwnedByBrowser ? 'true' : 'false')
    } catch {}

    setUser(authedUser)
    setToken(issuedToken)
    return { ok: true }
  }

  // Handle Desktop Agent deep-link launch (?user=EMP102&device=a1b2c3d4) & verify cached session lock
  useEffect(() => {
    let urlUser: string | null = null
    let urlDevice: string | null = null
    try {
      const params = new URLSearchParams(window.location.search)
      const u = params.get('user') || params.get('associate') || params.get('associate_id')
      const d = params.get('device')
      if (u && u.trim()) urlUser = u.trim().toUpperCase()
      if (d && d.trim()) urlDevice = normalizeDeviceId(d)
    } catch {}

    if (urlUser) {
      const roleHint: UserRole = urlUser.startsWith('MGR') ? 'manager' : urlUser.startsWith('LEAD') ? 'leader' : 'employee'
      login(urlUser, roleHint, 'demo1234', urlDevice || undefined).then(res => {
        if (!res.ok) {
          setUser(null)
          setToken(null)
          setAuthNotice(res.error || `${urlUser} is currently locked on another workstation.`)
        }
        try {
          window.history.replaceState({}, '', window.location.pathname + window.location.hash)
        } catch {}
      })
      return
    }

    if (user && user.role === 'employee') {
      api.checkWorkstationLock(user.id, workstationId).then(lockRes => {
        if (lockRes.locked) {
          setUser(null)
          setToken(null)
          setActiveSessionId(null)
          setBrowserOwnedSession(false)
          setAuthNotice(lockRes.reason || `Signed out: ${user.id} is active on another workstation.`)
        }
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep browser-created employee login locks alive across slow claim selections
  useEffect(() => {
    if (!user || user.role !== 'employee' || !activeSessionId || !browserOwnedSession) return
    const timer = window.setInterval(() => {
      api.sendWorkstationHeartbeat(user.id, activeSessionId, workstationId)
    }, 120000)
    return () => window.clearInterval(timer)
  }, [user, activeSessionId, browserOwnedSession, workstationId])

  const logout = () => {
    const prevUser = user
    const prevSess = activeSessionId
    setUser(null)
    setToken(null)
    setActiveSessionId(null)
    setBrowserOwnedSession(false)
    try {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(SESSION_BROWSER_OWNED_KEY)
    } catch {}
    if (prevUser) {
      api.endWorkstationSession(prevUser.id, prevSess, workstationId).catch(() => {})
    }
  }

  const switchUser = async (userId: string): Promise<LoginResult> => {
    return login(userId)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        workstationId,
        activeSessionId,
        authNotice,
        clearAuthNotice: () => setAuthNotice(null),
        login,
        logout,
        switchUser,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
