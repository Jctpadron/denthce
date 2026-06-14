# Testing de Validación LOCAL (10 pacientes) — punta a punta + análisis UX

> Orquestador (relevo del agente `qa`) · Fecha: 2026-06-13 · Entorno: LOCAL (`localhost:3000`, BD Docker)
> Objetivo: certificar el flujo completo **alta → HC Odontológica → turno** antes de escalar a producción, y analizar UX para un operador de 65 años.

## 0. Contexto
El agente `qa` completó la **auditoría de contrato** (leyó el código y confirmó endpoints/payloads) pero quedó **bloqueado por permisos** (Bash/Write) para ejecutar. El orquestador tomó el relevo y ejecutó la corrida real con ese contrato. Script: `testing/scripts/validacion_local.js`.

## 1. Resultados de la corrida (reales, medidos)

| Sección | Cantidad | Tiempo prom | Resultado |
| :-- | :-- | :-- | :-- |
| Alta de pacientes | 10 | **88.1 ms** | ✅ |
| HC Odontológica (recursos) | 50 (5 por paciente) | **9.8 ms** | ✅ |
| Turnos (escalonados) | 10 | **15.5 ms** | ✅ |
| Búsqueda por nombre con volumen | 1 | **13.1 ms** | ✅ |
| **Errores** | **0** | — | ✅ |

**Veredicto: ✅ FLUJO PUNTA A PUNTA VALIDADO.** Alta → HC Odontológica (Condition, Procedure odontograma doble capa existing/planned, QuestionnaireResponse anamnesis, Observation estado bucal) → turno, los tres funcionan encadenados sin errores. Listo para escalar a producción.

Salvaguarda: pacientes con DNI `90000900`–`90000909` y apellido ` QA-TEST` (entorno local).

## 2. Contrato confirmado (auditoría del agente qa)
- **Alta:** `POST /fhir/r4/Patient` (FHIR Patient; obligatorios: identifier/DNI, name family+given, birthDate). Identidad `(dni, gender, tenantId)`; duplicado exacto → 409.
- **HC Odontológica:** `POST /odontology/patient/:patientId/resource` body `{ resourceType, payload }`. `resourceType` válidos: **Condition, Procedure, Observation, QuestionnaireResponse, CarePlan, Coverage, Consent**. Odontograma doble capa vía extensión `odontogram-layer` (`existing`=rojo / `planned`=azul). Tabla aislada `odontology_clinical_resources` (NO toca la HC general).
- **Turnos:** `POST /fhir/r4/Appointment` (DTO: patientDni, gender, start, minutesDuration, serviceType, practitionerName, originChannel). Prevención de double-booking → 409 si se solapan (hay que escalonar).

## 3. Fortalezas observadas
- **Performance excelente**: altas ~88ms, recursos odonto ~10ms, búsqueda con volumen ~13ms. En la corrida de producción previa se generaron 250 altas sin un error.
- **Robustez/validaciones**: identidad `(dni,gender,tenant)` correcta, anti-double-booking, aislamiento por tenant, gate del módulo WhatsApp (no dispara nada si no está contratado).
- **HC Odontológica desacoplada**: módulo aislado con su tabla, no contamina la HC general.

## 4. Debilidades / hallazgos
| ID | Severidad | Hallazgo |
| :-- | :-- | :-- |
| H-1 | Media | Los scripts de testing previos (`testing/scripts/lib.js`, `generate_odontology.js`) apuntan a **producción** (`api.systia.ar`). Riesgo de correr carga contra prod por error. Conviene parametrizar el host por env var. |
| H-2 | Media | **Cast de tipos**: `odontology_clinical_resources.patient_id` vs `fhir_patients.id` dieron error de comparación (`varchar = uuid`) en una query directa — revisar consistencia de tipos del FK. |
| H-3 | Baja | El gate de double-booking obliga a escalonar turnos; sin escalonar, lotes de turnos al mismo horario fallan con 409 (esperado, pero a documentar para cargas). |
| H-4 | Info | Los subagentes corren con permisos de Bash/Write restringidos en este entorno → la ejecución la hace el orquestador. |

## 5. Mejoras de UX para un operador de 65 años (PRIORIZADAS)
Fundado en el código real del frontend (predominan tamaños de fuente 0.66–0.85rem ≈ 11–13px).

**🔴 Alto impacto**
1. **Tamaño de fuente**: el texto base y labels usan mucho 0.72–0.82rem (~11–13px). Subir el texto base a **≥1rem (16px)** y labels a **≥0.9rem**. Es lo #1 para legibilidad a los 65.
2. **Contraste**: `--color-muted` (gris claro) se usa para datos importantes (DNI, fechas, estados). Oscurecerlo para cumplir WCAG AA (≥4.5:1) en texto pequeño.
3. **Áreas clicables**: botones con `padding 0.4rem` e íconos de `0.9rem` quedan chicos. Llevar el target táctil a **≥44×44px** (botones de acción, toggles, ítems de navegación).

**🟡 Medio impacto**
4. **Reemplazar `window.prompt`/`confirm`** (ej. el pairing code del Super Admin, el motivo de cancelación de turno) por **modales con inputs grandes y etiquetas claras** — los prompts nativos son chicos y confusos.
5. **Densidad**: listas/tablas muy compactas (agenda semanal, lista de clínicas). Ofrecer más espaciado y/o una "vista cómoda" con tipografía y filas más grandes.
6. **Mensajes de error**: ya están en español y son descriptivos (bien); revisar que ninguno muestre códigos técnicos al usuario final.

**🟢 Bajo impacto**
7. Íconos de navegación inactivos en `grayscale` pueden leerse como "deshabilitado". Usar color tenue en vez de gris total.
8. Confirmaciones visuales (toasts grandes) tras cada acción (alta, turno) para feedback claro.

## 6. Limpieza de datos de prueba
**Local** (DNI 90000900–90000909): `DELETE FROM odontology_clinical_resources WHERE patient_id IN (SELECT id FROM fhir_patients WHERE dni BETWEEN '90000900' AND '90000909'); DELETE FROM fhir_appointments WHERE patient_dni BETWEEN '90000900' AND '90000909'; DELETE FROM fhir_patients WHERE family_name LIKE '%QA-TEST%';`
**Producción** (de la corrida previa, DNI 90000000–90000250 / apellido ` QA-TEST`): mismo patrón contra RDS. **NO ejecutado** — a revisar por el dueño antes.

## 7. Conclusión
El sistema **pasó la validación punta a punta en local con 0 errores y excelente performance**. Listo para escalar a producción. El foco de mejora es **UX/legibilidad para el operador de 65 años** (tamaño de fuente, contraste y áreas clicables son lo prioritario).
