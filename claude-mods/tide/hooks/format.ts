import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Limit, Reading } from '../types'

// named colors reach the terminal as fixed hex; palette indices 0-15 follow the terminal theme
export const ansi = {
  red: 'ansi256(1)',
  green: 'ansi256(2)',
  yellow: 'ansi256(3)',
  redBright: 'ansi256(9)',
  greenBright: 'ansi256(10)',
  yellowBright: 'ansi256(11)',
  whiteBright: 'ansi256(15)',
}

export const palette = {
  calm: ansi.green,
  warm: ansi.yellow,
  hot: ansi.red,
  quiet: 'inactive',
}

export type Bar = { text: string; color: string; dim: boolean }

const limitLabels: Record<string, string> = { five_hour: '5h', seven_day: '7d' }

export function human(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return Number.isInteger(v) ? `${v}M` : `${v.toFixed(1)}M`
  }
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${Math.round(n)}`
}

export function tone(percent: number): string {
  if (percent >= 85) return palette.hot
  if (percent >= 60) return palette.warm
  return palette.calm
}

export function meter(percent: number, width: number): { filled: string; empty: string } {
  const clamped = Math.min(100, Math.max(0, percent))
  const cells = Math.round((clamped / 100) * width)
  const shown = clamped > 0 ? Math.max(1, cells) : 0
  return { filled: '━'.repeat(shown), empty: '─'.repeat(width - shown) }
}

export const riseMs = 1500

const brighter: Record<string, string> = {
  [ansi.green]: ansi.greenBright,
  [ansi.yellow]: ansi.yellowBright,
  [ansi.red]: ansi.redBright,
}

export type Glow = { frame: number; rise: { from: number; age: number } | null }

export function heatMeter(percent: number, width: number, glow: Glow): Bar[] {
  const clamped = Math.min(100, Math.max(0, percent))
  const cells = Math.round((clamped / 100) * width)
  const shown = clamped > 0 ? Math.max(1, cells) : 0
  const rising = glow.rise !== null && glow.rise.age < riseMs ? glow.rise : null
  const pulse = Math.floor(glow.frame / 6) % 2 === 1
  const sweep = shown > 0 ? Math.floor(glow.frame / 2) % (shown + 4) : -1
  const out: Bar[] = []

  for (let i = 0; i < width; i++) {
    let bar: Bar
    if (i >= shown) {
      bar = { text: '─', color: palette.quiet, dim: false }
    } else {
      const base = tone(((i + 1) / width) * 100)
      const head = i === shown - 1
      const fresh = rising !== null && ((i + 1) / width) * 100 > rising.from
      let color = head ? brighter[base] ?? base : base
      if (fresh) color = rising.age < riseMs / 3 ? ansi.whiteBright : brighter[base] ?? base
      else if (clamped >= 85 && i === sweep) color = ansi.whiteBright
      else if (clamped >= 60 && head && pulse) color = base
      bar = { text: '━', color, dim: false }
    }
    const last = out[out.length - 1]
    if (last && last.color === bar.color && last.dim === bar.dim) last.text += bar.text
    else out.push(bar)
  }
  return out
}

export function percentColor(percent: number, glow: Glow): string {
  if (glow.rise !== null && glow.rise.age < riseMs / 3) return ansi.whiteBright
  const base = tone(percent)
  if (percent >= 85 && Math.floor(glow.frame / 6) % 2 === 1) return brighter[base] ?? base
  return base
}

const hourMs = 3_600_000
const limitWindows: Record<string, { ms: number; unit: number; suffix: string }> = {
  five_hour: { ms: 5 * hourMs, unit: hourMs, suffix: '5h' },
  seven_day: { ms: 7 * 24 * hourMs, unit: 24 * hourMs, suffix: '7d' },
}

export function limitLabel(kind: string, resetsAt?: number, now?: number): string {
  const w = limitWindows[kind]
  if (w && resetsAt !== undefined && now !== undefined) {
    const elapsed = Math.min(w.ms, Math.max(0, w.ms - (resetsAt - now)))
    return `${(Math.floor((elapsed / w.unit) * 10) / 10).toFixed(1)}/${w.suffix}`
  }
  return limitLabels[kind] ?? kind.replace(/_/g, ' ')
}

export function toReading(context: SessionContextUsage, rateLimits: SessionRateLimit[]): Reading {
  const tokens = context.tokens ?? 0
  const percent = context.percent ?? (context.window > 0 ? Math.round((tokens / context.window) * 100) : 0)
  const limits: Limit[] = rateLimits.map(l => {
    const resetsAt = l.resetsAt === undefined ? NaN : Date.parse(l.resetsAt)
    return { kind: l.kind, percent: Math.round(l.percentUsed), ...(Number.isNaN(resetsAt) ? {} : { resetsAt }) }
  })
  return { tokens, window: context.window, percent, limits }
}

const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

const depths = [
  { color: ansi.green, dim: true },
  { color: ansi.green, dim: true },
  { color: ansi.green, dim: true },
  { color: ansi.green, dim: false },
  { color: ansi.green, dim: false },
  { color: ansi.green, dim: false },
  { color: ansi.greenBright, dim: false },
  { color: ansi.greenBright, dim: false },
]

export function wave(frame: number, width = 16): Bar[] {
  const phase = frame * 0.16
  const swell = 0.85 + 0.15 * Math.sin(frame * 0.035)
  const out: Bar[] = []
  for (let i = 0; i < width; i++) {
    const taper = Math.sin((Math.PI * (i + 0.5)) / width) ** 0.7
    const crest = (Math.sin(i * 0.62 - phase) + 1) / 2
    const level = Math.round(crest * taper * swell * (bars.length - 1))
    const bar = { text: bars[level], ...depths[level] }
    const last = out[out.length - 1]
    if (last && last.color === bar.color && last.dim === bar.dim) last.text += bar.text
    else out.push(bar)
  }
  return out
}

export function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

const modeLabels: Record<string, string> = {
  requesting: 'requesting',
  thinking: 'thinking',
  responding: 'writing',
  'tool-input': 'preparing tool',
  'tool-use': 'running tools',
}

export function modeLabel(mode: string): string {
  return modeLabels[mode] ?? mode
}
