# Walkthrough — Presupuesto odontológico: Estado Contable + Ficha real + diseño Firma/Adjuntos

**Fecha:** 2026-07-27
**Rama:** `feature/presupuesto-odontologico`
**Orquestador:** Claude Code (sesión principal)
**Estado:** A+B+C+D implementados y verificados en backend (local). A+B con revisor APROBADO; C+D con gates security/revisor en curso. Falta confirmación visual del Super Admin. NADA commiteado ni desplegado.

---

## 1. Contexto y objetivo

El odontólogo pidió que el modal de presupuesto (que digitaliza el formulario PAMI de papel) dé una **visión exacta del dinero que el paciente está comprometido a pagar**, con 3 grillas: Presupuesto, Estado Contable y Ficha de Atención. Además pidió: **firma de conformidad del paciente por cada tratamiento realizado** y **poder adjuntar RX / archivos**.

Se descompuso en 4 piezas:
- **A** — Estado Contable (resumen + saldo vivo + grilla de pagos + registrar pago).
- **B** — Ficha de Atención real (fix de la fuente).
- **C** — Firma de conformidad del paciente por prestación (NUEVO requerimiento).
- **D** — Adjuntos RX/PDF al presupuesto y a cada prestación (NUEVO requerimiento).

---

## 2. Lo IMPLEMENTADO esta sesión (A + B, front-only + hardening backend)

### A — Pestaña "Estado contable" (`PresupuestoOdontologicoModal.tsx`)
- Resumen: **Total · Pagado · Saldo vivo** (verde si $0, rojo si debe) · **Valor de cuota** (total/cuotas). Lee `GET /clinica/finanzas/cuenta-corriente/:patientId` (ya devolvía ese resumen).
- **Estado + transiciones** (Presentar/Aceptar/Cancelar) reusando `POST /presupuesto/:id/{presentar|aceptar|cancelar}`.
- **Grilla de pagos** Fecha · Importe · **Saldo decreciente** fila por fila, desde `GET /pago?presupuestoId=`.
- **Registrar pago** (`POST /pago`), habilitado solo si estado ∈ {aceptado, en_curso} (`PUEDE_PAGAR`). Refresca saldo + estado tras registrar.
- **Cero backend nuevo, cero esquema** — reusa endpoints existentes.

### B — Ficha de Atención real (`OdontogramPAMI.tsx` + modal)
- **Fix de fondo:** antes la Ficha se armaba con toda la capa `existing` del odontograma, que mezclaba **tratamientos realizados** (`Procedure` completed) con **patologías previas** (`Condition`). Ahora:
  `realizados = existing.filter(r => r.resourceType === 'Procedure' && r.status === 'completed')`.
- Columnas: Fecha · Prestación/Código · Nº diente · Cara · **Firma de conformidad** (placeholder "pendiente" → enganche de la pieza C). Responsive.

### Hardening backend — fix BUG-2 (`clinica-finanzas.service.ts`)
- `registrarPago`: valida que el presupuesto **exista en el tenant** y esté en `aceptado`/`en_curso` antes de crear el pago (antes aceptaba pagos sobre borrador → estado incoherente; además cierra un **gap cross-tenant**).
- `deletePresupuesto`: bloquea el borrado si hay pagos vinculados (defensa contra pagos huérfanos).

---

## 3. Verificación (runtime, local)

Stack en Docker. Verificado por el orquestador con token real (`doctor_julio`, tenant `mi_consultorio_dent_hce`) y certificado por `qa` + `revisor`:

| Caso | Resultado |
|---|---|
| `POST /presupuesto` (campos PAMI) | 201, persiste todo |
| Transiciones presentar→aceptar | 201; transición inválida → 400 |
| Pago sobre **borrador** (post-fix) | **400** (rechazado) |
| Pago sobre **aceptado** | 201, estado → `en_curso` |
| Saldo vivo / cuenta-corriente | correctos |
| Aislamiento multi-inquilino | presupuesto ajeno → 404 |
| Ficha: filtro Procedure+completed | 0 Condition, solo realizados |
| `tsc` front + back, eslint modal | limpio (mis archivos) |
| `jest` backend | 150 pass; 12 fallos preexistentes en protesis (ajenos) |

**Revisor: APROBADO** (sin bloqueantes). Datos de prueba limpiados (baseline intacto).

