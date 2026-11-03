import { expect, mock, test } from 'claude-code/testing'

import { ansi, elapsed, human, limitLabel, modeLabel, palette, percentColor, resetIn, riseMs, tone, toReading, wave } from './format'

const footer = (columns: number, modes: string[] = []) => ({
  plugin: 'tide',
  surface: 'terminal' as const,
  component: 'SessionMode' as const,
  props: { modes },
  viewport: { columns, rows: 40 },
})

const measure = {
  context: { tokens: 68_432, window: 1_000_000, percent: 7 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 23.5 },
    { kind: 'seven_day', percentUsed: 91 },
  ],
  changed: ['context' as const, 'rateLimits' as const],
}

test('human matches the old status line', () => {
  expect(human(68_432)).toBe('68k')
  expect(human(1_000_000)).toBe('1M')
  expect(human(1_500_000)).toBe('1.5M')
  expect(human(812)).toBe('812')
})

test('tone steps at 60 and 85', () => {
  expect(tone(59)).toBe(palette.calm)
  expect(tone(60)).toBe(palette.warm)
  expect(tone(85)).toBe(palette.hot)
})

test('limit shows the time left until it resets', () => {
  const now = Date.parse('2026-10-23T12:00:00Z')
  const hour = 3_600_000
  expect(limitLabel('five_hour')).toBe('5h')
  expect(resetIn(now + 30 * 60_000, now)).toBe('30m')
  expect(resetIn(now + 59_000, now)).toBe('1m')
  expect(resetIn(now + 4.5 * hour, now)).toBe('4h30')
  expect(resetIn(now + 65 * 60_000, now)).toBe('1h05')
  expect(resetIn(now + 12 * hour, now)).toBe('12h')
  expect(resetIn(now + 30 * hour, now)).toBe('30h')
  expect(resetIn(now + 4.2 * 24 * hour, now)).toBe('4d')
  expect(resetIn(now - 1000, now)).toBe('0m')
  expect(resetIn(undefined, now)).toBeUndefined()
  expect(toReading({ tokens: 0, window: 1 }, [{ kind: 'five_hour', percentUsed: 1, resetsAt: new Date(now).toISOString() }]).limits[0]?.resetsAt).toBe(now)
})

test('toReading derives percent when the engine has none', () => {
  expect(toReading({ tokens: 250_000, window: 1_000_000 }, []).percent).toBe(25)
})

test('footer draws the context and limits after a measurement', async ($, on) => {
  mock.clock(on)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(measure)
  const ui = await $.ui.mount(footer(160))
  const tokens = await ui.findAll({ type: 'Text', text: '68k' })
  expect(tokens[0]?.props.color).toBe(palette.calm)
  expect((await ui.findAll({ type: 'Text', text: '7%' })).length).toBe(0)
  expect((await ui.findAll({ type: 'Text', text: '5h ' })).length).toBe(1)
  const hot = await ui.findAll({ type: 'Text', text: '91%' })
  expect(hot[0]?.props.color).toBe(palette.hot)
})

test('footer keeps every figure on a narrow terminal', async ($, on) => {
  mock.clock(on)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(measure)
  const ui = await $.ui.mount(footer(90))
  expect((await ui.findAll({ type: 'Text', text: '68k' })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: '/1M' })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: '5h ' })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: '7d ' })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: '91%' })).length).toBe(1)
})

test('footer shows how long until each limit resets', async ($, on) => {
  const now = Date.parse('2026-10-23T12:00:00Z')
  mock.clock(on, { now })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure({
    ...measure,
    rateLimits: [{ kind: 'five_hour', percentUsed: 23.5, resetsAt: new Date(now + 42 * 60_000).toISOString() }],
  })
  const ui = await $.ui.mount(footer(90))
  expect((await ui.findAll({ type: 'Text', text: ' ⇢42m' })).length).toBe(1)
})

test('footer keeps the engine mode labels ahead of the line', async ($, on) => {
  mock.clock(on)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(measure)
  const ui = await $.ui.mount(footer(160, ['focus', 'memory paused']))
  expect((await ui.findAll({ type: 'Text', text: 'focus & memory paused' })).length).toBe(1)
})

test('wave is a tapered row of bars that drifts a little each frame', () => {
  const text = (frame: number) => wave(frame).map(b => b.text).join('')
  expect([...text(0)].length).toBe(16)
  expect(text(0)).toMatch(/^[▁▂▃▄▅▆▇█]+$/)
  expect(text(0)).not.toBe(text(1))
  const level = (c: string) => '▁▂▃▄▅▆▇█'.indexOf(c)
  for (let f = 0; f < 120; f++) {
    const bars = [...text(f)]
    expect(level(bars[0])).toBeLessThan(3)
    expect(level(bars[15])).toBeLessThan(3)
  }
})

test('elapsed reads like the engine', () => {
  expect(elapsed(12_400)).toBe('12s')
  expect(elapsed(65_000)).toBe('1m 05s')
  expect(modeLabel('responding')).toBe('writing')
})

test('spinner draws the wave instead of the word, and a state message beside it', async $ => {
  const props = { word: 'Simmering', message: null, suffix: '…', mode: 'thinking' as const }
  const ui = await $.ui.mount({ plugin: 'tide', surface: 'terminal', component: 'Spinner', props })
  expect((await ui.findAll({ type: 'Text', text: /Simmering/ })).length).toBe(0)
  expect((await ui.findAll({ type: 'Text', text: /[▁▂▃▄▅▆▇█]/ })).length).toBeGreaterThan(0)
  expect((await ui.findAll({ type: 'Text', text: /thinking/ })).length).toBeGreaterThan(0)

  const busy = await $.ui.mount({ plugin: 'tide', surface: 'terminal', component: 'Spinner', props: { ...props, message: 'Compacting' } })
  expect((await busy.findAll({ type: 'Text', text: 'Compacting' })).length).toBeGreaterThan(0)
})

test('wave stays green and brightens from dim troughs to bright crests', () => {
  const depth = { '▁': 'dim', '▄': ansi.green, '█': ansi.greenBright } as Record<string, string>
  const shade = (b: { color: string; dim: boolean }) => (b.dim ? 'dim' : b.color)
  for (let f = 0; f < 600; f += 7) {
    for (const bar of wave(f)) {
      expect([ansi.green, ansi.greenBright]).toContain(bar.color)
      for (const c of bar.text) if (depth[c]) expect(shade(bar)).toBe(depth[c])
    }
  }
})

test('percent flashes on a rise, then settles', () => {
  expect(percentColor(50, { frame: 0, rise: { from: 30, age: 0 } })).toBe(ansi.whiteBright)
  expect(percentColor(50, { frame: 0, rise: { from: 30, age: riseMs } })).toBe(ansi.green)
})

test('percent pulses when hot', () => {
  expect(new Set(Array.from({ length: 12 }, (_, f) => percentColor(90, { frame: f, rise: null })))).toEqual(
    new Set([ansi.red, ansi.redBright]),
  )
})
