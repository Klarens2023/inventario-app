export type Componente = { componente_id: number; componente_nombre: string; cantidad: number; unidad: string }
export type Producto   = { id: number; nombre: string; componentes: Componente[] }
