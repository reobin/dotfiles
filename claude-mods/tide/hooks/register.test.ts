import { expect, test } from 'claude-code/testing'

import { elapsed, heatMeter, human, meter, modeLabel, palette, percentColor, riseMs, tone, toReading, wave } from './format'

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

test('wave stays green and brightens from dim troughs to bright crests', () => {
  const depth = { '▁': 'dim', '▄': 'green', '█': 'greenBright' } as Record<string, string>
  const shade = (b: { color: string; dim: boolean }) => (b.dim ? 'dim' : b.color)
  for (let f = 0; f < 600; f += 7) {
    for (const bar of wave(f)) {
      expect(['green', 'greenBright']).toContain(bar.color)
      for (const c of bar.text) if (depth[c]) expect(shade(bar)).toBe(depth[c])
    }
  }
})

const still = { frame: 0, rise: null }
const cellColors = (bars: { text: string; color: string; dim: boolean }[]) =>
  bars.flatMap(b => [...b.text].map(() => (b.dim ? 'dim' : b.color)))

test('heat meter colors each cell by how far along the bar it sits', () => {
  expect(cellColors(heatMeter(100, 10, still))).toEqual([
    'green', 'green', 'green', 'green', 'green', 'yellow', 'yellow', 'yellow', 'red', 'redBright',
  ])
  expect(cellColors(heatMeter(30, 10, still))).toEqual(['green', 'green', 'greenBright', ...Array(7).fill('dim')])
})

test('heat meter flashes the newly filled cells, then settles', () => {
  const fresh = (age: number) => cellColors(heatMeter(50, 10, { frame: 0, rise: { from: 30, age } }))
  expect(fresh(0).slice(3, 5)).toEqual(['whiteBright', 'whiteBright'])
  expect(fresh(0).slice(0, 3)).toEqual(['green', 'green', 'green'])
  expect(fresh(riseMs / 2).slice(3, 5)).toEqual(['greenBright', 'greenBright'])
  expect(fresh(riseMs)).toEqual(cellColors(heatMeter(50, 10, still)))
  expect(percentColor(50, { frame: 0, rise: { from: 30, age: 0 } })).toBe('whiteBright')
})

test('heat meter pulses its head when warm and sweeps a highlight when hot', () => {
  const head = (frame: number) => cellColors(heatMeter(70, 10, { frame, rise: null }))[6]
  expect(head(0)).toBe('yellowBright')
  expect(head(6)).toBe('yellow')
  const hot = Array.from({ length: 30 }, (_, f) => cellColors(heatMeter(90, 10, { frame: f, rise: null })))
  expect(hot.some(cells => cells.includes('whiteBright'))).toBe(true)
  expect(new Set(Array.from({ length: 12 }, (_, f) => percentColor(90, { frame: f, rise: null })))).toEqual(
    new Set(['red', 'redBright']),
  )
})

test('heat meter keeps a sliver for any use and stays its width', () => {
  for (const p of [0, 1, 50, 140]) expect(cellColors(heatMeter(p, 8, still)).length).toBe(8)
  expect(cellColors(heatMeter(1, 8, still))[0]).toBe('greenBright')
})
