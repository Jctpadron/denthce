# Skill: code_generator

## Problema que resuelve
Estructurar y generar código fuente de backend y frontend de forma consistente, cumpliendo con los estándares de diseño modular de la HCE y evitando deuda técnica.

## Justificación
Automatiza el andamiaje básico de la HCE. Permite escribir controladores, entidades ORM y componentes de vista que compartan el mismo patrón de codificación, logrando que el código generado por IA sea legible y estructurado de forma estándar.

## Riesgo de no crearlo
Generación de código desorganizado, inconsistente o que no respete las buenas prácticas de React (micro-frontends) y NestJS/FastAPI (módulos inyectables).

## Entradas
* Diseños técnicos de `docs/design/` (esquemas de bases de datos PostgreSQL, contratos FHIR y políticas de seguridad).
* Especificaciones funcionales de `docs/specs/` (historias de usuario y UI).

## Salidas
* Código fuente NestJS/React en directorios `src/backend/` y `src/frontend/`.

## Permisos
* Lectura: `docs/design/`, `docs/specs/`
* Escritura: Carpeta de código fuente del repositorio (`src/`).

## MCP o herramientas
* `MCP-Docs` (leer diseños y escribir archivos de código fuente).
* Herramientas de formateo (Linter, Prettier).

## Criterio de aprobación
* Compilación exitosa del código fuente generado y ausencia de errores sintácticos en el análisis estático.

## Estado
* Aprobado
