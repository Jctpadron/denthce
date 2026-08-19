# Tablero de Comando HCE - Seguimiento de Avance del Proyecto

Este tablero de comando detalla la totalidad de las tareas requeridas para construir la Historia Clínica Electrónica (HCE). Permite monitorear el progreso del desarrollo paso a paso, organizado por módulos funcionales e infraestructura.

---

## 🛠️ Cómo Usar este Tablero Vivo

Este es un **documento bidireccional y vivo**:
1. **Para Cambiar el Estado:** Puedes marcar las tareas completadas cambiando el checkbox de `- [ ]` a `- [x]` manualmente aquí. El script orquestador detectará el cambio y recalculará los porcentajes de avance automáticamente.
2. **Para Agregar Nuevas Funciones/Tareas:** Puedes escribir directamente una nueva línea bajo el módulo correspondiente usando el formato `- [ ] Tarea X.Y: Descripción de la nueva función. *(Prioridad: Alta/Media/Baja)*`. El motor de orquestación la registrará en la base de datos del backlog y la asignará a los agentes en la siguiente ejecución.
3. **Propuestas de los Agentes:** Si un agente de IA identifica un requerimiento faltante o una mejora en la seguridad/FHIR durante el análisis, te presentará una propuesta de tarea en la sección final de este documento para que la revises y apruebes.
4. **Responsable por tarea (coordinación multi-agente):** toda tarea/iniciativa en curso debe declarar su dueño con el sufijo **`(Responsable: Claude|Gemini|…)`**. Esto evita que dos agentes trabajen lo mismo. Este tablero (+ `docs/backlog.json` y `docs/adr/`) es la **fuente única de verdad**; las memorias privadas de cada agente NO lo son. Editar este archivo **solo si está libre** (no pisar a otro agente). Detalle del protocolo en `AGENTS.md` → "Fuente Única de Verdad y Arranque de Sesión".

---

## 📊 Estado de Avance General

| Módulo / Componente | Tareas Completadas | Tareas Totales | Progreso | Estado |
| :--- | :---: | :---: | :---: | :--- |
| **0. Orquestación y Diseño de Agentes** | 5 | 5 | `[██████████] 100%` | Completado |
| **1. Infraestructura y Seguridad (Zero Trust)** | 10 | 13 | `[████████░░] 77%` | En Progreso |
| **2. Registro Demográfico (FHIR Patient)** | 6 | 6 | `[██████████] 100%` | Completado |
| **3. Historia Clínica y Notas SOAP (FHIR Encounter)** | 12 | 12 | `[██████████] 100%` | Completado |
| **4. Receta Electrónica y Vademécum (CDS Hooks)** | 3 | 6 | `[█████░░░░░] 50%` | En Progreso |
| **5. Agenda, Citas y Admisión Hospitalaria** | 5 | 5 | `[██████████] 100%` | Completado |
| **6. Integración LIS (Laboratorio) y PACS (Imágenes)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **7. Portal del Paciente y Telemedicina (WebRTC)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **8. IA Clínica y Scribe Ambiental (WhisperX/Berta)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **9. Historia Clínica Odontológica PAMI (módulo aislado)** | 11 | 11 | `[██████████] 100%` | Completado |
| **10. Módulo Protesistas Dentales (DentaLab)** | 12 | 12 | `[██████████] 100%` | Completado |
| **11. Auditoría integral y remediación** | 7 | 19 | `[████░░░░░░] 37%` | En Progreso |
| **12. Finanzas Clínicas y Presupuestos** | 6 | 12 | `[█████░░░░░] 50%` | En Progreso |
| **PROGRESO GLOBAL DEL PROYECTO** | **77** | **116** | `[███████░░░] 66%` | **En Progreso** |

---

## 📋 Desglose Detallado de Tareas

### Módulo 0: Orquestación y Diseño de Agentes
*Fase inicial para configurar las herramientas de IA que guiarán el desarrollo.*

- [x] **Tarea 0.1:** Creación del script ejecutable de orquestación (`scripts/orchestration_runner.py`) con parser bidireccional de Markdown. *(Prioridad: Alta)*
- [x] **Tarea 0.2:** Definición e implementación del archivo de backlog dinámico (`docs/backlog.json`). *(Prioridad: Alta)*
- [x] **Tarea 0.3:** Creación de las instrucciones de sistema para los 9 agentes en `docs/agents/`. *(Prioridad: Alta)*
- [x] **Tarea 0.4:** Creación de los 4 skills en `docs/skills/` (Parser, Generador, Seguridad, QA). *(Prioridad: Media)*
- [x] **Tarea 0.5:** Documentación final del protocolo de comunicación y especificaciones de las herramientas del Servidor MCP. *(Prioridad: Media)*

---

### Módulo 1: Infraestructura y Seguridad (Zero Trust)
*Establecimiento de las bases tecnológicas, red y seguridad según normas internacionales.*

