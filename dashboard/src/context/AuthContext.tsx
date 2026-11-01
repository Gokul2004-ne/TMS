import React, { createContext, useContext, useState, useEffect } from 'react'

export type UserRole = 'employee' | 'manager' | 'leader'

export interface User {
  id: string
  name: string
  role: UserRole
  title: string
  team: string
  avatar: string
}

export const PRESET_USERS: Record<string, User> = {
  EMP101: {
    id: 'EMP101',
    name: 'Priya Sharma',
    role: 'employee',
    title: 'Lead AR Specialist',
    team: 'Claims Adjudication Team Alpha',
    avatar: 'PS'
  },
  EMP102: {
    id: 'EMP102',
    name: 'Marcus Chen',
    role: 'employee',
    title: 'Senior Claims Associate',
    team: 'Denial Resolution Team Beta',
    avatar: 'MC'
  },
  EMP103: {
    id: 'EMP103',
    name: 'Aaliyah Patel',
    role: 'employee',
    title: 'Billing & Denial Analyst',
    team: 'Claims Adjudication Team Alpha',
    avatar: 'AP'
  },
  EMP104: {
    id: 'EMP104',
    name: 'David Kim',
    role: 'employee',
    title: 'Claims Adjudicator',
    team: 'High-Dollar Claims Team',
    avatar: 'DK'
  },
  MGR101: {
    id: 'MGR101',
    name: 'Sarah Jenkins',
    role: 'manager',
    title: 'Claims Operations Supervisor',
    team: 'Operations Team Alpha',
    avatar: 'SJ'
  },
  MGR102: {
    id: 'MGR102',
    name: 'Robert Vance',
    role: 'manager',
    title: 'Team Lead - Denial Mgmt',
    team: 'Operations Team Beta',
    avatar: 'RV'
  },
  LEADER01: {
    id: 'LEADER01',
    name: 'Eleanor Vance',
    role: 'leader',
    title: 'VP of Revenue Cycle Operations',
    team: 'Executive Leadership',
    avatar: 'EV'
  }
}

interface AuthContextType {
  user: User | null
  login: (userId: string, role?: UserRole) => boolean
  logout: () => void
  switchUser: (userId: string) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'novaarc_tms_auth_user'

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
    // Default to EMP101 for quick access or null for login prompt
    return PRESET_USERS.EMP101
  })

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // ignore storage errors
    }
  }, [user])

  const login = (userId: string, role?: UserRole): boolean => {
    const cleanId = userId.trim().toUpperCase()
    if (PRESET_USERS[cleanId]) {
      setUser(PRESET_USERS[cleanId])
      return true
    }

    // Dynamic user creation if not a preset
    const assignedRole = role || (cleanId.startsWith('MGR') ? 'manager' : cleanId.startsWith('LEAD') ? 'leader' : 'employee')
    const newUser: User = {
      id: cleanId,
      name: `User ${cleanId}`,
      role: assignedRole,
      title: assignedRole === 'leader' ? 'Executive Director' : assignedRole === 'manager' ? 'Supervisor' : 'Associate',
      team: 'RCM Operations',
      avatar: cleanId.slice(0, 2)
    }
    setUser(newUser)
    return true
  }

  const logout = () => {
    setUser(null)
  }

  const switchUser = (userId: string) => {
    const cleanId = userId.trim().toUpperCase()
    if (PRESET_USERS[cleanId]) {
      setUser(PRESET_USERS[cleanId])
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
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

