# VISION — DentHCE (Denta Cloud)

> Objetivo de producto, vendor-neutral. Lo lee **cualquier** agente (Claude, Gemini, DeepSeek, Qwen, Kimi) o persona.
> Fuente de verdad = el repo. Esta visión orienta el "por qué"; el "qué/cómo" vive en `tablero_control.md`, `docs/backlog.json` y `docs/adr/`.

## 1. Qué construimos
Una **Historia Clínica Electrónica (HCE) odontológica multi-inquilino, modular y por suscripción**, en español, para el mercado argentino/LATAM. SaaS: cada clínica o laboratorio es un **tenant** aislado bajo Zero Trust.

## 2. Para quién
- **Clínicas/consultorios odontológicos** — historia clínica, odontograma, agenda/turnos, finanzas clínicas, recetas, aseguradoras.
- **Laboratorios de prótesis dental** — gestión de órdenes, estados, stock (`protesis-lab`), pueden operar como tenant independiente.
- **Super Admin (plataforma)** — da de alta tenants (clínicas y laboratorios), activa/desactiva módulos y administra suscripciones.

## 3. Principio rector: suite modular por suscripción
El HCE base es el núcleo; **cada módulo se activa solo si el tenant lo contrató**.

> **Acceso = Rol (Keycloak) ∧ Módulo contratado (`tenant_modules`).**

- Apagar/suspender una suscripción es un **flag en BD**, nunca tocar Keycloak.
- Sin módulo contratado → `403 MODULE_NOT_ENABLED` en backend + **upsell** en frontend ("Activá X por $Y/mes").
- Módulos pagos actuales: `protesis-lab`, `finanzas-clinicas` (y los que se agreguen). Base siempre disponible.

## 4. Invariantes de producto (no negociables)
- **Español** en toda la experiencia y comunicación.
- **Responsive / mobile-safe** en el 100% de la UI clínica.
- **Multi-inquilino Zero Trust**: todo dato se filtra por tenant; nada cruza tenants.
- **Interoperabilidad clínica**: los datos clínicos se modelan hacia **HL7 FHIR R4**.
- **Auditoría**: toda acción sensible queda registrada (inmutable).
- **Verificación real**: una pantalla/feature no está "lista" por compilar; se prueba en runtime.

## 5. Norte (hacia dónde vamos)
- Gobernanza forzada por máquina (CI + branch protection + PR template + CODEOWNERS) para que **agentes de distintos modelos** colaboren sin divergir.
- Catálogo de módulos creciente (imágenes/DICOM, integraciones LIS/SISA, aseguradoras) activable por suscripción.
- Integración con el sistema de turnos por WhatsApp (CliniChat) como módulo anexable.

## 6. Qué NO somos (alcance)
- No es una HCE hospitalaria general (foco odontológico). Flujos hospitalarios (internación, etc.) están fuera de alcance salvo decisión explícita por ADR.
