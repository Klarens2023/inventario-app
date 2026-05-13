import Sidebar from '@/components/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowX: 'hidden', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
