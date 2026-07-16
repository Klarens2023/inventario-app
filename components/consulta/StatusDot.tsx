import type { EditState } from '@/types/consulta'

export function StatusDot({ status }: { status: EditState['status'] }) {
  if (status === 'saving') return <span style={{ color: '#f59e0b', fontSize: 10 }}>●</span>
  if (status === 'saved')  return <span style={{ color: '#10b981', fontSize: 10 }}>✓</span>
  if (status === 'error')  return <span style={{ color: '#ef4444', fontSize: 10 }}>✗</span>
  return null
}
