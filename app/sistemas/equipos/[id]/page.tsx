'use client'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { HojaDeVida } from '@/components/equipos/HojaDeVida'

export default function HojaDeVidaPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const id     = params?.id as string

  const area      = session?.user?.area ?? 'logistica'
  const rol       = session?.user?.rol  ?? 'usuario'
  const canEdit   = area === 'sistemas' || area === 'general' || rol === 'admin'
  const canDelete = rol === 'admin'

  if (status === 'loading' || !id) return null

  return <HojaDeVida id={id} canEdit={canEdit} canDelete={canDelete} />
}