- [x] **Tarea 1.1:** Configuración del contenedor de Docker y esquema de despliegue para **Keycloak**. *(Prioridad: Alta)*
- [x] **Tarea 1.2:** Diseño del modelo de datos e inicialización de la base de datos **PostgreSQL** con soporte JSONB para FHIR. *(Prioridad: Alta)*
- [x] **Tarea 1.3:** Configuración de la federación de identidades y creación de Roles Clínicos (Médico, Enfermero, Recepción, Administrador) en Keycloak. *(Prioridad: Alta)*
- [x] **Tarea 1.4:** Implementación de la validación de tokens OAuth 2.0 en el API Gateway para peticiones REST. *(Prioridad: Alta)*
- [x] **Tarea 1.5:** Diseño de la tabla de auditoría inmutable clínica que genere registros del recurso `AuditEvent` de FHIR. *(Prioridad: Alta)*
- [x] **Tarea 1.6:** Implementación del Service Mesh (Linkerd o Istio) para cifrado automático TLS mutuo (mTLS) interno. *(Prioridad: Baja)*
- [x] **Tarea 1.7:** Creación de políticas de respaldo automatizadas (estrategia 3-2-1) y failover de bases de datos. *(Prioridad: Media)*
- [x] **Tarea 1.8:** Implementación de aislamiento lógico multi-inquilino (Multi-tenancy) a nivel de base de datos y backend REST API para profesionales independientes y clínicas. *(Prioridad: Alta)*
- [x] **Tarea 1.9:** Implementación de la API de creación y listado de sub-usuarios en el backend conectada a Keycloak Admin API con atributos multi-inquilino. *(Prioridad: Alta)*
- [x] **Tarea 1.10:** Interfaz de usuario en React para la Gestión de Personal (Secretarias/Enfermeros) y asignación automática al consultorio del doctor. *(Prioridad: Alta)*
- [ ] **Tarea 1.12:** Cifrado en reposo del volumen que aloja ePHI (`private-uploads`: firmas PNG + adjuntos RX/PDF). En AWS EB/EC2: EBS encryption (KMS). Migración futura a S3 con SSE-KMS + presigned GET de corta vida (el diseño ya es storage-agnóstico). *(Prioridad: Alta)*
- [ ] **Tarea 1.13:** Configurar `trust proxy` en `main.ts` para que `req.ip` capture la IP real detrás de Cloudflare Tunnel + reverse proxy. Hoy el `source_ip` de la firma de conformidad guarda la IP del proxy → degrada el valor probatorio (no repudio). *(Prioridad: Media)*
- [ ] **Tarea 1.14:** Rate limit poco realista: 100 req/15min **por IP** (`main.ts:30`). Sin `trust proxy`, toda una clínica comparte un mismo bucket → 429 en uso normal; además el 429 se emite antes del middleware CORS y el navegador no puede leer el cuerpo. Keyear por usuario/tenant. *(Prioridad: Alta — en progreso: límite subido 100→1000 como paliativo)*

> ℹ️ **Nota de registro (2026-08-19).** La **1.11** existía en el backlog describiendo el mismo hallazgo que **AUD.8** (`/uploads` sirve ePHI sin autenticación). Se marcó `duplicado` con `superseded_by: REQ-011-AUD-8` y **queda excluida del conteo**: se cerraba dos veces e inflaba el denominador. La canónica es AUD.8.

---

### Módulo 2: Registro Demográfico (FHIR Patient)
*Control de admisión y datos básicos estructurados de los pacientes.*

- [x] **Tarea 2.1:** Creación de la API de creación/lectura compatible con el recurso `Patient` de HL7 FHIR R4. *(Prioridad: Alta)*
- [x] **Tarea 2.2:** Formulario de registro en React para datos demográficos (Nombre, DNI/Pasaporte, Género autopercibido, Cobertura médica). *(Prioridad: Alta)*
- [x] **Tarea 2.3:** Implementación del motor de búsqueda universal de pacientes con control de duplicados (Master Patient Index - MPI). *(Prioridad: Alta)*
- [x] **Tarea 2.4:** Historial de trazabilidad y auditoría de cambios en datos demográficos del paciente. *(Prioridad: Media)*
- [x] **Tarea 2.5:** Integración con padrón gubernamental de personas/coberturas (ej. SISA en Argentina). *(Adaptador mock listo, credenciales reales via .env SISA_USER/SISA_PASSWORD/SISA_MOCK=false)*
- [x] **Tarea 2.6:** Pruebas de integración automatizadas para la admisión de pacientes, validación de esquemas FHIR Patient R4 y control de duplicados. *(Prioridad: Alta)*

---

### Módulo 3: Historia Clínica y Notas SOAP (FHIR Encounter)
*El núcleo asistencial de documentación para el profesional de la salud.*

- [x] **Tarea 3.1:** Creación del recurso `Encounter` de FHIR para gestionar los episodios (ambulatorio, hospitalización, urgencias). *(Prioridad: Alta)*
- [x] **Tarea 3.2:** Desarrollo de la interfaz de carga de la nota SOAP (Subjetivo, Objetivo, Apreciación, Plan) adaptativa y accesible. *(Prioridad: Alta)*
- [x] **Tarea 3.3:** Motor de autocompletado e integración de diagnósticos codificados con CIE-10 / SNOMED CT. *(Prioridad: Alta)*
- [x] **Tarea 3.4:** Firma digital avanzada de notas clínicas para profesionales con validación de credenciales. *(Prioridad: Alta)*
- [x] **Tarea 3.5:** Diseño de gráficos evolutivos de constantes vitales del paciente (Tensión, FC, Temperatura) extraídos de `Observation` FHIR. *(Prioridad: Media)*
- [x] **Tarea 3.6:** Mapeo de antecedentes heredofamiliares y personales del paciente (`Condition` FHIR). *(Prioridad: Media)*
- [x] **Tarea 3.7:** Desarrollo del módulo de Odontograma interactivo SVG (Adulto e Infantil) e historial de tratamiento clínico en español. *(Prioridad: Alta)*
- [x] **Tarea 3.8:** Ampliación del modelo de datos clínicos para registrar alergias (AllergyIntolerance), mediciones/signos vitales (Observation) y archivos adjuntos (DocumentReference/Media). *(Prioridad: Alta)*
- [x] **Tarea 3.9:** Implementación del controlador físico de archivos (Upload) con Multer — endpoint `POST /fhir/r4/Patient/:id/upload`, validación de tipos MIME (JPG/PNG/PDF/DOC) y límite de 20 MB. Persistencia como recursos FHIR `DocumentReference` o `Media`. *(Prioridad: Alta)*
- [x] **Tarea 3.10:** Implementación de la UI de Ficha Clínica con navegación por pestañas: 🦷 Odontograma · ⚠️ Alergias (FHIR AllergyIntolerance) · 💓 Signos Vitales (FHIR Observation / LOINC) · 📋 Documentos con drag & drop, galería y previsualización. *(Prioridad: Alta)*
- [x] **Tarea 3.11:** Pruebas de integración automatizadas para el registro de signos vitales (Observation), alergias (AllergyIntolerance), odontograma (Procedure) y validación de aislamiento multi-inquilino (Zero Trust). *(Prioridad: Alta)*
- [x] **Tarea 3.12:** Rediseño y actualización de la pantalla de inicio (HomeScreen / Dashboard principal) para incorporar widgets clínicos/administrativos dinámicos según el rol de Keycloak, y accesos directos a los módulos activos (Receta Electrónica, Agenda de citas). *(Prioridad: Alta)* *(Orquestado con product/ux/architect. Helper `useRoles` + catálogo declarativo `dashboard-modules`. Widget de recetas pendientes con endpoint agregado `GET /fhir/r4/MedicationRequest?status=draft`. Agenda queda como futuro: Módulo 5 al 0%.)*

