import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Glow } from './format'
import { elapsed, heatMeter, human, limitLabel, modeLabel, palette, percentColor, riseMs, tone, toReading, wave } from './format'

const reading = atom({ plugin: 'tide', key: 'reading' } as const, null)
const frame = atom({ plugin: 'tide', key: 'frame' } as const, 0)
const glow = atom({ plugin: 'tide', key: 'glow' } as const, 0)

const previewMs = 8000

let shimmer: Timer | null = null
let turning = false
let percentNow: number | null = null
let rise: { from: number; at: number } | null = null
let previewUntil = 0

function wantsGlow(now: number): boolean {
  if (now < previewUntil) return true
  return (rise !== null && now - rise.at < riseMs) || (turning && (percentNow ?? 0) >= 60)
}

function startGlow($: EngineInterface): void {
  shimmer ??= $.clock.every(80, async () => {
    if (!wantsGlow(await $.clock.now())) {
      shimmer?.cancel()
      shimmer = null
      rise = null
    }
    await update($, glow, n => n + 1)
  })
}

export const register: Register = on => {
  let ticker: Timer | null = null
  let startedAt = 0

  on('command.run', { command: 'tide' }, async ($, e) => {
    const target = Number(e.args.trim())
    const r = await read($, reading)
    if (e.args.trim() === '' || !Number.isFinite(target) || r === null || r.window === 0) {
      return { text: 'usage: /tide <percent>, previews the context meter at that level until the next measurement' }
    }
    const percent = Math.min(100, Math.max(0, Math.round(target)))
    const now = await $.clock.now()
    rise = { from: Math.min(percentNow ?? 0, percent - 1), at: now }
    previewUntil = now + previewMs
    percentNow = percent
    await update($, reading, () => ({ ...r, percent, tokens: Math.round((r.window * percent) / 100) }))
    startGlow($)
    return { text: `tide: previewing ${percent}%` }
  })

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'tide', description: 'Preview the tide context meter at a percent' })
    const usage = await $.session.usage()
    const r = toReading(usage.context, usage.rateLimits)
    percentNow = r.percent
    await update($, reading, () => r)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const r = toReading(e.context, e.rateLimits)
    if (percentNow !== null && r.percent > percentNow) {
      rise = { from: percentNow, at: await $.clock.now() }
      startGlow($)
    }
    percentNow = r.percent
    await update($, reading, () => r)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    startedAt = await $.clock.now()
    turning = true
    ticker ??= $.clock.every(40, () => void update($, frame, n => n + 1))
    if (wantsGlow(startedAt)) startGlow($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    turning = false
    ticker?.cancel()
    ticker = null
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const tick = await read($, frame)
    const since = startedAt === 0 ? 0 : (await $.clock.now()) - startedAt
    const bars = wave(tick)

    return (
      <Box flexDirection="row">
        <Text>
          {bars.map(bar => (
            <Text color={bar.color} dimColor={bar.dim}>
              {bar.text}
            </Text>
          ))}
        </Text>
        {e.props.message !== null && <Text>  {e.props.message}</Text>}
        <Text dimColor>
          {'  '}
          {elapsed(since)} · {modeLabel(e.props.mode)}
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const r = await read($, reading)
    if (r === null || r.window === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? 120
    const showLimits = r.limits.length > 0 && columns >= 110
    const limitMeters = columns >= 150
    const now = await $.clock.now()
    const g: Glow = { frame: await read($, glow), rise: rise && { from: rise.from, age: now - rise.at } }
    const ctx = heatMeter(r.percent, columns >= 150 ? 10 : columns >= 110 ? 8 : 6, g)

    return (
      <Box flexDirection="row" gap={2}>
        {e.props.modes.length > 0 && <Text color={palette.quiet}>{e.props.modes.join(' & ')}</Text>}
        <Box flexDirection="row">
          <Text>
            {ctx.map(bar => (
              <Text color={bar.color} dimColor={bar.dim}>
                {bar.text}
              </Text>
            ))}
          </Text>
          <Text> {human(r.tokens)}</Text>
          <Text color={palette.quiet}>/{human(r.window)} </Text>
          <Text color={percentColor(r.percent, g)} bold>{r.percent}%</Text>
        </Box>
        {showLimits &&
          r.limits.map(l => {
            const m = heatMeter(l.percent, 4, { frame: 0, rise: null })
            return (
              <Box key={l.kind} flexDirection="row">
                <Text color={palette.quiet}>{limitLabel(l.kind)} </Text>
                {limitMeters && (
                  <Text>
                    {m.map(bar => (
                      <Text color={bar.color} dimColor={bar.dim}>
                        {bar.text}
                      </Text>
                    ))}{' '}
                  </Text>
                )}
                <Text color={tone(l.percent)}>{l.percent}%</Text>
              </Box>
            )
          })}
      </Box>
    )
  })
}
