// La validación de reglas vive en ./reglasRuta (sin dependencias, para poder probarla sin importar
// otros archivos: Node no resuelve importaciones relativas sin extensión en las pruebas).
export { validarRegla, type ReglaEntrada } from './reglasRuta'
