export interface ClaimTypeDefinition {
  id: string
  short_name: string
  label: string
  category: string
  subtype: string
  channel: string
  target_minutes: number
  target_seconds: number
}

export const CLAIM_TYPES: ClaimTypeDefinition[] = [
  {
    id: 'CR_CALL',
    short_name: 'CR - Call / IVR',
    label: 'CR - Call / IVR (14 mins)',
    category: 'Claim Resubmission',
    subtype: 'Resubmit Clean Claim',
    channel: 'Call / IVR',
    target_minutes: 14,
    target_seconds: 840
  },
  {
    id: 'CR_PORTAL',
    short_name: 'CR - Review / Portal',
    label: 'CR - Review / Portal (4 mins)',
    category: 'Claim Resubmission',
    subtype: 'Resubmit Clean Claim',
    channel: 'Review / Portal',
    target_minutes: 4,
    target_seconds: 240
  },
  {
    id: 'AP_WRITTEN',
    short_name: 'AP - Review / Written',
    label: 'AP - Review / Written (18 mins)',
    category: 'Appeals Processing',
    subtype: 'Standard Claim Appeal',
    channel: 'Review / Written',
    target_minutes: 18,
    target_seconds: 1080
  },
  {
    id: 'AP_CALL',
    short_name: 'AP - Call / Conference',
    label: 'AP - Call / Conference (30 mins)',
    category: 'Appeals Processing',
    subtype: 'Complex / Peer-to-Peer Appeal',
    channel: 'Call / Conference',
    target_minutes: 30,
    target_seconds: 1800
  },
  {
    id: 'SI_CALL',
    short_name: 'SI - Call / IVR',
    label: 'SI - Call / IVR (7 mins)',
    category: 'Status Inquiry / Follow-up',
    subtype: 'Claim Status Check',
    channel: 'Call / IVR',
    target_minutes: 7,
    target_seconds: 420
  },
  {
    id: 'SI_PORTAL',
    short_name: 'SI - Review / Portal',
    label: 'SI - Review / Portal (2 mins)',
    category: 'Status Inquiry / Follow-up',
    subtype: 'Claim Status Check',
    channel: 'Review / Portal',
    target_minutes: 2,
    target_seconds: 120
  },
  {
    id: 'DM_CLINICAL',
    short_name: 'DM - Clinical / Auth',
    label: 'DM - Clinical / Auth (13 mins)',
    category: 'Denial Management',
    subtype: 'Clinical / Authorization Denial',
    channel: 'Review / Analysis',
    target_minutes: 13,
    target_seconds: 780
  },
  {
    id: 'DM_ADMIN',
    short_name: 'DM - Admin / Coding',
    label: 'DM - Admin / Coding (8 mins)',
    category: 'Denial Management',
    subtype: 'Administrative / Coding Denial',
    channel: 'Review / Correction',
    target_minutes: 8,
    target_seconds: 480
  },
  {
    id: 'PPA_POSTING',
    short_name: 'PPA - Review / Posting',
    label: 'PPA - Review / Posting (3 mins)',
    category: 'Payment Posting & Adjustments',
    subtype: 'Contractual Adjustment / Write-off',
    channel: 'Review / Posting',
    target_minutes: 3,
    target_seconds: 180
  },
  {
    id: 'RO_DISPUTE',
    short_name: 'RO - Review / Dispute',
    label: 'RO - Review / Dispute (13 mins)',
    category: 'Refunds & Overpayments',
    subtype: 'Refund Processing / Dispute',
    channel: 'Review / Correspondence',
    target_minutes: 13,
    target_seconds: 780
  }
]

export const DEFAULT_CLAIM_TYPE = CLAIM_TYPES[0]

export const getClaimTypeByShort = (shortName?: string): ClaimTypeDefinition => {
  if (!shortName) return DEFAULT_CLAIM_TYPE
  return CLAIM_TYPES.find(c => c.short_name.toLowerCase() === shortName.toLowerCase()) || DEFAULT_CLAIM_TYPE
}