---

### Módulo 4: Receta Electrónica y Vademécum (e-Prescribing)
*Prescripción y administración controlada de fármacos.*

- [x] **Tarea 4.1:** Creación del endpoint compatible con el recurso `MedicationRequest` de FHIR. *(Prioridad: Alta)*
- [x] **Tarea 4.2:** Integración de la base de datos de vademécum nacional/comercial (principios activos, dosis y presentaciones). *(Prioridad: Alta)*
- [x] **Tarea 4.3:** Implementación del motor de reglas **CDS Hooks** para alertar sobre interacciones fármaco-fármaco y fármaco-alergias del paciente. *(Prioridad: Alta)*
- [ ] **Tarea 4.4:** Panel de firma digital y emisión de recetas en PDF con códigos QR de validación farmacéutica. *(Prioridad: Alta)*
- [ ] **Tarea 4.5:** Implementación del Kardex de enfermería y registro de administración de medicamentos (eMAR / MAR). *(Prioridad: Media)*
- [ ] **Tarea 4.6:** Conciliación de medicamentos en altas hospitalarias. *(Prioridad: Media)*

> ⚠️ **Corrección de registro (2026-08-19).** La numeración de este módulo estaba corrida contra `docs/backlog.json` (el tablero saltaba de 4.3 a 4.5 y tenía una 4.7 inexistente), de modo que cada checkbox marcaba la tarea equivocada. **La 4.4 estaba sobredeclarada:** la firma digital SÍ existe (hash SHA-256, `signedBy`/`signedAt` y extensiones FHIR en `medication-request.service.ts`), pero **no existe la emisión en PDF** (`pdfkit` solo se usa en `odontology-pdf.service.ts`) **ni el QR** (`qrCodeData` apunta a `dentariehr.gov`, dominio inexistente; el frontend solo pinta el ícono `QrCode` de lucide-react). Vuelve a pendiente hasta desglosarla o completarla.

---

### Módulo 5: Agenda, Citas y Admisión Hospitalaria
*Control operativo de la ocupación, disponibilidad de profesionales y flujos de atención. **Versión consultorio:** las tareas 5.4/5.5 hospitalarias quedaron fuera de alcance por decisión de producto (2026-06-13).*

- [x] **Tarea 5.1:** Endpoint compatible con el recurso `Appointment` de FHIR para reserva y cancelación de turnos. *(Prioridad: Alta)* *(Backend: `appointment/` con idempotencia, anti-double-booking, auditoría y webhooks CliniChat. + `PATCH /:id/status` para transiciones llegada/atendido/ausente.)*
- [x] **Tarea 5.2:** Calendario visual interactivo para administración médica por profesional y consultorio. *(Prioridad: Alta)* *(Frontend `components/agenda/`: vista Día/Semana desde scheduleJson, alta/cancelación/cambio de estado. Walkthrough `2026-06-13_modulo5_agenda_visual.md`.)*
- [x] **Tarea 5.3:** Automatización de recordatorios de citas vía SMS, Email o WhatsApp API. *(Prioridad: Media)* *(Recordatorios automáticos los emite CliniChat (canal WhatsApp); la HCE dispara recordatorios manuales puntuales vía `POST /:id/reminder` → webhook `reminder` firmado HMAC.)*
- [x] **Tarea 5.4:** Módulo de Triaje Manchester/ESI para priorización de urgencias en guardia. *(Prioridad: Alta)* *(VERSIÓN CONSULTORIO: priorización de sala de espera ESI simplificado 1-5 sobre el turno (`WaitingRoom`). El algoritmo hospitalario de guardia completo queda fuera del alcance del producto consultorio.)*
- [x] **Tarea 5.5:** Módulo de Internación: Bed Management (gestión de camas, estados de limpieza y ocupación) e indicaciones de enfermería. *(Prioridad: Media)* *(VERSIÓN CONSULTORIO: widget Estado del box/sillón derivado del turno en atención (mono-profesional = 1 box). El bed management hospitalario completo queda fuera del alcance del producto consultorio.)*

---

### Módulo 6: Integración LIS (Laboratorio) y PACS (Imágenes)
*Interoperabilidad diagnóstica con proveedores externos e internos.*

