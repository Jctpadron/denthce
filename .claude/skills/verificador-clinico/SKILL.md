---
name: verificador-clinico
description: >
  Verifica la exactitud de datos clínicos y regulatorios de la HCE antes de cargarlos/persistirlos:
  rangos de signos vitales (por edad/sexo, con su código LOINC), dosis y presentaciones del vademécum,
  reglas CDS Hooks (interacciones fármaco-fármaco y fármaco-alergia), códigos clínicos (CIE-10 / SNOMED CT /
  LOINC), nomenclador y simbología odontológica PAMI, y datos de cobertura/obra social. Úsala como paso previo
  a persistir tablas de referencia, catálogos o seeds, y como apoyo del Quality Gate de qa/product.
---

# Skill: verificador-clinico — HCE

Detecta errores, valores no verificables o desactualizados en datos clínicos y regulatorios **antes** de usarlos o persistirlos. Un dato clínico mal cargado es riesgo asistencial: se verifica, no se asume.

## Qué verifica
- **Rangos de signos vitales** (FHIR Observation): coherencia por edad/sexo (TA, FC, FR, temperatura, SatO₂…); que el código **LOINC** y las **unidades** sean correctos y no se solapen ni contradigan.
- **Vademécum / medicamentos**: principio activo, dosis, presentación y unidades correctas (mg vs g, mg/mL); coherencia de la `MedicationRequest`.
- **Reglas CDS Hooks**: interacciones fármaco-fármaco y fármaco-alergia bien definidas (que no falten ni disparen falsos positivos evidentes).
- **Códigos clínicos**: que los **CIE-10 / SNOMED CT / LOINC** existan, estén vigentes y usen el `system` correcto.
- **Odontología PAMI**: nomenclador de prestaciones, simbología del odontograma (13 estados) y datos de cobertura/afiliado.
- **Coberturas / obras sociales**: códigos y convenios vigentes.

## Clasificación
✅ Correcto · 🟡 Necesita matiz · ⚠️ No verificable · 🔶 Desactualizado · ❌ Incorrecto

## Reglas
- No marcar como falso lo que solo no se puede comprobar (→ **no verificable**).
- Para datos cambiantes (vademécum, nomenclador PAMI, convenios de obra social, catálogos CIE/SNOMED), señalar que requieren **confirmación de fuente vigente**.
- Si hay acceso web, verificar los valores regulatorios/terminológicos actuales.
- Multi-inquilino: recordar que los rangos/valores pueden variar por tenant (no imponer un valor global si el dato es por-inquilino).

## Criterio de aprobación
- Sin errores ❌ ni valores desactualizados 🔶 sin marcar antes de persistir en la base.
