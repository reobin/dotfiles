import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Pr } from '../types'
import type { Part } from './format'
import {
  chatPrUrl,
  chatTexts,
  chatTicketKey,
  ghFields,
  isDefaultBranch,
  palette,
  reviewPart,
  stateColor,
  statusColor,
  toPr,
  toTicket,
} from './format'

const pr = atom({ plugin: 'pr-row', key: 'pr' } as const, null)
const ticket = atom({ plugin: 'pr-row', key: 'ticket' } as const, null)

const refreshMs = 60_000

let poll: Timer | null = null
let refreshing = false

async function onDefaultBranch($: EngineInterface): Promise<boolean> {
  const [branch, head] = await Promise.all([
    $.process.run(['git', 'branch', '--show-current']),
    $.process.run(['git', 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']),
  ])
  return branch.exitCode === 0 && head.exitCode === 0 && isDefaultBranch(branch.stdout, head.stdout)
}

async function viewPr($: EngineInterface, url: string | null): Promise<Pr | null> {
  const target = url === null ? [] : [url]
  const gh = await $.process.run(['gh', 'pr', 'view', ...target, '--json', ghFields], { timeoutMs: 15_000 })
  return gh.exitCode === 0 ? toPr(gh.stdout, url !== null) : null
}

async function refresh($: EngineInterface): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const own = (await onDefaultBranch($)) ? null : await viewPr($, null)
    const texts = own === null ? chatTexts(await $.session.messages()) : []
    const url = chatPrUrl(texts)
    const next = own ?? (url === null ? null : await viewPr($, url))
    await update($, pr, () => next)
    const key = next?.ticket ?? chatTicketKey(texts)
    if (key === null) {
      await update($, ticket, () => null)
      return
    }
    const issue = await $.mcp.call('linear-server', 'get_issue', { id: key, fields: ['url', 'status', 'statusType'] })
    const text = issue.isError ? undefined : issue.content.find(b => b.type === 'text')?.text
    await update($, ticket, () => toTicket(key, text))
  } catch {
    return
  } finally {
    refreshing = false
  }
}

export const register: Register = on => {
  on('command.run', { command: 'pr-row' }, async ($) => {
    await refresh($)
    const p = await read($, pr)
    return { text: p === null ? 'pr-row: no PR for this branch' : `pr-row: #${p.number} refreshed` }
  })

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'pr-row', description: 'Refresh the PR row now' })
    void refresh($)
    poll ??= $.clock.every(refreshMs, () => void refresh($))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    void refresh($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, pr)
    const t = await read($, ticket)
    if ((p === null && t === null) || e.props.hasSurvey) return next(e)

    const { Box, Link, Text } = $.ui.resolve(e)
    const parts: Part[] =
      p === null
        ? []
        : [
            { text: p.state, color: stateColor(p.state), dim: p.state === 'closed' },
            reviewPart(p.review),
            p.conflicts ? { text: 'conflicts', color: palette.bad } : null,
            p.fromChat ? { text: 'from chat', dim: true } : null,
          ].filter((part): part is Part => part !== null)

    return (
      <Box flexDirection="row" gap={3} flexWrap="nowrap">
        {p !== null && (
          <Box flexDirection="row" gap={1}>
            <Text bold>
              <Link href={p.url}>#{p.number}</Link>
            </Text>
            {parts.map(part => (
              <Text key={part.text} color={part.color} dimColor={part.dim} wrap="truncate">
                {part.text}
              </Text>
            ))}
          </Box>
        )}
        {t !== null && (
          <Box flexDirection="row" gap={1}>
            <Text dimColor={t.url === null}>{t.url === null ? t.key : <Link href={t.url}>{t.key}</Link>}</Text>
            {t.status !== null && (
              <Text color={statusColor(t.statusType)} wrap="truncate">
                {t.status}
              </Text>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
