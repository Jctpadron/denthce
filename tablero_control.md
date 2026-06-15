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
| **1. Infraestructura y Seguridad (Zero Trust)** | 10 | 10 | `[██████████] 100%` | Completado |
| **2. Registro Demográfico (FHIR Patient)** | 6 | 6 | `[██████████] 100%` | Completado |
| **3. Historia Clínica y Notas SOAP (FHIR Encounter)** | 12 | 12 | `[██████████] 100%` | Completado |
| **4. Receta Electrónica y Vademécum (CDS Hooks)** | 4 | 6 | `[███████░░░] 67%` | En Progreso |
| **5. Agenda, Citas y Admisión Hospitalaria** | 5 | 5 | `[██████████] 100%` | Completado (versión consultorio) |
| **6. Integración LIS (Laboratorio) y PACS (Imágenes)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **7. Portal del Paciente y Telemedicina (WebRTC)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **8. IA Clínica y Scribe Ambiental (WhisperX/Berta)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **9. HC Odontológica PAMI (módulo aislado)** | 11 | 11 | `[██████████] 100%` | Completado |
| **PROGRESO GLOBAL DEL PROYECTO** | **53** | **70** | `[████████░░] 76%` | **En Progreso** |

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
- [x] **Tarea 4.5:** Panel de firma digital y emisión de recetas en PDF con códigos QR de validación farmacéutica. *(Prioridad: Alta)*
- [ ] **Tarea 4.6:** Implementación del Kardex de enfermería y registro de administración de medicamentos (eMAR / MAR). *(Prioridad: Media)*
- [ ] **Tarea 4.7:** Conciliación de medicamentos en altas hospitalarias. *(Prioridad: Media)*

---

### Módulo 5: Agenda, Citas y Admisión Hospitalaria
*Control operativo de la ocupación, disponibilidad de profesionales y flujos de atención.*

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

### Iniciativa transversal: Auditoría de Responsividad/Accesibilidad Móvil (QA)
*Auditoría E2E móvil (Android) de la HCE. **Documento CANÓNICO:** `docs/qa/auditoria_responsividad_movil.md` (v2, realineada al sistema actual). El doc `docs/specs/auditoria_general_hce.md` quedó **SUPERSEDIDO** (duplicado desalineado, con "65 años" y componentes ocultos) — no usar. Responsable: Claude. (Fuera del conteo de los 70 del plan.)*

- [x] **QA.1:** Framework de auditoría v2 (matriz de control + flujo E2E realineado: login Keycloak, HC Odontológica + Imágenes/docs, Home nuevo, landing + automatización axe/Lighthouse/BrowserStack + gate de release). *(Prioridad: Alta)*
- [x] **QA.2:** Hallazgos ya corregidos en Home/header móvil (overflow → "Salir" fuera de pantalla; íconos lucide; admin movido al avatar). *(Prioridad: Alta)*
- [ ] **QA.3:** Ejecución de la auditoría pantalla por pantalla (screenshots + axe) y registro en la tabla consolidada del doc canónico. *(Prioridad: Media)*

---

> 🤝 **Coordinación entre agentes (Claude + Gemini):** la **fuente única de verdad del estado** es este `tablero_control.md` + `docs/backlog.json`. Todo trabajo/propuesta se registra acá con **responsable**. Regla de artefactos: **uno canónico**; los duplicados se marcan **SUPERSEDIDO** apuntando al vigente. Las memorias privadas de cada agente **no** son estado compartido. Editar el tablero **solo si está libre** (no pisar al otro agente).

---

## 💡 Propuestas de Nuevas Funciones (Buzón de Entrada)
*Agrega aquí tus nuevas ideas o necesidades para que la IA las analice e incorpore al desglose anterior.*

- *Ejemplo: - [ ] Tarea 1.8: Integración con sistema de autenticación biométrica en recepción. (Pendiente de clasificación)*