- [ ] **Tarea 6.1:** Adaptador de mensajería HL7 v2.x (ORM/ORU) para recepción de órdenes y carga automática de resultados desde LIS. *(Prioridad: Alta)*
- [ ] **Tarea 6.2:** API compatible con el recurso `DiagnosticReport` de FHIR para visualización histórica de analíticas en HCE. *(Prioridad: Alta)*
- [ ] **Tarea 6.3:** Conector DICOM C-FIND/C-MOVE con servidores PACS e integración de visor web de imágenes DICOM (ej. OHIF Viewer). *(Prioridad: Alta)*
- [ ] **Tarea 6.4:** Generación de alertas inmediatas por resultados pánico/críticos al médico tratante. *(Prioridad: Alta)*
- [ ] **Tarea 6.5:** Vinculación directa del informe estructurado del radiólogo al estudio de imagen en la historia del paciente. *(Prioridad: Media)*

---

### Módulo 7: Portal del Paciente y Telemedicina
*Acceso directo de los ciudadanos a su información médica y teleconsultas.*

- [ ] **Tarea 7.1:** Autenticación de pacientes mediante Keycloak y autorización OAuth 2.0 (SMART on FHIR). *(Prioridad: Alta)*
- [ ] **Tarea 7.2:** Panel del Paciente: Consulta de resultados de lab, recetas activas descargables e historial de vacunas (`Immunization`). *(Prioridad: Alta)*
- [ ] **Tarea 7.3:** Integración de videoconsultas segura extremo a extremo utilizando WebRTC (Jitsi/Daily.co). *(Prioridad: Alta)*
- [ ] **Tarea 7.4:** Implementación de firmas electrónicas de consentimiento informado del paciente previas a procedimientos. *(Prioridad: Media)*
- [ ] **Tarea 7.5:** Chat encriptado de comunicación asincrónica médico-paciente. *(Prioridad: Baja)*

---

### Módulo 8: IA Clínica y Scribe Ambiental (Fase Avanzada)
*Servicios inteligentes de soporte y reducción de carga administrativa.*

- [ ] **Tarea 8.1:** Integración de transcriptor de voz por IA (WhisperX) con el editor de consultas. *(Prioridad: Media)*
- [ ] **Tarea 8.2:** Desarrollo del backend de generación de notas SOAP a partir de transcripción de audio (LLM local Ollama/vLLM - Berta Scribe). *(Prioridad: Media)*
- [ ] **Tarea 8.3:** Motor de extracción de entidades clínicas mediante procesamiento del lenguaje natural (NLP) para poblar campos FHIR automáticamente. *(Prioridad: Media)*
- [ ] **Tarea 8.4:** Resumen clínico instantáneo del paciente al abrir su ficha (medicación activa, alergias, últimas consultas). *(Prioridad: Alta)*
- [ ] **Tarea 8.5:** Framework de análisis de cohortes y estadísticas epidemiológicas hospitalarias (LATCH). *(Prioridad: Baja)*

---

### Módulo 9: Historia Clínica Odontológica PAMI (módulo AISLADO)
*HC odontológica completa modelo PAMI / Círculo Odontológico de Jujuy, como servicio separado de la ficha original (tabla y endpoints propios). Detalle en `docs/walkthroughs/2026-05-29_hc_odontologica_modulo_aislado.md`.*

- [x] **Tarea 9.1:** Módulo backend aislado `odontology/` con tabla propia `odontology_clinical_resources` y endpoints `/odontology`, filtrado por tenantId. *(Prioridad: Alta)*
- [x] **Tarea 9.2:** Pantalla `OdontologyHC` (búsqueda con padrón compartido) colgada del dashboard como servicio `odonto-hc`. *(Prioridad: Alta)*
- [x] **Tarea 9.3:** Odontograma de doble capa (existente rojo / a realizar azul) con catálogo de simbología centralizado (13 estados), glifos por tipo, barra agrupada, toast flotante y leyenda. *(Prioridad: Alta)*
- [x] **Tarea 9.4:** Anamnesis odontológica PAMI (cuestionario + higiene) con firma del paciente (QuestionnaireResponse). *(Prioridad: Alta)*
- [x] **Tarea 9.5:** Estado bucal general + diagnóstico presuntivo + plan + observaciones (Observation). *(Prioridad: Media)*
- [x] **Tarea 9.6:** Datos de afiliado / obra social (Coverage). *(Prioridad: Media)*
- [x] **Tarea 9.7:** Consentimiento informado con doble firma y matrícula (Consent). *(Prioridad: Alta)*
- [x] **Tarea 9.8:** Anexo de evolución (fecha / tratamiento / conformidad del afiliado). *(Prioridad: Media)*
- [x] **Tarea 9.9:** Exportación de la HC en PDF formato oficial PAMI (3 hojas). *(Prioridad: Alta)*
- [x] **Tarea 9.10a:** Quality Gates (security/qa): Diseño de tests unitarios/integración de controlador/servicio, validación de aislamiento tenant y firma de auditoría de seguridad. *(Prioridad: Alta)*
- [x] **Tarea 9.10b:** Despliegue a AWS: Creación de la tabla `odontology_clinical_resources` en RDS, recompilación y publicación del backend. *(Prioridad: Alta)*

---

### Iniciativa transversal: Plataforma SaaS — Super Admin y Servicios Anexables
*El HCE es el producto base; los demás productos (WhatsApp/CliniChat, etc.) son servicios que se anexan a una clínica solo si la contrató. Rama `feature/superadmin-servicios`. Diseño: `docs/design/superadmin-servicios-anexables.md`. Walkthrough: `docs/walkthroughs/2026-06-13_superadmin_servicios_anexables.md`. (Fuera del conteo de los 70 del plan original.)*

