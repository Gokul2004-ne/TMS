import React, { useState } from 'react'
import { Navbar } from './components/Navbar'
import { AssociateDashboard } from './pages/AssociateDashboard'
import { SupervisorDashboard } from './pages/SupervisorDashboard'
import { ClaimDeepDive } from './pages/ClaimDeepDive'
import { CONFIG } from './config'

export function App() {
  const [currentView, setCurrentView] = useState<'associate' | 'supervisor' | 'claim'>('associate')
  const [selectedClaimId, setSelectedClaimId] = useState<string>('CLM1026')
  const [isMock, setIsMock] = useState<boolean>(CONFIG.USE_MOCK)

  const handleSelectClaim = (claimId: string) => {
    setSelectedClaimId(claimId)
    setCurrentView('claim')
  }

  return (
    <div className="app-container">
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        isMock={isMock}
        setIsMock={setIsMock}
        associateName="Priya Sharma (EMP101)"
      />

      <main className="content-wrapper">
        {currentView === 'associate' && (
          <AssociateDashboard onSelectClaim={handleSelectClaim} />
        )}

        {currentView === 'supervisor' && (
          <SupervisorDashboard />
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
