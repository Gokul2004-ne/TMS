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

<<<<<<< HEAD
const ASSOCIATE_NAMES: Record<string, string> = {
  EMP101: 'Associate EMP101',
  EMP102: 'Associate EMP102',
  EMP103: 'Associate EMP103',
  EMP104: 'Associate EMP104',
  'EMP-GOKUL': 'Associate Gokul (Workstation)'
}

export function App() {
  const getInitialAssociateId = (): string => {
    try {
      const params = new URLSearchParams(window.location.search)
      const u = params.get('user') || params.get('associate') || params.get('associate_id')
      if (u) return u.toUpperCase().trim()
      const stored = localStorage.getItem('tms_selected_associate')
      if (stored) return stored
    } catch (e) {}
    return 'EMP101'
  }

  const [currentView, setCurrentView] = useState<'associate' | 'supervisor' | 'claim'>('associate')
=======
function AppContent() {
  const { user, isAuthenticated } = useAuth()
  const [currentView, setCurrentView] = useState<'associate' | 'supervisor' | 'leader' | 'claim'>('associate')
>>>>>>> ebecadb (frontend changed)
  const [selectedClaimId, setSelectedClaimId] = useState<string>('')
  const [selectedAssociateId, setSelectedAssociateId] = useState<string>(getInitialAssociateId)
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

  // Update data-theme on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('novaarc_tms_theme', theme)
    } catch {}
  }, [theme])

  // Sync default view with authenticated role
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
    const cleanId = assocId.toUpperCase().trim()
    setSelectedAssociateId(cleanId)
    try {
      localStorage.setItem('tms_selected_associate', cleanId)
      const url = new URL(window.location.href)
      url.searchParams.set('user', cleanId)
      window.history.replaceState({}, '', url.toString())
    } catch (e) {}
    setCurrentView('associate')
<<<<<<< HEAD
    showToast(`Switched to Associate: ${ASSOCIATE_NAMES[cleanId] || cleanId}`)
=======
    showToast(`Switched Desk to Associate ${assocId}`)
>>>>>>> ebecadb (frontend changed)
  }

  const toggleTheme = () => {
    const next = theme === 'fluenta' ? 'ember' : 'fluenta'
    setTheme(next)
    showToast(`Theme switched to ${next.charAt(0).toUpperCase() + next.slice(1)}`)
  }

  // If not logged in, show full-page LoginPage
  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => showToast('Authenticated successfully')} />
  }

  return (
    <div className={`app-container theme-${theme}`}>
      {/* Floating Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMock={isMock}
        setIsMock={setIsMock}
<<<<<<< HEAD
        associateName={associateDisplayName}
        selectedAssociateId={selectedAssociateId}
        onSelectAssociate={handleSelectAssociate}
=======
        selectedAssociateId={selectedAssociateId}
        onSelectAssociate={handleSelectAssociate}
        onOpenSimulation={() => setIsSimModalOpen(true)}
>>>>>>> ebecadb (frontend changed)
      />

      {/* Floating Vertical Sidebar (in Fluenta mode) */}
      {theme === 'fluenta' && (
        <FloatingSidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          userRole={user?.role}
          onOpenSimulation={() => setIsSimModalOpen(true)}
        />
      )}

      {/* Main Content Area */}
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

<<<<<<< HEAD
        {currentView === 'claim' && (
          <ClaimDeepDive
            initialClaimId={selectedClaimId}
            associateId={selectedAssociateId}
            onBack={() => setCurrentView('associate')}
          />
        )}
=======
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
>>>>>>> ebecadb (frontend changed)
      </main>

      {/* Floating Theme Switcher Pill (Bottom Right) */}
      <ThemeSwitcher theme={theme} onToggleTheme={toggleTheme} />

      {/* Frosted Glass Toast Notification */}
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

      {/* Global Live Simulation Modal */}
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
