import { expect, test } from 'claude-code/testing'

import { elapsed, human, meter, modeLabel, palette, tone, toReading, wave } from './format'

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

test('meter shows a sliver for any use and stays its width', () => {
  expect(meter(0, 10)).toEqual({ filled: '', empty: '─'.repeat(10) })
  expect(meter(1, 10).filled).toBe('━')
  expect(meter(140, 10)).toEqual({ filled: '━'.repeat(10), empty: '' })
})

test('toReading derives percent when the engine has none', () => {
  expect(toReading({ tokens: 250_000, window: 1_000_000 }, []).percent).toBe(25)
})

test('footer draws the context and limits after a measurement', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(measure)
  const ui = await $.ui.mount(footer(160))
  expect((await ui.findAll({ type: 'Text', text: ' 68k' })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: '7%' })).length).toBe(1)
  expect((await ui.findAll({ type: 'Text', text: '5h ' })).length).toBe(1)
  const hot = await ui.findAll({ type: 'Text', text: '91%' })
  expect(hot[0]?.props.color).toBe(palette.hot)
})

test('footer drops the limits on a narrow terminal', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure(measure)
  const ui = await $.ui.mount(footer(90))
  expect((await ui.findAll({ type: 'Text', text: '5h ' })).length).toBe(0)
  expect((await ui.findAll({ type: 'Text', text: '7%' })).length).toBe(1)
})

test('footer keeps the engine mode labels ahead of the line', async ($, on) => {
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

test('wave runs from sea green in the troughs to foam on the crests', () => {
  const depth = { '▁': 'cyan', '▄': 'green', '▆': 'greenBright', '█': 'whiteBright' } as Record<string, string>
  for (let f = 0; f < 600; f += 7) {
    for (const bar of wave(f)) {
      expect(['cyan', 'green', 'greenBright', 'whiteBright']).toContain(bar.color)
      for (const c of bar.text) if (depth[c]) expect(bar.color).toBe(depth[c])
    }
  }
})
