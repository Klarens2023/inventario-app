'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { tieneModulo } from '@/lib/permissions'
import type { Producto } from '@/types/pvn-catalogo'
import { getProductos, toggleActivoProducto } from '@/lib/api/pvn-catalogo'
import { ProductosTable } from '@/components/pvn-catalogo/ProductosTable'
import { ProductoModal } from '@/components/pvn-catalogo/ProductoModal'

export default function CatalogoPVNPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading]     = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editProd, setEditProd]   = useState<Producto | null>(null)

  const { rol, modulos } = (session?.user ?? {}) as { rol?: string; modulos?: string[] }
  const canView = tieneModulo(rol ?? '', modulos, 'pvn_catalogo')

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  const cargarProductos = useCallback(async () => {
    setLoading(true)
    try { setProductos(await getProductos()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargarProductos()
  }, [status, canView, cargarProductos])

  function abrirNuevo() { setEditProd(null); setModalOpen(true) }
  function abrirEditar(p: Producto) { setEditProd(p); setModalOpen(true) }

  function onGuardado() {
    setModalOpen(false)
    cargarProductos()
  }

  async function toggleActivo(p: Producto) {
    await toggleActivoProducto(p.id, !p.activo)
    cargarProductos()
  }

  if (status === 'loading' || !canView) return null

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Catálogo PVN</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Gestión de productos y puntos de venta</p>
      </div>

      <ProductosTable
        productos={productos}
        loading={loading}
        onNuevo={abrirNuevo}
        onEditar={abrirEditar}
        onToggleActivo={toggleActivo}
      />

      {modalOpen && (
        <ProductoModal editProd={editProd} onClose={() => setModalOpen(false)} onGuardado={onGuardado} />
      )}
    </div>
  )
}
