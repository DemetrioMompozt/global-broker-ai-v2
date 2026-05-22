export function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return <span className={`status-pill ${ok ? 'status-ok' : 'status-off'}`}>{label}</span>
}
