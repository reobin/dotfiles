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

export const riseMs = 1500

const brighter: Record<string, string> = {
  [ansi.green]: ansi.greenBright,
  [ansi.yellow]: ansi.yellowBright,
  [ansi.red]: ansi.redBright,
}

export type Glow = { frame: number; rise: { from: number; age: number } | null }

export function percentColor(percent: number, glow: Glow): string {
  if (glow.rise !== null && glow.rise.age < riseMs / 3) return ansi.whiteBright
  const base = tone(percent)
  if (percent >= 85 && Math.floor(glow.frame / 6) % 2 === 1) return brighter[base] ?? base
  return base
}

export function limitLabel(kind: string): string {
  return limitLabels[kind] ?? kind.replace(/_/g, ' ')
}

export function resetIn(resetsAt: number | undefined, now: number): string | undefined {
  if (resetsAt === undefined) return undefined
  const minutes = Math.max(0, Math.ceil((resetsAt - now) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 10) return `${hours}h${String(minutes % 60).padStart(2, '0')}`
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
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

// braille dot bits for a cell's left and right column, bottom row first
const dotBits = [
  [0x40, 0x04, 0x02, 0x01],
  [0x80, 0x20, 0x10, 0x08],
]

const depths = [
  { color: ansi.green, dim: true },
  { color: ansi.green, dim: true },
  { color: ansi.green, dim: false },
  { color: ansi.greenBright, dim: false },
]

// A dot-matrix scope: one dot per column traces a tapered sine across
// braille cells of two columns and four rows; a cell glows by its highest dot.
export function wave(frame: number, width = 12): Bar[] {
  const phase = frame * 0.16
  const swell = 0.85 + 0.15 * Math.sin(frame * 0.035)
  const columns = width * 2
  const out: Bar[] = []
  for (let i = 0; i < width; i++) {
    let bits = 0
    let height = 0
    for (const side of [0, 1]) {
      const c = i * 2 + side
      const taper = Math.sin((Math.PI * (c + 0.5)) / columns) ** 0.7
      const crest = (Math.sin(c * 0.31 - phase) + 1) / 2
      const level = Math.round(crest * taper * swell * 3)
      bits |= dotBits[side][level]
      height = Math.max(height, level)
    }
    const bar = { text: String.fromCharCode(0x2800 + bits), ...depths[height] }
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