### ⚠️ Nota de entorno crítica
El backend local corre `nest --watch` pero **el bind-mount Windows→Docker NO propaga cambios** (inotify). Tras editar backend hay que **`docker restart hce-backend-api`** (igual que `hce-frontend-client` para el front). Un falso "bug" (todo POST daba 400) resultó ser el proceso nest corriendo código viejo de hace 4 h.

---

## 4bis. C + D IMPLEMENTADOS y verificados en backend (local)

**C — Firma de conformidad del paciente por prestación:**
- Migración `20260727_1600_firma_conformidad_paciente.sql`: tabla `odontology_patient_signatures` (append-only) + **trigger de inmutabilidad** (primer trigger del repo, para evidencia legal) + `clinical_evidence_audit_log` (polimórfico, append-only) con su trigger.
- Backend: `odontology-patient-signature.{entity,service,controller}.ts`. Snapshot inmutable (`signed_content_snapshot`), hash SHA-256, columnas FHIR (Provenance/Signature). Almacén **privado** (`private-uploads/signatures`, NO `/uploads`). Descarga por endpoint autenticado + auditoría.
- Frontend: `SignaturePadModal.tsx` (canvas táctil) + columna "Firma de conformidad" en la Ficha (botón Capturar / ✓ Firmado + Ver).
- **Runtime verificado:** POST 201 (snapshot capturado), GET imagen autenticada 200, **sin token 401**, 2ª firma misma prestación **409**, UPDATE/DELETE SQL **rechazados por trigger**, auditoría `PATIENT_SIGN`+`PATIENT_SIGN_VIEW`. Datos de prueba limpiados.

**D — Adjuntos RX/PDF (presupuesto + prestación):**
- Migración `20260727_1700_clinical_attachments.sql`: tabla polimórfica `clinical_attachments` (owner_type presupuesto|procedure, CHECK), soft-delete, índices parciales.
- Backend: `clinical-attachment.{entity,service,controller}.ts`. **Magic-bytes** (JPG/PNG/PDF), validación **cross-tenant del owner** + `patientId` derivado del padre, descarga autenticada (Content-Disposition attachment para PDF, nosniff), soft-delete, auditoría.
- Frontend: `ClinicalAttachments.tsx` (panel subir/listar/descargar/borrar) en la pestaña Presupuesto (owner=presupuesto) y compacto por prestación en la Ficha (owner=procedure).
- **Runtime verificado:** upload PNG/PDF 201, **magic-bytes mismatch 400**, download autenticado 200, **sin token 401**, soft-delete OK, auditoría `ATTACH_UPLOAD/DOWNLOAD/DELETE`. Datos de prueba limpiados.

**Wiring:** entidades registradas en `app.module.ts` (lista explícita) + `odontology.module.ts` (forFeature + providers + controllers). La entidad `ClinicalPresupuesto` se importó en el módulo odonto para validar el owner=presupuesto.

**Migraciones aplicadas al LOCAL** (idempotentes, PROTOCOLO). Pendiente aplicarlas a **prod** (con CHECKPOINT, tras gates).

**Pendiente C+D:** gates security/revisor (en curso), confirmación visual (canvas + dropzone), y las tareas diferibles: cifrado en reposo del volumen (`REQ-001-INF-1.12`), y cierre de `/uploads` público (`REQ-001-INF-1.11`).

---

## 4. Diseño original de C + D (referencia — YA implementado, ver §4bis)

Diseños en `docs/design/`:
- `firma-conformidad-paciente-modelo-datos.md` (C)
- `adjuntos-presupuesto-ficha-modelo-datos.md` (D)

Decisiones del Super Admin: firma **por cada tratamiento realizado**, captura **manuscrita en canvas** (PNG). Adjuntos anclados **al presupuesto Y a cada prestación**, tipos **imágenes + PDF**.

### Gate `security` — APROBADO CON CONDICIONES (bloqueantes de esquema)
1. **C: `signed_content_snapshot jsonb NOT NULL`** — snapshot inmutable de lo firmado (el `Procedure` es mutable; sin snapshot la firma no tiene valor probatorio). **El bloqueante de fondo.**
2. **D: magic-bytes** obligatorio (no confiar en Content-Type) + extensión derivada del MIME validado.
3. **C+D: descarga de ePHI SOLO por endpoint autenticado** con filtro tenant + auditoría, desde almacén privado. **Nunca por `/uploads` estático.**
4. **D: validación cross-tenant del `owner_id` polimórfico**; `patient_id` derivado del padre, nunca del cliente.
5. **C+D: auditar la DESCARGA** (`PATIENT_SIGN_VIEW` / `ATTACH_DOWNLOAD`), no solo escritura. Reusar patrón `odontology_encounter_audit_log`.
- **Hallazgo separado (severidad Alta):** `/uploads` se sirve estático **sin auth** (`main.ts:24`) → ePHI descargable por URL. Tarea `REQ-001-INF-1.11`.

