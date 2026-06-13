---
name: fhir-validator
description: Valida que los recursos JSON producidos o consumidos por la HCE cumplan los esquemas oficiales HL7 FHIR R4 (Patient, Encounter, Observation, Condition, MedicationRequest, AllergyIntolerance, DiagnosticReport, AuditEvent, Appointment...) y que los códigos usen los sistemas correctos (SNOMED CT, LOINC, CIE-10). Úsalo como parte del Quality Gate de qa y cuando fhir-mcp define o revisa un mapeo.
---

# Skill: Validador FHIR R4 (fhir-validator)

Verifica conformidad sintáctica y semántica de recursos contra HL7 FHIR R4. Cubre el hueco que los built-ins (`/security-review`, `/code-review`, `/verify`) no atienden.

## Cuándo usar
- Como sub-paso del Quality Gate de `qa` para cualquier endpoint que devuelva/acepte recursos FHIR.
- Cuando `fhir-mcp` define o revisa un mapeo de recurso.

## Qué validar
1. **Estructura:** `resourceType` correcto; campos requeridos presentes (p. ej. `Patient.identifier`, `Observation.status`+`code`, `MedicationRequest.intent`+`subject`).
2. **Cardinalidad y tipos:** respetar 0..1 / 1..1 / 0..* y tipos de datos FHIR.
3. **Terminología:** `system` correcto por código:
   - SNOMED CT → `http://snomed.info/sct`
   - LOINC → `http://loinc.org`
   - CIE-10 → el sistema configurado del proyecto
4. **Referencias:** `subject`/`patient` apuntan a recursos existentes (`Patient/<id>`).
5. **Multi-inquilino:** el recurso pertenece al tenant esperado (coordina con `security`).

## Método sugerido
1. Identificar el `resourceType` y cargar las reglas R4 de ese recurso.
2. Validar campo a campo y reportar errores (bloqueantes) y advertencias (semánticas).
3. Si hay un validador formal disponible en el entorno (p. ej. HAPI FHIR / `org.hl7.fhir.validator`), ejecutarlo; si no, validación estructural por reglas.

## Salida
```json
{
  "recurso": "Observation",
  "valido": true,
  "errores": [],
  "advertencias": ["code.coding[0].display recomendado pero ausente"]
}
```

## Criterio de aprobación
- Cero errores bloqueantes. Las advertencias semánticas se reportan al Orquestador.

## Idioma
Reportes en **español**.
