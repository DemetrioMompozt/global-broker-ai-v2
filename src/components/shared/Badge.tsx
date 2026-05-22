import type { ReactNode } from 'react'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'bad' | 'neutral' | 'warn' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
