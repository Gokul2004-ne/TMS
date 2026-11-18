import React, { useState, Suspense, lazy } from 'react'
import { Navbar } from './components/Navbar'
import { CONFIG } from './config'
import { invalidateApiCache } from './api/client'

const AssociateDashboard = lazy(() => import('./pages/AssociateDashboard').then(m => ({ default: m.AssociateDashboard })))
const SupervisorDashboard = lazy(() => import('./pages/SupervisorDashboard').then(m => ({ default: m.SupervisorDashboard })))
const ClaimDeepDive = lazy(() => import('./pages/ClaimDeepDive').then(m => ({ default: m.ClaimDeepDive })))

function DashboardSkeleton() {
  return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 48, background: '#f1f5f9', borderRadius: 4, width: '100%', animation: 'pulse 1.5s infinite' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div style={{ height: 110, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }} />
        <div style={{ height: 110, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }} />
        <div style={{ height: 110, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }} />
        <div style={{ height: 110, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }} />
      </div>
      <div style={{ height: 320, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4 }} />
    </div>
  )
}

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
  const [isMock, setIsMock] = useState<boolean>(CONFIG.USE_MOCK)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSelectClaim = (claimId: string, associateId?: string) => {
    setSelectedClaimId(claimId)
    if (associateId) {
      setSelectedAssociateId(associateId)
    }
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

  const handleToggleMock = (next: boolean) => {
    CONFIG.USE_MOCK = next
    setIsMock(next)
    invalidateApiCache()
    showToast(`Switched to ${next ? 'Mock Fixtures' : 'Live Production Backend'}`)
  }

  const associateDisplayName = ASSOCIATE_NAMES[selectedAssociateId] || `Associate ${selectedAssociateId}`

  return (
    <div className="app-container" spellCheck={false} data-gramm="false" data-quillbot-element="false">
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMock={isMock}
        setIsMock={handleToggleMock}
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

      <main className="content-wrapper" key={`${isMock ? 'mock' : 'live'}__${selectedAssociateId}`}>
        <Suspense fallback={<DashboardSkeleton />}>
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
              associateId={selectedAssociateId}
              onBack={() => setCurrentView('associate')}
            />
          )}
        </Suspense>
      </main>
    </div>
  )
}

export default App