- [x] **SA.1:** Modelo de datos de módulos/suscripción (`platform_modules` + `tenant_modules` + `plan`/`is_active`) + rol `superadmin` + `SuperAdminGuard`. *(Prioridad: Alta)*
- [x] **SA.2:** Entitlements (`ModulesService.isEnabled`) + gate del módulo WhatsApp en recordatorios/webhooks. Cierra el GAP del producto modular. *(Prioridad: Alta)*
- [x] **SA.3:** API Super Admin cross-tenant: listar/crear clínicas, togglear módulos, métricas. *(Prioridad: Alta)*
- [x] **SA.5:** Panel Super Admin (React, estética DentHCE): Resumen, Clínicas, toggles de módulos, alta de clínica. *(Prioridad: Alta)*
- [x] **SA.4A:** Generación del service-account de Keycloak por clínica (rol `servicio-turnos` mínimo privilegio + mapper `tenant_id`). Verificado contra Keycloak real. *(Prioridad: Alta)*
- [ ] **SA.4B:** Orquestación HCE→CliniChat (entrega automática de credenciales al anexar). BLOQUEADA: requiere endpoint nuevo en `clinichat-assistant` (handoff entregado: `docs/integraciones/HANDOFF-CLINICHAT-orquestacion-hce.md`). *(Prioridad: Media)*
- [ ] **SA.6:** Despliegue a producción (migración RDS de módulos + roles Keycloak + usuario superadmin) y verificación visual del panel. *(Prioridad: Media)*

---

### Módulo 10: Protesistas Dentales (DentaLab / ProtesisChat)
*Módulo para laboratorios dentales y protesistas, integrable con la HCE mediante entitlements y aislado lógicamente. Responsable: Gemini. (Cuenta como Módulo 10 desde el 2026-08-19.)*

- [x] **PRO.1:** Modelado de datos en NestJS compatible con FHIR R4: `DeviceRequest` (órdenes) y `Communication` (chat y mensajería clínica). *(Prioridad: Alta)*
- [x] **PRO.2:** Backend APIs: Controladores y servicios para gestión de trabajos de prótesis y chat. *(Prioridad: Alta)*
- [x] **PRO.3:** Frontend React: Pestaña "Prótesis" en la HCE del odontólogo (`OdontologyHC`) para prescripciones y chat del caso (Formulario optimizado: mini-odontograma, fechas seguras, acoplamiento de materiales y dropzone de STL integrada). *(Prioridad: Alta)*
- [x] **PRO.4:** Frontend React: Portal del Protesista (`DentaLabPortal`) que se activa dinámicamente si el tenant es tipo "laboratorio" (Dashboard de producción y panel de almacén/inventario con alertas de stock bajo y trazabilidad integrados). *(Prioridad: Alta)*
- [x] **PRO.5:** Visor 3D STL básico en el chat y drag & drop de archivos CAD/exocad. (Desarrollado visor interactivo 3D con Three.js en chats de odontólogo y protesista). *(Prioridad: Media)*
- [x] **PRO.6:** Pruebas e2e, auditoría responsiva y despliegue del módulo. (Verificación y build exitoso con soporte responsivo y tipado TypeScript). *(Prioridad: Alta)*
- [x] **PRO.7:** Máquina de estados formal con tabla `protesis_status_history`: validación de transiciones, auditoría automática (quién, cuándo, desde/hacia qué estado, motivo). *(Prioridad: Alta)*
- [x] **PRO.8:** Endpoints `GET /protesis/history` (trabajos completados) y `GET /:id/history` (línea de tiempo de estados). *(Prioridad: Alta)*
- [x] **PRO.9:** Frontend — Pestaña "Históricos" en DentaLabPortal con timeline visual + separación activos/históricos en ProtesisTab del odontólogo. *(Prioridad: Alta)*
- [x] **PRO.10:** Módulo Financiero de Prótesis — Entidades Pago/ConsumoInsumo + campos presupuesto/estadoPago en orden + precioUnitario en insumo. *(Prioridad: Alta)*
- [x] **PRO.11:** Backend endpoints financieros: presupuesto estimado/final, registrar pago, registrar consumo, finanzas por orden, cuenta corriente. *(Prioridad: Alta)*
- [x] **PRO.12:** Frontend Financiero: pestaña Finanzas, Dashboard widgets, sub-tab Finanzas en detalle, modales Pago/Consumo. *(Prioridad: Alta)*

---

### Iniciativa transversal: Auditoría de Responsividad/Accesibilidad Móvil (QA)
*Auditoría E2E móvil (Android) de la HCE. **Documento CANÓNICO:** `docs/qa/auditoria_responsividad_movil.md` (v2, realineada al sistema actual). El doc `docs/specs/auditoria_general_hce.md` quedó **SUPERSEDIDO** (duplicado desalineado, con "65 años" y componentes ocultos) — no usar. Responsable: Claude. (Fuera del conteo de los 70 del plan.)*

- [x] **QA.1:** Framework de auditoría v2 (matriz de control + flujo E2E realineado: login Keycloak, HC Odontológica + Imágenes/docs, Home nuevo, landing + automatización axe/Lighthouse/BrowserStack + gate de release). *(Prioridad: Alta)*
- [x] **QA.2:** Hallazgos ya corregidos en Home/header móvil (overflow → "Salir" fuera de pantalla; íconos lucide; admin movido al avatar). *(Prioridad: Alta)*
- [ ] **QA.3:** Ejecución de la auditoría pantalla por pantalla (screenshots + axe) y registro en la tabla consolidada del doc canónico. *(Prioridad: Media)*

---

### Iniciativa transversal: Port de gobernanza LabFlow→HCE
*Portar la gobernanza multi-agente más madura del proyecto gemelo LabFlow LIS, para que ambos sean "idénticos en conceptos", sin degradar lo que la HCE ya tiene mejor. Análisis punto por punto en 3 tiers. Walkthrough: `docs/walkthroughs/2026-07-21_port_gobernanza_labflow_tier1.md`. Responsable: Claude. (Fuera del conteo de los 70.)*

