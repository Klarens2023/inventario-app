export type Comp = { componente_id?: number; componente_nombre: string; cantidad: number; unidad: string }
export type Producto = { id: number; nombre: string; activo: boolean; componentes: Comp[] }
