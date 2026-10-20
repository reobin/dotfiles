export type Pr = {
  number: number
  url: string
  state: 'open' | 'draft' | 'merged' | 'closed'
  review: 'approved' | 'changes requested' | null
  conflicts: boolean
  ticket: string | null
}

export type Ticket = { key: string; url: string | null; status: string | null; statusType: string | null }

declare module 'claude-code' {
  interface PluginState {
    'pr-row': { pr: Pr | null; ticket: Ticket | null }
  }
}
