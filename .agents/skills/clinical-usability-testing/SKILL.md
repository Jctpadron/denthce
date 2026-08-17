---
name: clinical-usability-testing
description: "Ejecuta testing exploratorio funcional y de usabilidad para la HCE Systia.ar/Denta Cloud simulando usuarios reales de clinica: secretaria, medico, odontologo, administrador o laboratorio. Usar cuando se pida probar el sistema como usuario nuevo, cargar pacientes ficticios, historia clinica, odontograma, turnos, presupuestos, pagos, protesis, configuracion de clinica, responsividad, claridad visual, textos, validaciones, friccion de uso o preparacion comercial antes de venta/produccion."
---

# Clinical Usability Testing

## Objetivo

Evaluar el sistema como lo usaría una clínica real por primera vez, no sólo como una prueba técnica. El foco es detectar fricción, errores funcionales, textos confusos, validaciones insuficientes, fallas visuales/responsivas y problemas que podrían afectar la venta o adopción.

## Principios

- Actuar como usuario real: secretaria, profesional clínico, administrador o laboratorio según el flujo.
- Cargar datos ficticios realistas, completos e incompletos, para observar validaciones y recuperación de errores.
- No crear datos en producción sin autorización explícita. Si se prueba producción, confirmar antes si se permite cargar datos de testing.
- Registrar evidencia concreta: pantalla, módulo, acción, resultado esperado, resultado observado, gravedad y solución propuesta.
- Evaluar facilidad de uso, no sólo ausencia de errores.
- Usar subagentes cuando el usuario pida auditoría robusta: `qa`, `ux`, `product`, `security`, `fhir-mcp` y `devops` según corresponda.


## Convivencia Con Otras Skills

- No reemplazar `design-system`: usarla como fuente de verdad cuando se evalúen colores, tipografía, tokens, accesibilidad, white-label o responsividad.
- No reemplazar `fhir-validator`: invocarla cuando el testing produzca o revise payloads FHIR concretos.
- No reemplazar `code-generator`: esta skill no genera componentes ni backend; sólo detecta problemas y propone correcciones.
- No reemplazar `backlog-sync`: si los hallazgos se convierten en tareas formales, usar `backlog-sync` para registrar estado y seguimiento.
- No ejecutar limpieza, seed o datos en producción sin autorización explícita del Super Admin.
## Flujo Base

1. Confirmar entorno: local, staging o producción.
2. Confirmar usuario/rol a simular y credenciales disponibles.
3. Definir si se permite crear datos ficticios y si luego deben limpiarse.
4. Leer `references/test-scenarios.md` para elegir pacientes/casos.
5. Ejecutar el recorrido por módulos con `references/module-checklist.md`.
6. Registrar hallazgos con `references/report-template.md`.
7. Priorizar por impacto comercial y clínico:
   - `P0`: bloquea uso o riesgo clínico/seguridad.
   - `P1`: afecta venta, confianza o flujo principal.
   - `P2`: fricción importante pero con alternativa.
   - `P3`: mejora cosmética o refinamiento.
8. Presentar estado de situación antes de corregir.

## Módulos A Evaluar

- Alta, búsqueda y edición de paciente.
- Cobertura/obra social.
- Ficha clínica e historia clínica.
- Odontograma.
- Agenda y turnos.
- Presupuestos, pagos, gastos y cuenta corriente.
- Prótesis/laboratorio, si está habilitado.
- Configuración de clínica, marca, logo, color, datos profesionales y módulos contratados.
- Diseño general: títulos, fuentes, colores, contraste, espaciado, jerarquía visual, responsive mobile/tablet/desktop.

## Criterios De Usabilidad

Observar si el sistema responde claramente estas preguntas:

- ¿Dónde empiezo?
- ¿Qué dato falta?
- ¿Qué pasó después de guardar?
- ¿Cómo corrijo un error?
- ¿Puedo volver sin perder información?
- ¿La pantalla transmite producto profesional y vendible?
- ¿Los términos coinciden con el lenguaje clínico argentino/LATAM?
- ¿La interfaz funciona bien con muchos datos, texto largo y pantallas pequeñas?

## Evidencia Mínima

Para cada hallazgo incluir:

- Rol simulado.
- Módulo y pantalla.
- Datos usados.
- Pasos exactos.
- Resultado esperado.
- Resultado observado.
- Gravedad.
- Solución propuesta.
- Si requiere corrección antes de venta.

## Recursos

- Leer `references/test-scenarios.md` cuando haya que crear pacientes/casos ficticios.
- Leer `references/module-checklist.md` para recorrer todos los módulos de forma ordenada.
- Leer `references/report-template.md` antes de presentar el informe final o estado de situación.

