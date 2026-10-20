import { expect, test } from 'claude-code/testing'

import { ticketKey, toPr, toTicket } from './format'

const band = {
  plugin: 'pr-row',
  surface: 'terminal' as const,
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
}

const gh = {
  number: 4821,
  url: 'https://github.com/oxio/app/pull/4821',
  title: 'fix checkout',
  headRefName: 'robin/con-4280-appointment-clearing',
  state: 'OPEN',
  isDraft: false,
  reviewDecision: 'APPROVED',
  mergeable: 'MERGEABLE',
}

test('ticketKey reads the branch, then the title', () => {
  expect(ticketKey('robin/con-4280-thing', '')).toBe('CON-4280')
  expect(ticketKey('bill-12-x', '')).toBe('BILL-12')
  expect(ticketKey('fix-stuff', 'WFM-77: fix stuff')).toBe('WFM-77')
  expect(ticketKey('macos', 'bump tools')).toBe(null)
})

test('toPr maps gh json and rejects junk', () => {
  const pr = toPr(JSON.stringify(gh))
  expect(pr?.state).toBe('open')
  expect(pr?.review).toBe('approved')
  expect(pr?.ticket).toBe('CON-4280')
  expect(toPr(JSON.stringify({ ...gh, isDraft: true }))?.state).toBe('draft')
  expect(toPr(JSON.stringify({ ...gh, reviewDecision: 'REVIEW_REQUIRED' }))?.review).toBe(null)
  expect(toPr('no pull requests found')).toBe(null)
})

test('toTicket survives a non-json answer', () => {
  expect(toTicket('CON-1', '{"url":"u","status":"In Review","statusType":"started"}').status).toBe('In Review')
  expect(toTicket('CON-1', 'oops').status).toBe(null)
})

const linear = '{"url":"https://linear.app/x","status":"In Review","statusType":"started"}'

test('band passes when the branch has no PR', async ($, on) => {
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no pull requests found', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.command.run({ command: 'pr-row', args: '', origin: 'user' } as never)
  const ui = await $.ui.mount(band)
  expect((await ui.findAll({ type: 'Link' })).length).toBe(0)
})

test('band links the PR number and the ticket', async ($, on) => {
  on('ui.render', () => ({ type: 'Box', props: {}, children: [] }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(gh), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: linear }], isError: false } }))
  await $.command.run({ command: 'pr-row', args: '', origin: 'user' } as never)
  const ui = await $.ui.mount(band)
  const links = await ui.findAll({ type: 'Link' })
  expect(links.map(l => l.props.href)).toEqual([gh.url, 'https://linear.app/x'])
  expect((await ui.findAll({ type: 'Text', text: 'approved' })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: 'In Review' })).length).toBe(1)
})
