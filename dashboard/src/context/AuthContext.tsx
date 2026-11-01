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

interface AuthContextType {
  user: User | null
  token: string | null
  login: (userId: string, role?: UserRole, password?: string) => Promise<boolean>
  logout: () => void
  switchUser: (userId: string) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'novaarc_tms_auth_user'
const TOKEN_KEY = 'novaarc_tms_auth_token'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // fallback to null
    }
    return PRESET_USERS.EMP101
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

  const login = async (userId: string, role?: UserRole, password: string = 'demo1234'): Promise<boolean> => {
    const cleanId = userId.trim().toUpperCase()

    // 1. Try real backend login API
    try {
      const res = await api.login(cleanId, password, role)
      if (res && res.user) {
        const u = res.user
        const mappedRole = (u.role === 'manager' || u.role === 'leader' || u.role === 'employee') ? u.role : (role || 'employee')
        const authedUser: User = {
          id: u.id,
          name: u.name,
          role: mappedRole,
          title: u.title || (mappedRole === 'leader' ? 'VP of RCM Operations' : mappedRole === 'manager' ? 'Supervisor' : 'Associate'),
          team: u.team || 'RCM Operations',
          avatar: u.avatar || cleanId.slice(0, 2),
          email: u.email
        }
        setUser(authedUser)
        setToken(res.token || `tms_token_${cleanId}`)
        return true
      }
    } catch (err) {
      console.warn('[AUTH] Backend auth failed, using local fallback:', err)
    }

    // 2. Preset User Fallback (e.g. offline / GitHub Pages)
    if (PRESET_USERS[cleanId]) {
      setUser(PRESET_USERS[cleanId])
      setToken(`tms_token_${cleanId}`)
      return true
    }

    // 3. Dynamic user creation fallback
    const assignedRole = role || (cleanId.startsWith('MGR') ? 'manager' : cleanId.startsWith('LEAD') ? 'leader' : 'employee')
    const newUser: User = {
      id: cleanId,
      name: `User ${cleanId}`,
      role: assignedRole,
      title: assignedRole === 'leader' ? 'Executive Director' : assignedRole === 'manager' ? 'Supervisor' : 'Associate',
      team: 'RCM Operations',
      avatar: cleanId.slice(0, 2),
      email: `${cleanId.toLowerCase()}@novaarc-rcm.com`
    }
    setUser(newUser)
    setToken(`tms_token_${cleanId}`)
    return true
  }

  const logout = () => {
    setUser(null)
    setToken(null)
  }

  const switchUser = (userId: string) => {
    const cleanId = userId.trim().toUpperCase()
    if (PRESET_USERS[cleanId]) {
      setUser(PRESET_USERS[cleanId])
      setToken(`tms_token_${cleanId}`)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
