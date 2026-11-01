import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navbar } from './components/Navbar'
import { AssociateDashboard } from './pages/AssociateDashboard'
import { SupervisorDashboard } from './pages/SupervisorDashboard'
import { LeaderDashboard } from './pages/LeaderDashboard'
import { ClaimDeepDive } from './pages/ClaimDeepDive'
import { LoginPage } from './pages/LoginPage'
import { ThemeSwitcher, ThemeMode } from './components/ThemeSwitcher'
import { FloatingSidebar } from './components/FloatingSidebar'
import { LiveSimulationModal } from './components/LiveSimulationModal'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CONFIG } from './config'

function AppContent() {
  const { user, isAuthenticated } = useAuth()
  const [currentView, setCurrentView] = useState<'associate' | 'supervisor' | 'leader' | 'claim'>('associate')
  const [selectedClaimId, setSelectedClaimId] = useState<string>('')
  const [selectedAssociateId, setSelectedAssociateId] = useState<string>('EMP101')
  const [isMock, setIsMock] = useState<boolean>(CONFIG.USE_MOCK)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('novaarc_tms_theme')
      if (stored === 'ember' || stored === 'fluenta') return stored
    } catch {}
    return 'fluenta'
  })
  const [isSimModalOpen, setIsSimModalOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('novaarc_tms_theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    if (user) {
      if (user.role === 'leader') {
        setCurrentView('leader')
      } else if (user.role === 'manager') {
        setCurrentView('supervisor')
      } else {
        setCurrentView('associate')
        if (user.id.startsWith('EMP')) {
          setSelectedAssociateId(user.id)
        }
      }
    }
  }, [user])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3200)
  }

  const handleSelectClaim = (claimId: string) => {
    setSelectedClaimId(claimId)
    setCurrentView('claim')
    showToast(`Inspecting Claim: ${claimId}`)
  }

  const handleSelectAssociate = (assocId: string) => {
    setSelectedAssociateId(assocId)
    setCurrentView('associate')
    showToast(`Switched Desk to Associate ${assocId}`)
  }

  const toggleTheme = () => {
    const next = theme === 'fluenta' ? 'ember' : 'fluenta'
    setTheme(next)
    showToast(`Theme switched to ${next.charAt(0).toUpperCase() + next.slice(1)}`)
  }

  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => showToast('Authenticated successfully')} />
  }

  return (
    <div className={`app-container theme-${theme}`}>
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMock={isMock}
        setIsMock={setIsMock}
        selectedAssociateId={selectedAssociateId}
        onSelectAssociate={handleSelectAssociate}
        onOpenSimulation={() => setIsSimModalOpen(true)}
      />

      {theme === 'fluenta' && (
        <FloatingSidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          userRole={user?.role}
          onOpenSimulation={() => setIsSimModalOpen(true)}
        />
      )}

      <main
        className="content-wrapper"
        style={{
          paddingLeft: theme === 'fluenta' ? '92px' : '32px',
          transition: 'padding-left 0.25s ease'
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView + selectedAssociateId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {currentView === 'associate' && (
              <AssociateDashboard
                associateId={selectedAssociateId}
                onSelectClaim={handleSelectClaim}
              />
            )}

            {currentView === 'supervisor' && (
              <SupervisorDashboard
                onSelectAssociate={handleSelectAssociate}
              />
            )}

            {currentView === 'leader' && (
              <LeaderDashboard
                onSelectManager={(mgrId) => {
                  setCurrentView('supervisor')
                  showToast(`Viewing Team for ${mgrId}`)
                }}
              />
            )}

            {currentView === 'claim' && (
              <ClaimDeepDive
                initialClaimId={selectedClaimId}
                onBack={() => setCurrentView('associate')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <ThemeSwitcher theme={theme} onToggleTheme={toggleTheme} />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              position: 'fixed',
              bottom: 84,
              right: 24,
              background: 'rgba(24, 23, 28, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 14,
              padding: '10px 18px',
              color: '#ffffff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981'
              }}
            />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <LiveSimulationModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        associateId={selectedAssociateId}
        claimId={selectedClaimId || 'CLM-9021'}
        onCompleteSimulation={(cid) => {
          showToast(`Simulation complete: ${cid} completed & recorded`)
        }}
      />
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