- [x] **GOV.1:** Skill `entrevistador-procesos` como **Fase 0** de la orquestación (regla de proporción + CHECKPOINT). Justificada y aprobada por Super Admin. *(Prioridad: Media)*
- [x] **GOV.2:** Agente `revisor` (Quality Gate técnico del diff, reutiliza `/code-review`) en `.claude/agents/` + `docs/agents/`; cableado corregido en CLAUDE.md. *(Prioridad: Media)*
- [x] **GOV.3:** Fix dato desactualizado en `CLAUDE.md` ("Documentos clave" decía 61% global). Corregido el 2026-08-19 al valor real recalculado: **66% (77/116)**. *(Prioridad: Baja)*
- [ ] **GOV.4 (Tier 2/3):** Portar/adaptar skills `verificador-clinico`, `security-audit`, `testing-and-validation`, `qa-carga-admision`, `optimizador-prompts`; autorear `docs/REGLAS-ESTABILIDAD.md` y `docs/PROTOCOLO-CAMBIOS-DB.md`; llevar el principio CHECKPOINT + espejos `.agents/`/`.codex/` a `AGENTS.md`. *(Prioridad: Media)*
- [ ] **GOV.5:** Resolver el desalineo de `.github/workflows/deploy.yml` (`application_name: hce-backend` + `environment_name: HceBackend-env`) contra el prod REAL (app EB `odontocloud` + env `Odontocloud-env`, verificado en AWS). El deploy real hoy es manual vía `aws/scripts/deploy-aws.ps1` (correcto); `deploy.yml` (CI) nunca se usó. Decidir: alinear `deploy.yml` a la infra real **o** retirarlo si el deploy se mantiene por PowerShell. Conocido desde handoff 2026-06-18. *(Prioridad: Baja)*
- [ ] **GOV.6:** Remediación de **secretos hardcodeados** + mecanismo de salvaguarda de claves/apikeys. Se hallaron secretos REALES en archivos trackeados y en el historial de git (DB password, admin Keycloak, client_secret). Detalle ejecutable por cualquier agente en `docs/security/remediacion-secretos-hardcodeados.md` (inventario por archivo:línea, mecanismo env-only + Secrets Manager + gitleaks en CI, remediación y ROTACIÓN). *(Prioridad: Alta)*
- [ ] **GOV.8:** **Provisioning Keycloak sin `tenant_id` (rotura silenciosa).** El alta por admin API (SA.4A `createUser`) NO seteaba `tenant_id` porque `unmanagedAttributePolicy` estaba `DISABLED` (default KC24+) → PUT 204 sin guardar. **RESUELTO (2026-07-21):** realm `hce-realm` seteado a **`ADMIN_EDIT`** (mínimo privilegio; NO `ENABLED`, que permitiría a un usuario auto-setearse `tenant_id` → acceso cross-tenant). Pendiente: (a) verificar que SA.4A ahora setea `tenant_id` en altas nuevas; (b) declarar `tenant_id` como atributo **gestionado** con validación (patrón slug) para robustez; (c) reflejar el estado del realm en `REGLAS-ESTABILIDAD.md`. *(Prioridad: Alta)*
- [ ] **GOV.7:** **Runner de migraciones automático** para la HCE (hoy el esquema se aplica por SQL manual, SIN tabla de tracking → todo a ojo). Implementar: carpeta `migrations/` numerada e idempotente + tabla `schema_migrations` + runner que aplique solo lo pendiente en cada deploy (hook predeploy EB, modelo LabFlow). **`DB_SYNCHRONIZE=false` se mantiene** (red de seguridad; `synchronize=true` en prod puede DROPear datos). Runbook: `docs/deploy/RUNBOOK-DEPLOY-SEGURO.md` §A4. *(Prioridad: Media)*

---

### Deploy a prod + Feature Presupuesto odontológico (2026-07-21)
*Handoff: `docs/walkthroughs/2026-07-21_deploy_gating_gobernanza_y_presupuesto.md`. Responsable: Claude.*

- [x] **DEPLOY.1:** Deploy a prod de `main` — **activó gating enforcement + alta de laboratorio** (backend `prod-20260721-1542`, front alineado). Smoke OK. Prep del gating (finanzas-clinicas + tenant_ids Keycloak) aplicada para no romper a nadie. *(Prioridad: Alta)*
- [x] **PRES.1:** **Modal de presupuesto odontológico** — al armar el Plan del odontograma, modal que digitaliza el formulario PAMI reusando `clinica_presupuestos`. Diseño (ux+architect) + backend + frontend + migración. Mergeado a `main` y **DESPLEGADO a prod** (`prod-20260727-1244`), migración aplicada (8 columnas), smoke funcional OK (POST presupuesto con campos nuevos → 201, luego borrado). **Fix incluido:** bug pre-existente del módulo finanzas (DTOs clase sin decoradores rompían el ValidationPipe `forbidNonWhitelisted`) → DTOs a interface + `import type`. Pendiente: gates security/qa/ux formales. *(Prioridad: Media)*

---

### Módulo 11: Auditoría integral y remediación (2026-08-17)
*Auditoría con 5 subagentes (security/revisor/ux/architect/qa) + punto cero del repositorio. **Handoff canónico:** `docs/walkthroughs/2026-08-17_pendientes_seguridad_critica_y_deuda_estructural.md`. Responsable: Claude. **(Cuenta como Módulo 11 desde el 2026-08-19.)***

**Hecho el 2026-08-17:**

