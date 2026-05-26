# Tablero de Comando HCE - Seguimiento de Avance del Proyecto

Este tablero de comando detalla la totalidad de las tareas requeridas para construir la Historia Clínica Electrónica (HCE). Permite monitorear el progreso del desarrollo paso a paso, organizado por módulos funcionales e infraestructura.

---

## 🛠️ Cómo Usar este Tablero Vivo

Este es un **documento bidireccional y vivo**:
1. **Para Cambiar el Estado:** Puedes marcar las tareas completadas cambiando el checkbox de `- [ ]` a `- [x]` manualmente aquí. El script orquestador detectará el cambio y recalculará los porcentajes de avance automáticamente.
2. **Para Agregar Nuevas Funciones/Tareas:** Puedes escribir directamente una nueva línea bajo el módulo correspondiente usando el formato `- [ ] Tarea X.Y: Descripción de la nueva función. *(Prioridad: Alta/Media/Baja)*`. El motor de orquestación la registrará en la base de datos del backlog y la asignará a los agentes en la siguiente ejecución.
3. **Propuestas de los Agentes:** Si un agente de IA identifica un requerimiento faltante o una mejora en la seguridad/FHIR durante el análisis, te presentará una propuesta de tarea en la sección final de este documento para que la revises y apruebes.

---

## 📊 Estado de Avance General

| Módulo / Componente | Tareas Completadas | Tareas Totales | Progreso | Estado |
| :--- | :---: | :---: | :---: | :--- |
| **0. Orquestación y Diseño de Agentes** | 5 | 5 | `[██████████] 100%` | Completado |
| **1. Infraestructura y Seguridad (Zero Trust)** | 8 | 8 | `[██████████] 100%` | Completado |
| **2. Registro Demográfico (FHIR Patient)** | 3 | 5 | `[██████░░░░] 60%` | En Progreso |
| **3. Historia Clínica y Notas SOAP (FHIR Encounter)** | 4 | 10 | `[████░░░░░░] 40%` | En Progreso |
| **4. Receta Electrónica y Vademécum (CDS Hooks)** | 0 | 6 | `[░░░░░░░░░░] 0%` | Pendiente |
| **5. Agenda, Citas y Admisión Hospitalaria** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **6. Integración LIS (Laboratorio) y PACS (Imágenes)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **7. Portal del Paciente y Telemedicina (WebRTC)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **8. IA Clínica y Scribe Ambiental (WhisperX/Berta)** | 0 | 5 | `[░░░░░░░░░░] 0%` | Pendiente |
| **PROGRESO GLOBAL DEL PROYECTO** | **20** | **54** | `[████░░░░░░] 37%` | **En Progreso** |

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

---

### Módulo 2: Registro Demográfico (FHIR Patient)
*Control de admisión y datos básicos estructurados de los pacientes.*

- [x] **Tarea 2.1:** Creación de la API de creación/lectura compatible con el recurso `Patient` de HL7 FHIR R4. *(Prioridad: Alta)*
- [x] **Tarea 2.2:** Formulario de registro en React para datos demográficos (Nombre, DNI/Pasaporte, Género autopercibido, Cobertura médica). *(Prioridad: Alta)*
- [x] **Tarea 2.3:** Implementación del motor de búsqueda universal de pacientes con control de duplicados (Master Patient Index - MPI). *(Prioridad: Alta)*
- [ ] **Tarea 2.4:** Historial de trazabilidad y auditoría de cambios en datos demográficos del paciente. *(Prioridad: Media)*
- [ ] **Tarea 2.5:** Integración con padrón gubernamental de personas/coberturas (ej. SISA en Argentina). *(Prioridad: Media)*

---

### Módulo 3: Historia Clínica y Notas SOAP (FHIR Encounter)
*El núcleo asistencial de documentación para el profesional de la salud.*