### Gate `fhir-mcp` — mapeo + delta de columnas (para no re-migrar)
- **C → `Provenance` + datatype `Signature`** (NO `Consent`). Código de firma: `1.2.840.10065.1.12.1.7` (ASTM "Consent Signature"). `Signature.data` NUNCA en DB (se hidrata on-demand tras validar hash).
- **D → `DocumentReference`** uniforme (NO `Media`, eliminado en R5). `Attachment.hash` es base64 → transcodificar desde el hex.
- **Columnas a agregar en la migración desde el día 1** (todas DEFAULT/nullable, aditivas):
  - Firma: `signature_type_system`, `signature_type_code`, **`hash_algo`**, `sig_format`, `fhir_meta jsonb`.
  - Adjuntos: **`hash_algo`**, `type_system`, `type_code`, `type_display`, `doc_status`, `fhir_extras jsonb`.
  - `hash_algo` es **bloqueante** (integridad/no repudio).

---

## 5. Backlog (docs/backlog.json — módulo 9 NUEVO "Finanzas Clínicas y Presupuestos")

| ID | Qué | Estado |
|---|---|---|
| `REQ-009-FIN-9.1` | A — Estado Contable | en_progreso (código listo + revisor OK; falta visual + gates security/ux) |
| `REQ-009-FIN-9.2` | B — Ficha real | en_progreso (idem) |
| `REQ-009-FIN-9.3` | C — Firma conformidad (diseño+gates OK) | pendiente de codear |
| `REQ-009-FIN-9.4` | D — Adjuntos RX/PDF (diseño+gates OK) | pendiente de codear |
| `REQ-009-FIN-9.5` | Tests unitarios de clinica-finanzas (TDD) | pendiente |
| `REQ-009-FIN-9.6` | Validación de precio/cantidad en backend | pendiente |
| `REQ-001-INF-1.11` | `/uploads` sin auth (ePHI, Alta) | pendiente |

*Tablero_control.md NO actualizado (regla de acceso exclusivo) — correr `backlog-sync` cuando esté libre.*

---

## 6. Próximos pasos (para la siguiente sesión/agente)

1. **Cerrar A+B:** confirmación visual del Super Admin en `localhost:5173` + firmas de gate `security`/`ux` → pasar 9.1/9.2 a completado.
2. **Codear C+D** incorporando los bloqueantes de los gates (sobre todo `signed_content_snapshot` y descarga autenticada). Migración con timestamp siguiendo `docs/PROTOCOLO-CAMBIOS-DB.md` + el delta de columnas de `fhir-mcp`. Convoca `code-generator` → gates `qa`/`security`/`revisor`/`ux`.
3. **Commit:** solo los 3 archivos de la feature A+B+fix (`PresupuestoOdontologicoModal.tsx`, `OdontogramPAMI.tsx`, `clinica-finanzas.service.ts`) + docs/backlog.json + docs. **NO** incluir el borrado de `aws/scripts/build-backend/` (ya restaurado).
4. **Deploy a prod:** solo con CHECKPOINT + OK. Recordar `docker restart` no aplica en prod (build real). La migración `20260721_1500` ya está en prod; A+B es solo frontend (falta desplegar el bundle).

## Archivos clave
- `hce-frontend/src/components/odontology/PresupuestoOdontologicoModal.tsx` (A + B ficha)
- `hce-frontend/src/components/odontology/OdontogramPAMI.tsx` (B filtro, líneas ~482-485)
- `hce-backend/src/clinica-finanzas/clinica-finanzas.service.ts` (fix BUG-2: registrarPago, deletePresupuesto)
- `docs/design/firma-conformidad-paciente-modelo-datos.md`, `docs/design/adjuntos-presupuesto-ficha-modelo-datos.md`
- `hce-backend/src/migrations/20260721_1500_presupuesto_odontologico_campos.sql` (ya aplicada local + prod)
