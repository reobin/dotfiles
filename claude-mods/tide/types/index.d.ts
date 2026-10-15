export type Limit = { kind: string; percent: number }

export type Reading = {
  tokens: number
  window: number
  percent: number
  limits: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    'tide': { reading: Reading | null; frame: number; glow: number }
  }
}
