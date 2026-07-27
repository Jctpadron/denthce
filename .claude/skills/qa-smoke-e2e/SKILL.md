---
name: qa-smoke-e2e
description: >
  QA integral E2E de la HCE (DentHCE): smoke de todas las pantallas + recorrido del ciclo clínico real —
  login Keycloak, alta de paciente (FHIR Patient con clave sexo+DNI y control de duplicados MPI), ficha
  clínica (odontograma, alergias, signos vitales/LOINC, documentos), HC Odontológica PAMI, visita/encuentro
  con firma inmutable + PDF, receta electrónica (MedicationRequest + CDS Hooks) y verificación de aislamiento
  multi-inquilino Zero Trust. Úsala como regresión funcional tras cada deploy o cambio grande. Entrega un
  informe con hallazgos por severidad, apto para abrir tareas en el backlog. (Adaptación HCE de la skill
  `qa-carga-admision` de LabFlow LIS.)
---

# Skill: qa-smoke-e2e — QA integral E2E de la HCE

## Entorno
- **Local (Docker):** frontend + `hce-backend` + Keycloak levantados por docker-compose. ⚠️ el frontend corre en Docker **sin HMR** → `docker restart hce-frontend-client` tras editar.
- **Producción:** `app.systia.ar` (frontend), backend + Keycloak. **Credenciales, URLs y realm canónicos: tomarlos del entorno/handoff vigente y de `docs/REGLAS-ESTABILIDAD.md`** — no hardcodear acá.
- UI por navegador (manual/automation) o API por token (Keycloak) para el camino de datos. Todo en español.

## FASE 0 — Smoke de pantallas
Abrir UNA POR UNA y confirmar que cargan sin 404/blanco/500, con marca (primaryColor propagado) y **responsive 360/768/1280** (sin overflow, botones clínicos accesibles, contraste WCAG AA):
Landing pública · Login (Keycloak) · Home/Dashboard **por rol** · Registro de paciente · Ficha clínica (tabs: Odontograma, Alergias, Signos Vitales, Documentos) · HC Odontológica PAMI · Agenda/Turnos · Receta electrónica · Prótesis (DentaLab, si el tenant lo tiene) · Super Admin. Probar modales (abren/cierran). Registrar ABRE OK / ROTA.

## FASE 1 — Alta de pacientes (FHIR Patient, TODOS los campos)
Con rol médico/recepción, alta de 3 pacientes con todos los campos; **clave natural = sexo registral (M/F) + DNI** (en Argentina el DNI solo NO es único):
1. María Gómez · F · DNI 28456789 · 1981-03-12 · OSDE · cobertura/afiliado · tel · email.
2. Juan Pérez · M · DNI 30111222 · 1985-07-20 · OSEP · afiliado · tel · email.
3. Ana Torres · F · DNI 35999111 · 1996-11-02 · Particular · tel · email.
Verificar: **control de duplicados (MPI)** — reintentar con mismo sexo+DNI debe avisar; distinto sexo mismo DNI debe permitir; el nombre se muestra **legible** (no cifrado); persiste al recargar; auditoría del alta.

## FASE 2 — Ficha clínica
- **Odontograma** (SVG adulto/infantil): marcar estados, persistir.
- **Alergias** (FHIR AllergyIntolerance): alta con sustancia + criticidad.
- **Signos vitales** (FHIR Observation / LOINC): TA, FC, temperatura con **unidades y código LOINC correctos**; gráfico evolutivo.
- **Documentos**: upload JPG/PNG/PDF (límite 20 MB, tipos MIME validados) → `DocumentReference`/`Media`; galería + previsualización + drag & drop.

## FASE 3 — HC Odontológica PAMI + Visita/Encuentro
- Anamnesis PAMI (cuestionario + firma paciente, QuestionnaireResponse) y consentimiento **doble firma** + matrícula (Consent).
- **Ciclo de visita:** abrir encuentro → cargar prestaciones → **finalizar + firmar → INMUTABLE**; verificar que una nota firmada **no se pueda editar** (solo addenda); turno pasa a `fulfilled`; todo auditado.
- Exportar HC en **PDF formato PAMI** (3 hojas): paciente legible, firmas, marca.

## FASE 4 — Receta electrónica
Crear `MedicationRequest`: principio activo, dosis, presentación (**unidades correctas**). Disparar **CDS Hooks**: interacción fármaco-fármaco y **fármaco-alergia** del paciente (debe alertar). Firmar + emitir **PDF con QR** de validación.

## FASE 5 — Agenda/Turnos
Reservar turno (anti-double-booking), transición de estado (llegada → atendido → ausente), triaje de sala de espera. Verificar recordatorio manual (webhook firmado, si el módulo WhatsApp está activo).

## FASE 6 — Aislamiento multi-inquilino (Zero Trust) — CRÍTICO
Con token de un tenant, intentar leer datos (paciente/orden/receta) de OTRO tenant → debe dar **vacío/403**, nunca filtrar. Ningún endpoint clínico es cross-tenant (solo el super-admin, con su guard).

## Qué cazar (todas las fases)
500/502; 401/403 inesperados; Failed to fetch/CORS; pantalla en blanco; errores de consola; modales que no abren; rutas 404; validación floja (enum/fecha/requeridos → 500 en vez de 400); datos que no guardan o cambian solos; **firma que resulta editable (rompe inmutabilidad)**; nombre cifrado en pantalla; unidades/código LOINC mal; CDS que no alerta; **fuga entre inquilinos**; marca/responsive/contraste roto.

## Entregable — Reporte
Tabla: `| # | Fase | Severidad (R/A/B) | Pantalla/campo | Qué pasó | Reproducción | Esperado |`
Cierre: resumen por severidad y por flujo + veredicto (¿usable en prod?). Apto para abrir tareas en `docs/backlog.json` / tablero.

## Criterios de calidad
Todas las pantallas chequeadas; 3 pacientes + ficha completa + HC/visita con firma inmutable + 1 receta con CDS + prueba de aislamiento. Cada hallazgo reproducible y con severidad. Sin falsos positivos por mal tipeo.
