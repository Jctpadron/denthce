# Especificación de Servidores y Herramientas MCP HCE

Esta especificación detalla las interfaces de las herramientas expuestas por los servidores del **Model Context Protocol (MCP)** para que los agentes de IA interactúen de forma segura con la infraestructura de la Historia Clínica Electrónica.

---

## 1. Servidor MCP-FHIR (Recursos Clínicos)
*Abstracción segura sobre la API y base de datos FHIR R4 de la HCE.*

### Herramientas:
1. `validate_fhir_resource`: Valida un payload JSON contra la especificación HL7 FHIR del recurso correspondiente.
   * *Parámetros:* `{"resource_type": "string", "payload": "object"}`
2. `get_patient_records`: Consulta la historia clínica de un paciente filtrando por tipo de recurso.
   * *Parámetros:* `{"patient_id": "string", "resource_type": "Encounter" | "Observation" | "Condition" | "MedicationRequest"}`
3. `write_fhir_resource`: Registra o actualiza un recurso clínico en el servidor FHIR (requiere auditoría y token SMART).
   * *Parámetros:* `{"resource_type": "string", "payload": "object", "smart_token": "string"}`

---

## 2. Servidor MCP-Docs (Documentación Asistencial)
*Gestión de notas clínicas estructuradas y consentimientos.*

### Herramientas:
1. `parse_ambient_audio`: Envía el stream de audio capturado por la consulta al motor de IA WhisperX para transcripción.
   * *Parámetros:* `{"audio_file_path": "string"}`
2. `generate_soap_draft`: Procesa la transcripción de texto libre y genera un borrador estructurado de nota SOAP.
   * *Parámetros:* `{"transcription_text": "string", "specialty": "string"}`
3. `sign_clinical_document`: Aplica la firma digital criptográfica de un profesional médico sobre un reporte o nota.
   * *Parámetros:* `{"document_id": "string", "practitioner_id": "string", "signature_token": "string"}`

---

## 3. Servidor MCP-Security (Gobernanza y Cumplimiento)
*Validación de políticas de acceso, Keycloak y auditorías HIPAA.*

### Herramientas:
1. `audit_endpoint_access`: Registra de forma inmutable un acceso a ePHI y genera un `AuditEvent` de FHIR.
   * *Parámetros:* `{"user_id": "string", "action": "read" | "write", "resource_path": "string", "status": "success" | "denied"}`
2. `verify_oidc_token`: Valida la firma y vigencia de un token de acceso JWT emitido por Keycloak.
   * *Parámetros:* `{"access_token": "string"}`
3. `scan_security_vulnerabilities`: Analiza estáticamente configuraciones de red, puertos expuestos y políticas mTLS en el cluster Kubernetes.
   * *Parámetros:* `{"component": "gateway" | "database" | "identity"}`

---

## 4. Servidor MCP-Integrations (Conectividad Externa)
*Gestión de conectores y adaptadores con sistemas legados.*

### Herramientas:
1. `send_hl7_message`: Envía un mensaje formateado HL7 v2.x (ej: ORM_O01) a un sistema LIS o recibe analíticas (ORU_R01).
   * *Parámetros:* `{"connection_id": "string", "hl7_payload": "string"}`
2. `query_pacs_dicom`: Realiza una consulta C-FIND a un servidor PACS para localizar imágenes médicas del paciente.
   * *Parámetros:* `{"patient_id": "string", "study_date_range": "string"}`
3. `verify_insurance_eligibility`: Consulta el estado de cobertura del paciente en tiempo real con la aseguradora asociada.
   * *Parámetros:* `{"patient_id": "string", "insurance_id": "string", "plan_code": "string"}`

---

## 5. Servidor MCP-Planning (Roadmap y Tareas)
*Gestión interna de backlog y estados de orquestación.*

### Herramientas:
1. `get_backlog_status`: Consulta el listado de tareas pendientes y su progreso ponderado.
   * *Parámetros:* `{}`
2. `update_task_state`: Modifica el estado de una tarea y añade firmas al historial de auditoría de agentes.
   * *Parámetros:* `{"task_id": "string", "new_state": "pendiente" | "en_progreso" | "esperando_aprobacion" | "completado", "agent_signature": "string", "log_message": "string"}`
3. `add_custom_task`: Inserta una nueva tarea clínica al backlog especificando dependencias.
   * *Parámetros:* `{"modulo_id": "number", "descripcion": "string", "prioridad": "alta" | "media" | "baja", "agentes_asignados": "array"}`
