import React, { useState } from 'react'
import { Navbar } from './components/Navbar'
import { AssociateDashboard } from './pages/AssociateDashboard'
import { SupervisorDashboard } from './pages/SupervisorDashboard'
import { ClaimDeepDive } from './pages/ClaimDeepDive'
import { CONFIG } from './config'

const ASSOCIATE_NAMES: Record<string, string> = {
  EMP101: 'Associate EMP101',
  EMP102: 'Associate EMP102',
  EMP103: 'Associate EMP103',
  EMP104: 'Associate EMP104'
}

export function App() {
  const [currentView, setCurrentView] = useState<'associate' | 'supervisor' | 'claim'>('associate')
  const [selectedClaimId, setSelectedClaimId] = useState<string>('')
  const [selectedAssociateId, setSelectedAssociateId] = useState<string>('EMP101')
  const [isMock, setIsMock] = useState<boolean>(CONFIG.USE_MOCK)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSelectClaim = (claimId: string) => {
    setSelectedClaimId(claimId)
    setCurrentView('claim')
    showToast(`Inspecting Timeline: ${claimId}`)
  }

  const handleSelectAssociate = (assocId: string) => {
    setSelectedAssociateId(assocId)
    setCurrentView('associate')
    showToast(`Switched to Associate: ${ASSOCIATE_NAMES[assocId] || assocId}`)
  }

  const associateDisplayName = ASSOCIATE_NAMES[selectedAssociateId] || `Associate ${selectedAssociateId}`

  return (
    <div className="app-container">
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMock={isMock}
        setIsMock={setIsMock}
        associateName={associateDisplayName}
      />

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: 8,
          padding: '10px 18px',
          color: 'var(--text-main)',
          fontSize: '0.875rem',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span className="pulse-dot" />
          {toastMessage}
        </div>
      )}

      <main className="content-wrapper">
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

        {currentView === 'claim' && (
          <ClaimDeepDive
            initialClaimId={selectedClaimId}
            onBack={() => setCurrentView('associate')}
          />
        )}
      </main>
    </div>
  )
}

export default App
