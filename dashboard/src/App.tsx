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
  EMP104: 'Associate EMP104',
  'EMP-GOKUL': 'Associate Gokul (Workstation)'
}

function cleanAssociateId(id?: string | null): string {
  if (!id) return 'EMP101'
  try {
    const unquoted = decodeURIComponent(id)
    const lines = unquoted.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    const token = lines[0] || unquoted.trim()
    return token.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase() || 'EMP101'
  } catch {
    return (id || 'EMP101').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase() || 'EMP101'
  }
}

export function App() {
  const getInitialAssociateId = (): string => {
    try {
      const params = new URLSearchParams(window.location.search)
      const u = params.get('user') || params.get('associate') || params.get('associate_id')
      if (u) return cleanAssociateId(u)
      const stored = localStorage.getItem('tms_selected_associate')
      if (stored) return cleanAssociateId(stored)
    } catch (e) {}
    return 'EMP101'
  }

  const [currentView, setCurrentView] = useState<'associate' | 'supervisor' | 'claim'>('associate')
  const [selectedClaimId, setSelectedClaimId] = useState<string>('')
  const [selectedAssociateId, setSelectedAssociateId] = useState<string>(getInitialAssociateId)
  const [inspectedAssociateId, setInspectedAssociateId] = useState<string>('')
  const [isMock, setIsMock] = useState<boolean>(CONFIG.USE_MOCK)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSelectClaim = (claimId: string, associateId?: string) => {
    setSelectedClaimId(claimId)
    // Keep user's logged-in workspace identity intact; inspect teammate's claim in deep dive without identity bleed
    setInspectedAssociateId(associateId ? cleanAssociateId(associateId) : selectedAssociateId)
    setCurrentView('claim')
    showToast(`Inspecting Claim: ${claimId}${associateId ? ` (${associateId})` : ''}`)
  }

  const handleSelectAssociate = (assocId: string) => {
    const cleanId = cleanAssociateId(assocId)
    setSelectedAssociateId(cleanId)
    try {
      localStorage.setItem('tms_selected_associate', cleanId)
      const url = new URL(window.location.href)
      url.searchParams.set('user', cleanId)
      window.history.replaceState({}, '', url.toString())
    } catch (e) {}
    setCurrentView('associate')
    showToast(`Switched to Associate: ${ASSOCIATE_NAMES[cleanId] || cleanId}`)
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
        selectedAssociateId={selectedAssociateId}
        onSelectAssociate={handleSelectAssociate}
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
            associateId={inspectedAssociateId || selectedAssociateId}
            onBack={() => {
              setInspectedAssociateId('')
              setCurrentView('associate')
            }}
          />
        )}
      </main>
    </div>
  )
}

export default App
