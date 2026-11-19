import React from 'react'
import { Globe, Layout, Target, Clock } from 'lucide-react'
import { ClaimTimelineDetail, TimelineEvent } from '../api/types'
import { AppBreakdownBar } from './AppBreakdownBar'
import { NvaBadge } from './NvaBadge'

interface ClaimTimelineViewProps {
  timeline: ClaimTimelineDetail
}

export const ClaimTimelineView: React.FC<ClaimTimelineViewProps> = ({ timeline }) => {
  const formatTime = (isoString: string) => {
    try {
      let s = (isoString || '').trim()
      if (!s) return '--:--:--'
      // Ensure UTC timezone marker if missing so JavaScript correctly computes IST (+05:30)
      if (!s.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
        s += 'Z'
      }
      const d = new Date(s)
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    } catch {
      return isoString
    }
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const rem = sec % 60
    return `${mins}m ${rem}s`
  }

  // Curated brand accents for healthcare applications
  const getAppTheme = (appName: string) => {
    const la = (appName || '').toLowerCase()
    if (la.includes('novaarc')) return { bg: '#eef2ff', border: '#c7d2fe', badge: '#4338ca' }
    if (la.includes('excel')) return { bg: '#f0fdf4', border: '#bbf7d0', badge: '#107c41' }
    if (la.includes('availity')) return { bg: '#f0f9ff', border: '#bae6fd', badge: '#0284c7' }
    if (la.includes('uhc') || la.includes('optum')) return { bg: '#eff6ff', border: '#bfdbfe', badge: '#2563eb' }
    if (la.includes('medicare')) return { bg: '#fffbeb', border: '#fde68a', badge: '#d97706' }
    if (la.includes('tms')) return { bg: '#faf5ff', border: '#e9d5ff', badge: '#7c3aed' }
    return { bg: '#f8fafc', border: '#e2e8f0', badge: '#475569' }
  }

  // Sort events descending so latest timestamp appears at the top
  const sortedEvents = React.useMemo(() => {
    return [...(timeline.raw_events || [])].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeB - timeA
    })
  }, [timeline.raw_events])

  // Helper to format concise defined Used For tags and resolve website & page heading universally
  const formatEventDetails = (ev: TimelineEvent) => {
    const rawUrl = (ev.url || '').toLowerCase()
    const rawTitle = (ev.window_title || '').trim()
    const rawApp = (ev.app_name || '').toLowerCase()

    let websiteName = ev.app_name || 'Application'
    let pageHeader = ev.page_header || (rawTitle ? rawTitle.split(' - ')[0].trim() : 'Operational Window')
    let usedFor = ev.used_for || 'Operational Task'

    // Verbose sentence to concise defined tag dictionary
    const VERBOSE_MAP: Record<string, string> = {
      'Monitoring real-time revenue cycle billing KPIs, collections & claim velocity': 'Revenue Cycle Velocity',
      'Searching patient claims, checking denial codes, reviewing EOBs & filing appeals': 'Claim Adjudication',
      'Reviewing prioritized high-dollar claim backlogs and assigning AR follow-ups': 'Work Queue AR',
      'Investigating root-cause denial reason codes (CO-45, PR-204) and submitting appeals': 'Denial Resolution',
      'Reconciling 835 ERA payment batches against bank deposits and contractual allowances': 'Payment Posting',
      'Automating repetitive denial appeals and clinical documentation cross-checks': 'AI Appeal Assistant',
      'Managing staff permissions, supervisor role assignments, and queue rules': 'Settings & Roles',
      'Secure role-based associate sign-in for HIPAA-compliant session tracking': 'Platform Sign-In',
      'Core accounts receivable processing, claim scrubbing, and billing management': 'Accounts Receivable',
      'Looking up allowable reimbursement rates, billing modifiers, and payer fee rules': 'Rate Lookup',
      'Verifying patient insurance coverage, copay, deductible & primary payer coordination': 'Payer Clearinghouse',
      'Reviewing real-time payer claim processing status, deductible balances, and remittances': 'Payer Adjudication',
      'Checking Medicare beneficiary eligibility, secondary claim status, and MSP billing': 'Medicare Verification',
      'Searching payer provider telephone numbers, timely filing rules, and denial guidelines': 'Payer Lookup',
      'Temporary transcription of payer call reference numbers and supervisor notes': 'Scratchpad Notes',
      'Secure provider & payer email correspondence regarding medical records': 'Payer Email',
      'Internal Team Collaboration': 'Team Consultation',
      'Reviewing Explanation of Benefits (EOB) PDFs and supporting clinical documentation': 'EOB Review',
      'Calculating patient responsibility, coinsurance percentages, and write-off amounts': 'Balance Calculation',
      'Navigating local client batch files, 835 remits, and scanning folders': 'File Directory',
      'Payer portal verification and cross-application claim reference research': 'Reference Research',
      'Tracking personal shift target progress, AHT, and active claim time distribution': 'Productivity Tracking',
      'Starting associate daily shift and telemetry monitoring': 'Shift Logging',
      'Concluding associate daily shift and flushing pending claim events': 'Shift Logging',
      'General operational task execution during claim processing shift': 'Operational Task',
      'MHS & CCP': 'Claim Status'
    }

    if (VERBOSE_MAP[usedFor]) {
      usedFor = VERBOSE_MAP[usedFor]
    }

    // Strip notification badges from title like (14), [2]
    let cleanPageTitle = rawTitle.replace(/^[\(\[\{]\d+\+?[\)\]\}]\s*/, '')

    // Clean browser suffixes from page title
    for (const suffix of [
      ' - Google Chrome',
      ' - Google Chrome (Incognito)',
      ' - Google Chrome - Incognito',
      ' - Microsoft Edge',
      ' - Mozilla Firefox',
      ' - Brave',
      ' - Opera',
      ' - Vivaldi',
      ' - Chromium'
    ]) {
      if (cleanPageTitle.endsWith(suffix)) {
        cleanPageTitle = cleanPageTitle.slice(0, -suffix.length).trim()
        break
      }
    }

    const cleanUrl = (ev.url || '').split('?')[0].split('#')[0].trim()

    // Canonical domain brand dictionary
    const KNOWN_DOMAINS: Record<string, string> = {
      'mhs.net': 'Community Care Plan',
      'epiclink.mhs.net': 'Community Care Plan',
      'ccpcares.org': 'Community Care Plan',
      'communitycareplan.com': 'Community Care Plan',
      'officeally.com': 'Office Ally',
      'uhcprovider.com': 'UHC Provider Portal',
      'uhc.com': 'UnitedHealthcare',
      'optum.com': 'Optum',
      'availity.com': 'Availity Essentials',
      'athenahealth.com': 'AthenaHealth',
      'clevelandclinic.org': 'Cleveland Clinic',
      'cms.gov': 'Medicare CMS',
      'medicare.gov': 'Medicare',
      'novitas-solutions.com': 'Novitas Solutions',
      'noridianmedicare.com': 'Noridian Medicare',
      'palmettogba.com': 'Palmetto GBA',
      'humana.com': 'Humana',
      'aetna.com': 'Aetna',
      'cigna.com': 'Cigna',
      'anthem.com': 'Anthem BCBS',
      'bcbs.com': 'Blue Cross Blue Shield',
      'floridablue.com': 'Florida Blue',
      'molinahealthcare.com': 'Molina Healthcare',
      'centene.com': 'Centene',
      'carefirst.com': 'CareFirst',
      'highmark.com': 'Highmark',
      'epic.com': 'Epic Systems',
      'cerner.com': 'Cerner',
      'oraclehealth.com': 'Oracle Health',
      'webpt.com': 'WebPT',
      'kareo.com': 'Kareo',
      'eclinicalworks.com': 'eClinicalWorks',
      'nextgen.com': 'NextGen Healthcare',
      'changehealthcare.com': 'Change Healthcare',
      'waystar.com': 'Waystar',
      'zocdoc.com': 'Zocdoc',
      'doximity.com': 'Doximity',
      'mychart.org': 'MyChart',
      'github.com': 'GitHub',
      'gitlab.com': 'GitLab',
      'bitbucket.org': 'Bitbucket',
      'workday.com': 'Workday',
      'salesforce.com': 'Salesforce',
      'stripe.com': 'Stripe',
      'zendesk.com': 'Zendesk',
      'atlassian.net': 'Atlassian',
      'jira.com': 'Jira',
      'slack.com': 'Slack',
      'zoom.us': 'Zoom',
      'microsoft.com': 'Microsoft',
      'office.com': 'Microsoft 365',
      'google.com': 'Google',
      'youtube.com': 'YouTube',
      'linkedin.com': 'LinkedIn',
      'aws.amazon.com': 'AWS Console',
      'azure.com': 'Azure Portal'
    }

    let domainBrand = ''
    const pathWords: string[] = []

    if (cleanUrl) {
      try {
        const urlObj = new URL(cleanUrl.includes('://') ? cleanUrl : `https://${cleanUrl}`)
        const netloc = urlObj.hostname.toLowerCase().replace('www.', '')
        for (const [k, v] of Object.entries(KNOWN_DOMAINS)) {
          if (netloc === k || netloc.endsWith('.' + k)) {
            domainBrand = v
            break
          }
        }
        if (!domainBrand && netloc) {
          const parts = netloc.split(':')[0].split('.')
          if (parts.length >= 2) {
            const base = parts[parts.length - 2]
            domainBrand = base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          }
        }

        const segments = urlObj.pathname.split('/').filter(Boolean)
        for (const seg of segments) {
          const cleanSeg = seg.split('.')[0]
          const words = cleanSeg.replace(/[-_]/g, ' ').split(' ').filter(w => w.length > 1)
          for (const w of words) {
            pathWords.push(w.charAt(0).toUpperCase() + w.slice(1))
          }
        }
      } catch {
        // Fallback safely if URL parse fails
      }
    }

    // Title delimiter splitting
    const chunks = cleanPageTitle.split(/\s+[|:\-\u00b7\u2022\u2014\u2013]\s+|\s+::\s+|\s+-\s+/).map(c => c.trim()).filter(Boolean)

    websiteName = domainBrand || ev.app_name || 'Application'
    pageHeader = cleanPageTitle || 'Operational Window'

    if (chunks.length >= 2) {
      if (domainBrand && chunks[chunks.length - 1].toLowerCase().includes(domainBrand.toLowerCase())) {
        websiteName = chunks[chunks.length - 1]
        pageHeader = chunks.slice(0, -1).join(' - ')
      } else if (domainBrand && chunks[0].toLowerCase().includes(domainBrand.toLowerCase())) {
        websiteName = chunks[0]
        pageHeader = chunks.slice(1).join(' - ')
      } else if (chunks[chunks.length - 1].toLowerCase().match(/community care plan|novaarc|github|stripe|workday|availity|office ally/)) {
        websiteName = chunks[chunks.length - 1]
        pageHeader = chunks.slice(0, -1).join(' - ')
      } else if (chunks[0].toLowerCase().match(/novaarc|tms|community care plan|office ally|availity/)) {
        websiteName = chunks[0]
        pageHeader = chunks.slice(1).join(' - ')
      } else if (domainBrand) {
        websiteName = domainBrand
        pageHeader = chunks[0]
      } else {
        pageHeader = chunks[0]
        websiteName = chunks[chunks.length - 1]
      }
    } else if (chunks.length === 1) {
      if (domainBrand) {
        websiteName = domainBrand
        if (cleanPageTitle.toLowerCase() === domainBrand.toLowerCase() || cleanPageTitle.startsWith('http')) {
          pageHeader = pathWords.slice(0, 3).join(' ') || 'Portal Home'
        } else {
          pageHeader = cleanPageTitle
        }
      } else {
        pageHeader = cleanPageTitle
        websiteName = ev.app_name || 'Application'
      }
    }

    // Clean redundant brand from page header
    if (websiteName && pageHeader.toLowerCase().startsWith(websiteName.toLowerCase())) {
      pageHeader = pageHeader.slice(websiteName.length).replace(/^[\s\-|:\u00b7\u2022\u2014\u2013]+/, '') || pageHeader
    }
    if (!pageHeader || pageHeader.startsWith('http')) {
      pageHeader = pathWords.slice(0, 3).join(' ') || 'Portal Home'
    }

    pageHeader = pageHeader.slice(0, 45).trim()

    const lt = cleanPageTitle.toLowerCase()
    const lu = cleanUrl.toLowerCase()
    const la = (ev.app_name || '').toLowerCase()

    // Canonical Healthcare & Platform Overrides
    if (
      lu.includes('mhs.net') ||
      lu.includes('planlinkccp') ||
      lu.includes('guesteligwrapper') ||
      lu.includes('epiclink') ||
      lt.includes('community care plan') ||
      lt.includes('memorial healthcare') ||
      lt.includes('epiclink') ||
      lt.includes('ccpcares.org') ||
      la.includes('community care plan')
    ) {
      websiteName = 'Community Care Plan'
      if (
        lu.includes('guest_claims') ||
        lu.includes('claims') ||
        lu.includes('claim') ||
        lt.includes('find a claim') ||
        lt.includes('guest claims')
      ) {
        pageHeader = lt.includes('find a claim') ? 'Find a Claim' : 'Guest Claims Status'
        usedFor = 'Claim Status'
      } else if (
        lu.includes('guestelig') ||
        lu.includes('guest_elig') ||
        lu.includes('enrollment') ||
        lu.includes('elig') ||
        lt.includes('verify eligibility') ||
        lt.includes('guest eligibility') ||
        lt.includes('elig')
      ) {
        pageHeader = lt.includes('verify eligibility') ? 'Verify Eligibility' : 'Guest Eligibility Verification'
        usedFor = 'Member Eligibility'
      } else if (
        lu.includes('epic_login') ||
        lu.includes('login') ||
        lt.includes('login') ||
        lt.includes('signin')
      ) {
        pageHeader = 'EpicLink Portal Login'
        usedFor = 'Portal Login'
      } else if (
        lu.includes('provider-portal') ||
        lu.includes('provider-tools') ||
        lu.includes('planlink') ||
        lt.includes('provider portal') ||
        lt.includes('provider tools')
      ) {
        pageHeader = 'Provider Portal'
        usedFor = 'Provider Tools'
      } else if (lu.includes('dashboard') || lt.includes('dashboard')) {
        pageHeader = 'Portal Dashboard'
        usedFor = 'Operations Overview'
      }
    } else if (
      lu.includes('novaarc') ||
      lt.includes('novaarc') ||
      la.includes('novaarc') ||
      lt.includes('revenue cycle')
    ) {
      websiteName = 'NovaArc RCM'
      if (lu.includes('/dashboard') || lt.includes('dashboard')) {
        pageHeader = 'Operations Dashboard'
        usedFor = 'Operations Overview'
      } else if (lu.includes('/claims') || lt.includes('claim') || /(?:clm|claim)[-_]?\d+/i.test(lt)) {
        pageHeader = 'Claims Management'
        usedFor = 'Claim Adjudication'
      } else if (lu.includes('/work-queues') || lt.includes('queue')) {
        pageHeader = 'Priority Work Queues'
        usedFor = 'Work Queue AR'
      } else if (lu.includes('/denials') || lt.includes('denial')) {
        pageHeader = 'Denial Resolution & Appeals'
        usedFor = 'Denial Resolution'
      } else if (lu.includes('/payments') || lt.includes('payment') || lt.includes('remit')) {
        pageHeader = 'Remittance & Payment Posting'
        usedFor = 'Payment Posting'
      } else if (lu.includes('/agents') || lu.includes('/assistant') || lt.includes('assistant')) {
        pageHeader = 'AI Claim Work Assistant'
        usedFor = 'Appeal Assistant'
      } else if (lu.includes('/users') || lu.includes('/settings') || lt.includes('settings')) {
        pageHeader = 'User Management & Settings'
        usedFor = 'Settings & Roles'
      } else if (lu.includes('/login') || lt.includes('sign in') || lt.includes('login')) {
        pageHeader = 'Platform Sign-In'
        usedFor = 'Platform Sign-In'
      } else {
        pageHeader = 'Revenue Cycle Platform'
        usedFor = 'Accounts Receivable'
      }
    } else if (la.includes('tms dashboard') || lt.includes('tms dashboard') || lt.includes(':5173')) {
      websiteName = 'TMS Dashboard'
      pageHeader = 'Associate Shift Intelligence'
      usedFor = 'Productivity Tracking'
    } else if (la.includes('excel') || lt.includes('excel') || lt.includes('.xlsx') || lt.includes('.csv')) {
      websiteName = 'Microsoft Excel'
      const parts = cleanPageTitle.split(' - Excel')[0].split(' - Microsoft Excel')[0].trim()
      const sheet = parts && !parts.toLowerCase().startsWith('excel') ? parts : 'Payer Fee Schedule'
      pageHeader = `${sheet} Worksheet`
      usedFor = 'Rate Lookup'
    } else if (la.includes('notepad') || lt.includes('notepad')) {
      websiteName = 'Notepad'
      pageHeader = 'Operational Scratchpad Notes'
      usedFor = 'Scratchpad Notes'
    } else if (la.includes('outlook') || lt.includes('outlook')) {
      websiteName = 'Microsoft Outlook'
      pageHeader = 'Provider & Payer Communications'
      usedFor = 'Payer Email'
    } else if (la.includes('teams') || lt.includes('teams')) {
      websiteName = 'Microsoft Teams'
      pageHeader = 'Internal Team Collaboration'
      usedFor = 'Team Consultation'
    } else if (la.includes('calc') || lt.includes('calc') || la.includes('calculator')) {
      websiteName = 'Calculator'
      pageHeader = 'Coinsurance / Balance Calculation'
      usedFor = 'Balance Calculation'
    } else if (la.includes('explorer') || lt.includes('file explorer')) {
      websiteName = 'File Explorer'
      pageHeader = 'Document Directory'
      usedFor = 'File Directory'
    }

    // Universal 27-Category Semantic Purpose Engine (Strictly 1 to 3 words)
    if (!usedFor || usedFor === 'Operational Task' || usedFor === 'MHS & CCP' || usedFor === 'Reference Research') {
      const evalText = `${cleanUrl} ${websiteName} ${pageHeader} ${cleanPageTitle}`.toLowerCase()

      if (evalText.includes('youtube') || evalText.includes('vimeo') || domainBrand === 'YouTube' || domainBrand === 'Vimeo') {
        usedFor = 'Media Playback'
      } else if (evalText.match(/guest_claims|find a claim|claim status|claim adjudication|claims|claim|clm|remittance|remit|adjudic|835|837|cms-1500|ub-04|eob/)) {
        usedFor = evalText.match(/status|find|guest_claims|tracking/) ? 'Claim Status' : 'Claim Adjudication'
      } else if (evalText.match(/guestelig|guest_elig|eligib|member eligibility|verify eligibility|enroll|coverage|benefit|subscriber|copay|deductible/)) {
        usedFor = 'Member Eligibility'
      } else if (evalText.match(/prior-auth|prior auth|preauth|pre-auth|authorization|precert|referral/)) {
        usedFor = 'Prior Authorization'
      } else if (evalText.match(/denial|appeal|dispute|grievance|reconsideration|underpayment|co-45|pr-204/)) {
        usedFor = 'Denial Resolution'
      } else if (evalText.match(/payment|posting|invoice|invoicing|billing|deposit|stripe|checkout/)) {
        usedFor = evalText.match(/post|deposit|remit/) ? 'Payment Posting' : 'Billing & Invoicing'
      } else if (evalText.match(/patient record|patient chart|patient|ehr|emr|clinical|medical record|mychart/)) {
        usedFor = 'Patient Records'
      } else if (evalText.match(/schedule|scheduling|appointment|calendar|booking|visit slot|zocdoc/)) {
        usedFor = 'Patient Scheduling'
      } else if (evalText.match(/pharmacy|formulary|prescription|rx|drug|medication/)) {
        usedFor = 'Drug Formulary'
      } else if (evalText.match(/diagnostic|pathology|radiology|imaging|lab result|specimen|test result/)) {
        usedFor = 'Diagnostic Results'
      } else if (evalText.match(/work queue|workqueue|work-queue|work item|priority queue|queue|backlog|todo|task list|workday/)) {
        usedFor = 'Work Queue AR'
      } else if (evalText.match(/dashboard|revenue cycle velocity|velocity|kpi|metric|overview|summary/)) {
        usedFor = 'Operations Overview'
      } else if (evalText.match(/clearinghouse|edi|availity|office ally|gateway/)) {
        usedFor = 'Payer Clearinghouse'
      } else if (evalText.match(/provider-portal|provider portal|provider tools|practitioner|credential|npi/)) {
        usedFor = 'Provider Tools'
      } else if (evalText.match(/policy|guideline|manual|fee schedule|reimbursement rate|rate lookup|allowable/)) {
        usedFor = evalText.match(/rate|fee schedule|allowable/) ? 'Rate Lookup' : 'Payer Guidelines'
      } else if (evalText.match(/login|signin|sign in|sign-in|log in|auth|sso|2fa|mfa/)) {
        usedFor = 'Portal Login'
      } else if (evalText.match(/setting|preference|user management|role|permission|security config|admin/)) {
        usedFor = 'Settings & Roles'
      } else if (evalText.match(/google search|bing search|search|lookup/)) {
        usedFor = evalText.match(/google|bing|payer/) ? 'Payer Lookup' : 'Directory Lookup'
      } else if (evalText.match(/outlook|gmail|mail|email|inbox|message|correspondence/)) {
        usedFor = 'Messaging & Email'
      } else if (evalText.match(/teams|slack|zoom|meeting|huddle|consultation|chat/)) {
        usedFor = 'Team Consultation'
      } else if (evalText.match(/github|gitlab|bitbucket|commit|pull request|pulls|repository|branch|code/)) {
        usedFor = 'Version Control'
      } else if (evalText.match(/documentation|docs|api|developer|sdk|swagger|reference/)) {
        usedFor = 'Technical Documentation'
      } else if (evalText.match(/support|helpdesk|help desk|faq|ticket|service desk|zendesk/)) {
        usedFor = 'Customer Support'
      } else if (evalText.match(/excel|spreadsheet|worksheet|calculator|calc/)) {
        usedFor = evalText.includes('calc') ? 'Balance Calculation' : 'Data Analysis'
      } else if (evalText.match(/notepad|notes|scratchpad/)) {
        usedFor = 'Scratchpad Notes'
      } else if (evalText.match(/file explorer|explorer|folder|directory/)) {
        usedFor = 'File Directory'
      } else {
        const pathStr = pathWords.join(' ')
        const rawWords = `${pageHeader} ${pathStr}`.match(/[a-zA-Z]{3,}/g) || []
        const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'page', 'portal', 'site', 'view', 'window', 'home', 'main', 'online'])
        const meaningful = rawWords.filter(w => !stopWords.has(w.toLowerCase())).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        if (meaningful.length >= 2) {
          usedFor = `${meaningful[0]} ${meaningful[1]}`
        } else if (meaningful.length === 1) {
          usedFor = `${meaningful[0]} Review`
        } else {
          usedFor = 'Operational Task'
        }
      }
    }

    // Enforce strictly 1 to 3 words
    const words = usedFor.trim().split(/\s+/)
    if (words.length > 3) {
      usedFor = words.slice(0, 3).join(' ')
    } else if (words.length === 0 || !usedFor) {
      usedFor = 'Operational Task'
    }

    return { websiteName, pageHeader, usedFor }
  }

  return (
    <div className="glass-card" style={{ marginBottom: 24, background: '#ffffff' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 16,
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-main)'
          }}>
            {timeline.claim_id}
          </div>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            padding: '2px 8px',
            background: timeline.status === 'COMPLETED' ? '#f0fdf4' : '#fffbeb',
            color: timeline.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            border: `1px solid ${timeline.status === 'COMPLETED' ? '#bbf7d0' : '#fde68a'}`
          }}>
            {timeline.status}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {timeline.nva_flags.map((f, i) => (
              <NvaBadge key={i} flag={f} />
            ))}
          </div>
        </div>

        {/* Quick summary stats */}
        <div style={{ display: 'flex', gap: 20, fontSize: '0.8125rem' }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Total Duration: </span>
            <strong style={{ color: 'var(--text-main)' }}>{formatDuration(timeline.total_duration_seconds)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Active: </span>
            <strong style={{ color: 'var(--accent-emerald)' }}>{formatDuration(timeline.active_duration_seconds)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Idle: </span>
            <strong style={{ color: 'var(--accent-amber)' }}>{formatDuration(timeline.idle_duration_seconds)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>App Switches: </span>
            <strong style={{ color: '#4338ca' }}>{timeline.app_switches_count}</strong>
          </div>
        </div>
      </div>

      {/* App Breakdown Bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
          Application Time Distribution
        </div>
        <AppBreakdownBar items={timeline.app_breakdowns} height={12} />
      </div>

      {/* Event Stream Timeline */}
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
          Chronological Event Sequence ({timeline.raw_events.length} captured events - Latest on Top)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedEvents.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              No events recorded for this claim yet.
            </div>
          ) : (
            sortedEvents.map((ev, idx) => {
              const { websiteName, pageHeader, usedFor } = formatEventDetails(ev)
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: ev.is_idle ? '#fef2f2' : idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.8125rem',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    {/* Timestamp */}
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {formatTime(ev.timestamp)}
                    </span>

                    {/* Event Type Badge */}
                    <span style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      textTransform: 'uppercase',
                      background: ev.event_type.includes('IDLE') ? '#fef2f2' : '#eef2ff',
                      color: ev.event_type.includes('IDLE') ? 'var(--accent-rose)' : '#4338ca',
                      border: `1px solid ${ev.event_type.includes('IDLE') ? '#fecaca' : '#c7d2fe'}`,
                      whiteSpace: 'nowrap'
                    }}>
                      {ev.event_type}
                    </span>

                    {/* Format: Website Name | Page/ sub-page Heading | Used for */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      <strong style={{ color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {websiteName}
                      </strong>

                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>|</span>

                      <span
                        style={{
                          color: '#334155',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 380
                        }}
                        title={pageHeader}
                      >
                        {pageHeader}
                      </span>

                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>|</span>

                      <span style={{
                        color: '#065f46',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '1px 6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>
                        {usedFor}
                      </span>
                    </div>
                  </div>

                  {ev.is_idle && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--accent-amber)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      IDLE DETECTED
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
