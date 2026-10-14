import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Limit, Reading } from '../types'

export const palette = {
  calm: 'green',
  warm: 'yellow',
  hot: 'red',
}

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

export function limitLabel(kind: string): string {
  return limitLabels[kind] ?? kind.replace(/_/g, ' ')
}

export function toReading(context: SessionContextUsage, rateLimits: SessionRateLimit[]): Reading {
  const tokens = context.tokens ?? 0
  const percent = context.percent ?? (context.window > 0 ? Math.round((tokens / context.window) * 100) : 0)
  const limits: Limit[] = rateLimits.map(l => ({ kind: l.kind, percent: Math.round(l.percentUsed) }))
  return { tokens, window: context.window, percent, limits }
}

export type Bar = { text: string; color: string }

const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

// wave-zen's greens by depth: wave aqua, spring green, its 69% lift, then foam.
const depths = ['cyan', 'cyan', 'cyan', 'green', 'green', 'greenBright', 'greenBright', 'whiteBright']

export function wave(frame: number, width = 16): Bar[] {
  const phase = frame * 0.16
  const swell = 0.85 + 0.15 * Math.sin(frame * 0.035)
  const out: Bar[] = []
  for (let i = 0; i < width; i++) {
    const taper = Math.sin((Math.PI * (i + 0.5)) / width) ** 0.7
    const crest = (Math.sin(i * 0.62 - phase) + 1) / 2
    const level = Math.round(crest * taper * swell * (bars.length - 1))
    const bar = { text: bars[level], color: depths[level] }
    const last = out[out.length - 1]
    if (last && last.color === bar.color) last.text += bar.text
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
