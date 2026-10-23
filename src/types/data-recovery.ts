export type RecoveryFileState = 'missing' | 'valid' | 'invalid' | 'unreadable'

export interface RecoveryDataSummary {
  groupCount: number
  itemCount: number
  categoryCount: number
}

export interface RecoveryFileInfo {
  fileName: string
  state: RecoveryFileState
  summary?: RecoveryDataSummary
  error?: string
}

export interface AppDataRecoveryStatus {
  main: RecoveryFileInfo
  backup: RecoveryFileInfo
  temp: RecoveryFileInfo
}

export type RecoverySource = 'backup' | 'temp'
