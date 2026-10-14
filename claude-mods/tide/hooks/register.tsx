import { atom, read, update } from 'claude-code'
import type { Register, Timer } from 'claude-code'

import { elapsed, human, limitLabel, meter, modeLabel, palette, tone, toReading, wave } from './format'

const reading = atom({ plugin: 'tide', key: 'reading' } as const, null)
const frame = atom({ plugin: 'tide', key: 'frame' } as const, 0)

export const register: Register = on => {
  let ticker: Timer | null = null
  let startedAt = 0

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, reading, () => toReading(usage.context, usage.rateLimits))
    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, reading, () => toReading(e.context, e.rateLimits))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    startedAt = await $.clock.now()
    ticker ??= $.clock.every(40, () => void update($, frame, n => n + 1))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
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
    const ctx = meter(r.percent, columns >= 150 ? 10 : columns >= 110 ? 8 : 6)

    return (
      <Box flexDirection="row" gap={2}>
        {e.props.modes.length > 0 && <Text dimColor>{e.props.modes.join(' & ')}</Text>}
        <Box flexDirection="row">
          <Text color={tone(r.percent)}>{ctx.filled}</Text>
          <Text dimColor>{ctx.empty}</Text>
          <Text> {human(r.tokens)}</Text>
          <Text dimColor>/{human(r.window)} </Text>
          <Text color={tone(r.percent)} bold>{r.percent}%</Text>
        </Box>
        {showLimits &&
          r.limits.map(l => {
            const m = meter(l.percent, 4)
            return (
              <Box key={l.kind} flexDirection="row">
                <Text dimColor>{limitLabel(l.kind)} </Text>
                {limitMeters && <Text color={tone(l.percent)}>{m.filled}</Text>}
                {limitMeters && <Text dimColor>{m.empty} </Text>}
                <Text color={tone(l.percent)}>{l.percent}%</Text>
              </Box>
            )
          })}
      </Box>
    )
  })
}
