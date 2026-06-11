import Sidebar from '@/components/Sidebar'

export default function PVNLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>{children}</main>
    </div>
  )
}
