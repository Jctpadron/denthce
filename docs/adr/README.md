# Architecture Decision Records (ADR)

Registro **inmutable** de decisiones de producto/arquitectura del proyecto HCE Denta Cloud.
Sirve para que **cualquier agente o persona** sepa qué ya se decidió y **no lo re-litigue**.

## Cómo funciona
- Un ADR = una decisión. Archivo `NNNN-titulo-en-kebab.md`.
- Estados: `Propuesta` · `Aceptada` · `Supersedida por NNNN` · `Descartada`.
- No se editan las decisiones aceptadas; si cambian, se crea un ADR nuevo que **supersede** al anterior.
- Formato por ADR: **Contexto · Decisión · Consecuencias · Estado · Fecha**.

## Índice
| # | Decisión | Estado |
| :-- | :-- | :-- |
| [0001](0001-hc-general-reemplazada-por-odontologia.md) | HC general reemplazada por HC Odontológica (general oculta) | Aceptada |
| [0002](0002-directiva-65-anos-descartada.md) | Directiva "operador de 65 años" descartada | Aceptada |
| [0003](0003-marca-publica-denta-cloud.md) | Marca pública del producto = "Denta Cloud" | Aceptada |
| [0004](0004-identidad-visual-tema-claro.md) | Identidad visual: tema claro/clínico (dark mode opcional, no default) | Aceptada |
| [0005](0005-producto-modular-por-suscripcion.md) | Producto modular por suscripción (Super Admin + entitlements) | Aceptada |
| [0006](0006-clave-natural-paciente-sexo-dni.md) | Clave natural del paciente = sexo (M/F) + DNI | Aceptada |
| [0007](0007-uploads-storage-local-ahora-s3-despues.md) | Imágenes/documentos: storage local ahora, S3 antes de prod real | Aceptada (deuda) |
| [0008](0008-login-keycloak-tema-denta-cloud.md) | Login con tema propio de Keycloak (denta-cloud) | Aceptada |
