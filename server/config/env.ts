import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env')

if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export function boolEnv(name: string, fallback = false) {
  const value = process.env[name]
  if (value === undefined) return fallback
  return value.toLowerCase() === 'true'
}

export function numEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

export const env = {
  basicAuthPassword: process.env.APP_BASIC_AUTH_PASSWORD ?? '',
  basicAuthUser: process.env.APP_BASIC_AUTH_USER ?? '',
  host: process.env.HOST ?? '127.0.0.1',
  port: numEnv('PORT', 5185),
}