- [x] **AUD.1:** Punto cero del repositorio (PR #3). Producción se compilaba desde archivos **sin commitear**: no era reconstruible ni reversible desde git. 163 pendientes → 0; 7 ramas muertas eliminadas; copia fantasma del backend (115 archivos) y 13 MB de evidencia clínica sacados de git. Respaldo íntegro: rama `snapshot/pre-limpieza-2026-08-17`. *(Prioridad: Alta)*
- [x] **AUD.2:** Guard de trazabilidad en `deploy-aws.ps1` (PR #4) — bloquea empaquetar o desplegar desde un árbol sucio; `-RequireTag` y log de procedencia. *(Prioridad: Alta)*
- [x] **AUD.3:** Tags de producción por componente (`prod-backend-20260730/20260817/20260818`, `prod-frontend-20260803`). Eliminado el desfasaje frontend 03/08 ↔ backend 30/07. *(Prioridad: Alta)*
- [x] **AUD.4:** **CI verde** (PR #6) — primera corrida verde desde el 2026-06-18. `test-backend` ya no depende de `lint`: los 172 tests **no se ejecutaron en GitHub durante dos meses**. Baseline de lint congelado con trinquete `--max-warnings`; prettier resuelto de raíz (117 archivos). *(Prioridad: Alta)*
- [x] **AUD.5:** Validación de pagos + rechazo de sobrepago (PR #5) — desplegado en `prod-backend-20260817`. *(Prioridad: Alta)*
- [x] **AUD.6:** Definición canónica de deuda — clamp, filtro de estados, `vencido` en dashboard, morosos por paciente. Bug reproducido contra prod (`deudaActual: -188` → `0`). Desplegado en `prod-backend-20260818`. *(Prioridad: Alta)*
- [x] **AUD.7:** Usuario IAM `denthce-deploy` de mínimo privilegio (PR #7, #8). Antes: cero usuarios IAM y dos claves root activas. `Deny` explícito sobre evidencia clínica, IAM y RDS — verificado. *(Prioridad: Alta)*

**PENDIENTE — ningún crítico de seguridad fue corregido:**

- [ ] **AUD.8:** 🔴 **`/uploads` sirve ePHI sin autenticación** (radiografías y firma del odontólogo, nombre predecible). Migrar a `EvidenceStorageService`, que ya existe. Orden obligatorio: firma+adjuntos de paciente (colateral casi nulo, ya rotos en prod) → separar `/uploads/logos/` (público por diseño, si no se rompe el login) → documentos odontológicos con lectura dual → recién ahí quitar `express.static`. *(Prioridad: Alta)*
- [ ] **AUD.9:** 🔴 **Rotar secretos** — clave RDS de prod en 8 archivos de `testing/scripts/`, admin de Keycloak y `client_secret` en `keycloak-admin.service.ts`. Secuencia de 4 pasos (env con fallback → deploy → setear variable → rotar → quitar fallback): rotar antes rompe el alta de clínicas. Complementa GOV.6. *(Prioridad: Alta)*
- [ ] **AUD.10:** 🔴 **Contraseñas semilla vivas en producción** (`doctor_julio`/`doctor_pass_2026`, patrón `{username}_pass_2026`, `temporary:false`) + ROPC habilitado + realm sin MFA, sin política de contraseñas y sin anti-fuerza bruta. *(Prioridad: Alta)*
- [ ] **AUD.11:** 🔴 **`hceWebhookSecret` devuelto a cualquier rol autenticado** por `GET /api/tenant/config` (incluye `paciente` y `laboratorio-operador`). Falta `select: false` + DTO de proyección. *(Prioridad: Alta)*
- [ ] **AUD.12:** 🔴 **DTOs como `interface` → el `ValidationPipe` no valida nada.** Habilita mass-assignment cross-tenant. Mitigación inmediata sin riesgo: invertir el spread `create({ ...dto, tenantId })`. Migración a clases con `class-validator`: endpoint por endpoint, nunca global (ya rompió endpoints una vez — ver PRES.1). *(Prioridad: Alta)*
- [ ] **AUD.13:** `RolesGuard` **fail-open** (sin `@Roles` → permite) y `/api/sisa/verificar` sin `@Roles` → enumeración del padrón RENAPER. Pasar a deny-by-default con modo sombra previo. *(Prioridad: Alta)*
- [ ] **AUD.14:** `deleteFile` ignora el tenant: un `medico` de cualquier clínica borra archivos de otra. Soft-delete + auditoría. *(Prioridad: Alta)*
- [ ] **AUD.15:** Deuda estructural: sin paginación en ningún service · sin transacciones en operaciones multi-tabla · sin migraciones versionadas · `tenantId` de doble semántica con `AUTH_STRICT=false` · sin auditoría de **lectura** de ePHI · rate limit por IP compartido entre tenants. *(Prioridad: Media)*
- [ ] **AUD.16:** 13 bugs reales de React congelados como `warn` (3 render impuro, 8 componentes que se remontan y pierden el foco, 2 mutación). Listados con archivo y línea en `hce-frontend/eslint.config.js`. Corregir y volver a `error`. *(Prioridad: Media)*
- [ ] **AUD.17:** **Desactivar las 2 claves root de AWS.** Requiere inventario humano (IAM → Last used). Orden seguro en `aws/iam/README.md`. *(Prioridad: Alta)*
- [ ] **AUD.18:** Decisiones de producto que bloquean sus ADR: (a) ¿se vende a clínicas multi-profesional? Hoy `Practitioner` se sintetiza desde `tenant_config` — **un profesional por clínica cableado en la capa de datos**; (b) ¿qué pasa con la Ficha Clínica general, hoy inalcanzable desde el menú, lo que deja las alertas de alergia sin datos posibles? *(Prioridad: Alta)*
- [ ] **AUD.19:** Avisar a los tenants activos del cambio de números (deuda negativa → 0, `deudaTotal` sube al incluir vencidos, `pacientesMorosos` baja) y decidir qué hacer con el sobrepago histórico de $188 en `PRES-0001`. *(Prioridad: Media)*

---

### Módulo 12: Finanzas Clínicas y Presupuestos
*Presupuesto odontológico, Estado Contable con pagos dinámicos, ficha de atención, firma de conformidad y adjuntos. En producción desde el 2026-07-28. Handoff: `docs/walkthroughs/2026-07-27_presupuesto_estado_contable_ficha_firma_adjuntos.md`. Responsable: Claude.*

> ℹ️ **Alta de registro (2026-08-19).** Estas tareas existían en `docs/backlog.json` pero **nunca se listaron en el tablero**, así que su avance era invisible acá. Además estaban numeradas `REQ-009-FIN-9.x`, colisionando con la HC Odontológica (Módulo 9): se renumeraron a `REQ-012-FIN-12.x`. Las descripciones largas se abrevian con «…»; el texto íntegro vive en `docs/backlog.json`.

- [x] **Tarea 12.1:** Modal presupuesto — pestaña Estado Contable: resumen Total/Pagado/Saldo vivo, valor de cuota, grilla de pagos (Fecha·Importe·Saldo decreciente), registrar pago y transiciones de estado (presentar/aceptar/cancelar). Front-only reusando endpoints de Finanzas (cuenta-corriente, pago). *(Prioridad: Alta)*
- [x] **Tarea 12.2:** Ficha de Atención real: filtrar tratamientos realizados (Procedure con status completed) excluyendo patologías previas (Condition) que se colaban desde la capa Existente. Columnas Fecha·Código·Nº diente·Cara·Firma (pendiente). *(Prioridad: Alta)*
- [x] **Tarea 12.3:** Firma de conformidad del paciente POR cada tratamiento realizado: captura manuscrita en canvas → PNG, tabla append-only odontology_patient_signatures (puntero de almacenamiento agnóstico local→S3 + hash SHA-256). Diseño listo; gates security y fhir-mcp APROBADOS con condiciones. BLOQUEANTES de es… *(Prioridad: Alta)*
- [x] **Tarea 12.4:** Adjuntos RX/PDF (imágenes+PDF) al presupuesto y a cada prestación: tabla polimórfica clinical_attachments, soft-delete, validación magic-bytes, descarga por endpoint autenticado con filtro tenant. Diseño listo; gates security y fhir-mcp APROBADOS con condiciones. Mapeo DocumentReference (no Media… *(Prioridad: Alta)*
- [ ] **Tarea 12.5:** Tests unitarios de clinica-finanzas.service (TDD ausente en lógica financiera crítica): pago sobre cada estado no-pagable (400), aislamiento cross-tenant (404), borrado con pagos (bloqueado), recálculo de estado en_curso/pagado, getCuentaCorriente (saldo, max(0,...)). *(Prioridad: Media)*
- [ ] **Tarea 12.6:** Robustez de API: validar precioUnitario>0 y cantidad>=1 en el backend (createPresupuesto/updatePresupuesto). Hoy el front lo valida pero el backend usa cantidad||1 y no valida precio → un cliente directo puede crear items con precio 0. *(Prioridad: Media)*
- [ ] **Tarea 12.7:** Recaptura/supersede de firma de conformidad (si el paciente firmó mal). El andamiaje existe (columna superseded_by, trigger que permite marcarlo una vez, acción de auditoría PATIENT_SIGN_SUPERSEDE), pero falta el método de servicio que ejecute el supersede; hoy la 2da firma sobre una prestación l… *(Prioridad: Baja)*
- [x] **Tarea 12.8:** Fan-out de requests en la Ficha del modal: al abrir la pestaña Ficha se dispara 1 GET de firma por prestación + 1 GET de adjuntos por prestación (N+N). Para un paciente con muchas prestaciones completadas puede acercarse al límite de rate. Batchear: endpoint que devuelva firmas vigentes por lista… *(Prioridad: Media)*
- [ ] **Tarea 12.9:** Reemplazar el window.prompt de anulación de pago por un modal del design-system (motivo + confirmación), estilable y mobile-safe. *(Prioridad: Baja)*
- [ ] **Tarea 12.10:** Revisar con security si el logger.warn de anularPago (incluye monto y motivo del pago) debe redactar/omitir datos sensibles en el pipeline de logs. *(Prioridad: Baja)*
- [x] **Tarea 12.11:** `getCuentaCorriente`: la `deudaActual` global sumaba TODOS los presupuestos (incluidos cancelados) y no clampaba el sobrepago por presupuesto, asi que un excedente compensaba la deuda de otro. **RESUELTO por AUD.6** (`ESTADOS_DEVENGAN_DEUDA` + `saldoDePresupuesto()` + `excedentePagado`), desplegado en `prod-backend-20260818` y cubierto por `clinica-finanzas.service.spec.ts`. *(Prioridad: Baja)*
- [ ] **Tarea 12.12:** patientId no validado como UUID en los DTOs de finanzas → un valor no-UUID da 500 genérico en vez de 400. Defensa en profundidad (el front siempre manda UUID). *(Prioridad: Baja)*

---

> 🤝 **Coordinación entre agentes (Claude + Gemini):** la **fuente única de verdad del estado** es este `tablero_control.md` + `docs/backlog.json`. Todo trabajo/propuesta se registra acá con **responsable**. Regla de artefactos: **uno canónico**; los duplicados se marcan **SUPERSEDIDO** apuntando al vigente. Las memorias privadas de cada agente **no** son estado compartido. Editar el tablero **solo si está libre** (no pisar al otro agente).

---

## 💡 Propuestas de Nuevas Funciones (Buzón de Entrada)
*Agrega aquí tus nuevas ideas o necesidades para que la IA las analice e incorpore al desglose anterior.*

- *Ejemplo: - [ ] Tarea 1.8: Integración con sistema de autenticación biométrica en recepción. (Pendiente de clasificación)*