- [ ] **Tarea 3.1:** Creación del recurso `Encounter` de FHIR para gestionar los episodios (ambulatorio, hospitalización, urgencias). *(Prioridad: Alta)*
- [ ] **Tarea 3.2:** Desarrollo de la interfaz de carga de la nota SOAP (Subjetivo, Objetivo, Apreciación, Plan) adaptativa y accesible. *(Prioridad: Alta)*
- [ ] **Tarea 3.3:** Motor de autocompletado e integración de diagnósticos codificados con CIE-10 / SNOMED CT. *(Prioridad: Alta)*
- [ ] **Tarea 3.4:** Firma digital avanzada de notas clínicas para profesionales con validación de credenciales. *(Prioridad: Alta)*
- [ ] **Tarea 3.5:** Diseño de gráficos evolutivos de constantes vitales del paciente (Tensión, FC, Temperatura) extraídos de `Observation` FHIR. *(Prioridad: Media)*
- [ ] **Tarea 3.6:** Mapeo de antecedentes heredofamiliares y personales del paciente (`Condition` FHIR). *(Prioridad: Media)*
- [x] **Tarea 3.7:** Desarrollo del módulo de Odontograma interactivo SVG (Adulto e Infantil) e historial de tratamiento clínico en español. *(Prioridad: Alta)*
- [x] **Tarea 3.8:** Ampliación del modelo de datos clínicos para registrar alergias (AllergyIntolerance), mediciones/signos vitales (Observation) y archivos adjuntos (DocumentReference/Media). *(Prioridad: Alta)*
- [x] **Tarea 3.9:** Implementación del controlador físico de archivos (Upload) con Multer — endpoint `POST /fhir/r4/Patient/:id/upload`, validación de tipos MIME (JPG/PNG/PDF/DOC) y límite de 20 MB. Persistencia como recursos FHIR `DocumentReference` o `Media`. *(Prioridad: Alta)*
- [x] **Tarea 3.10:** Implementación de la UI de Ficha Clínica con navegación por pestañas: 🦷 Odontograma · ⚠️ Alergias (FHIR AllergyIntolerance) · 💓 Signos Vitales (FHIR Observation / LOINC) · 📋 Documentos con drag & drop, galería y previsualización. *(Prioridad: Alta)*

---

### Módulo 4: Receta Electrónica y Vademécum (e-Prescribing)
*Prescripción y administración controlada de fármacos.*

- [ ] **Tarea 4.1:** Creación del endpoint compatible con el recurso `MedicationRequest` de FHIR. *(Prioridad: Alta)*
- [ ] **Tarea 4.2:** Integración de la base de datos de vademécum nacional/comercial (principios activos, dosis y presentaciones). *(Prioridad: Alta)*
- [ ] **Tarea 4.3:** Implementación del motor de reglas **CDS Hooks** para alertar sobre interacciones fármaco-fármaco y fármaco-alergias del paciente. *(Prioridad: Alta)*
- [ ] **Tarea 4.5:** Panel de firma digital y emisión de recetas en PDF con códigos QR de validación farmacéutica. *(Prioridad: Alta)*
- [ ] **Tarea 4.6:** Implementación del Kardex de enfermería y registro de administración de medicamentos (eMAR / MAR). *(Prioridad: Media)*
- [ ] **Tarea 4.7:** Conciliación de medicamentos en altas hospitalarias. *(Prioridad: Media)*

---

### Módulo 5: Agenda, Citas y Admisión Hospitalaria
*Control operativo de la ocupación, disponibilidad de profesionales y flujos de atención.*

- [ ] **Tarea 5.1:** Endpoint compatible con el recurso `Appointment` de FHIR para reserva y cancelación de turnos. *(Prioridad: Alta)*
- [ ] **Tarea 5.2:** Calendario visual interactivo para administración médica por profesional y consultorio. *(Prioridad: Alta)*
- [ ] **Tarea 5.3:** Automatización de recordatorios de citas vía SMS, Email o WhatsApp API. *(Prioridad: Media)*
- [ ] **Tarea 5.4:** Módulo de Triaje Manchester/ESI para priorización de urgencias en guardia. *(Prioridad: Alta)*
- [ ] **Tarea 5.5:** Módulo de Internación: Bed Management (gestión de camas, estados de limpieza y ocupación) e indicaciones de enfermería. *(Prioridad: Media)*

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

## 💡 Propuestas de Nuevas Funciones (Buzón de Entrada)
*Agrega aquí tus nuevas ideas o necesidades para que la IA las analice e incorpore al desglose anterior.*

- *Ejemplo: - [ ] Tarea 1.8: Integración con sistema de autenticación biométrica en recepción. (Pendiente de clasificación)*