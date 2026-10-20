import type { Pr, Ticket } from '../types'

export const palette = { good: 'success', wait: 'warning', bad: 'error', merged: 'merged' } as const

type GhPr = {
  number: number
  url: string
  title: string
  headRefName: string
  state: string
  isDraft: boolean
  reviewDecision: string
  mergeable: string
}

export const ghFields = 'number,url,title,headRefName,state,isDraft,reviewDecision,mergeable'

export function ticketKey(branch: string, title: string): string | null {
  const fromBranch = /^(?:[\w.-]+\/)?([a-z]{2,8}-\d+)/i.exec(branch)?.[1]
  const fromTitle = /\b([A-Z]{2,8}-\d+)\b/.exec(title)?.[1]
  return (fromBranch ?? fromTitle)?.toUpperCase() ?? null
}

const reviews: Record<string, Pr['review']> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes requested',
}

export function toPr(json: string): Pr | null {
  let gh: GhPr
  try {
    gh = JSON.parse(json) as GhPr
  } catch {
    return null
  }
  if (typeof gh.number !== 'number') return null
  const state = gh.state === 'MERGED' ? 'merged' : gh.state === 'CLOSED' ? 'closed' : gh.isDraft ? 'draft' : 'open'
  return {
    number: gh.number,
    url: gh.url,
    state,
    review: reviews[gh.reviewDecision] ?? null,
    conflicts: gh.mergeable === 'CONFLICTING',
    ticket: ticketKey(gh.headRefName, gh.title),
  }
}

export function toTicket(key: string, json: string | undefined): Ticket {
  try {
    const issue = JSON.parse(json ?? '') as { url?: string; status?: string; statusType?: string }
    return { key, url: issue.url ?? null, status: issue.status ?? null, statusType: issue.statusType ?? null }
  } catch {
    return { key, url: null, status: null, statusType: null }
  }
}

export type Part = { text: string; color?: string; dim?: boolean }

export function stateColor(state: Pr['state']): string | undefined {
  return state === 'open' ? palette.good : state === 'merged' ? palette.merged : undefined
}

export function reviewPart(review: Pr['review']): Part | null {
  if (review === 'approved') return { text: 'approved', color: palette.good }
  if (review === 'changes requested') return { text: 'changes requested', color: palette.bad }
  return null
}

export function statusColor(statusType: string | null): string | undefined {
  if (statusType === 'started') return palette.wait
  if (statusType === 'completed') return palette.good
  return undefined
}
