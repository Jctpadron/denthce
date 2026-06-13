# Análisis de Producto y Vendibilidad — HC Odontológica para Odontólogos de Jujuy (DentHCE)

> **Agente responsable:** `product` (Producto Clínico)
> **Fecha:** 2026-05-28
> **Estado:** Borrador para decisión del dueño de producto / Super Admin
> **Insumos:** `docs/specs/hc-odontologica-pami.md` (spec funcional, 7 épicas), variantes de diseño UX (A skeuomórfica / B pestañas / C wizard), `docs/backlog.json` (Módulo 3).
> **Objetivo:** decidir el enfoque de HC odontológica "más funcional y más VENDIBLE" para odontólogos de Jujuy que hoy trabajan con planillas de papel (modelo PAMI de 3 hojas + Ficha Catastral del Círculo Odontológico de Jujuy).
> **Idioma de trabajo:** español (regla obligatoria del proyecto).

---

## 1. Perfil del usuario: el odontólogo de Jujuy con planilla de papel

### 1.1 Quién es y cómo trabaja hoy

- Profesional independiente o consultorio pequeño (1 a 3 odontólogos + recepción), no una clínica grande con departamento de IT.
- Atiende un porcentaje alto de **afiliados PAMI/INSSJP** y obras sociales provinciales; cobra por prestación presentada.
- Su "sistema" actual es **papel**: el formulario PAMI de 3 hojas y la Ficha Catastral del Círculo Odontológico de Jujuy (odontograma rojo/azul). Lo que el software reemplaza es físico, conocido y validado por décadas de uso.
- Es **conservador frente a la tecnología clínica**: ya intentó (o vio a colegas intentar) software genérico que "no servía para PAMI" y volvió al papel. La barrera no es el precio, es la **confianza y la fricción**.
- Trabaja **en el sillón**, muchas veces con guante, mirando la boca del paciente, no sentado frente a un escritorio con teclado cómodo.

### 1.2 Dolores reales del papel (lo que paga por resolver)

| # | Dolor con el papel | Consecuencia económica/clínica |
| :- | :--- | :--- |
| D1 | **Extravío** de la planilla o de hojas sueltas (la HC vive en una carpeta física). | No puede presentar a la obra social; pierde el cobro; problema legal si hay reclamo. |
| D2 | **Ilegibilidad** (letra apurada, manchas, tachones). | Rechazo de PAMI por planilla "no interpretable"; reproceso. |
| D3 | **Planilla incompleta** (falta firma, falta consentimiento, falta Nº afiliado, falta sello/matrícula). | **Rechazo de la prestación = no cobra.** Es el dolor #1 de bolsillo. |
| D4 | **Tiempo de carga manual** repetido (los datos del afiliado y del profesional se reescriben en cada hoja). | Menos pacientes por día; tareas administrativas fuera de horario. |
| D5 | **Copias y archivo físico** (sacar fotocopias para presentar y para archivar). | Costo, espacio, deterioro, búsqueda lenta de historiales viejos. |
| D6 | **Sin trazabilidad ante auditoría** retroactiva de la obra social. | No puede probar qué se hizo y cuándo; riesgo de débito. |
| D7 | **Odontograma a mano** propenso a error y difícil de actualizar sesión a sesión. | Confusión existente vs. a realizar; replanificación poco clara. |

### 1.3 Qué necesita para adoptar lo digital SIN fricción

1. **Que se parezca a lo que ya conoce** (el odontograma rojo/azul, las 3 hojas PAMI). Lo familiar reduce el miedo.
2. **Que NO le haga perder tiempo** respecto al papel: el primer día debe sentir que tarda igual o menos.
3. **Que el resultado sea cobrable**: que el PDF salga completo y aceptado por PAMI sin idas y vueltas.
4. **Que funcione en el celular/tablet en el sillón**, no solo en una PC.
5. **Que no le exija conocimientos técnicos** (instalar, configurar, entender FHIR — nada de eso debe verlo).
6. **Que sus datos no se pierdan** y queden respaldados (confianza > funciones).

> **Insight de producto:** este usuario no compra "una HCE FHIR multi-inquilino". Compra **dejar de perder plata por planillas rechazadas y dejar de perder tiempo escribiendo lo mismo tres veces**. Toda la comunicación comercial y el MVP deben orbitar alrededor de eso.

---

## 2. Evaluación de las tres variantes de diseño (óptica de negocio/adopción)

> Las variantes A/B/C las define `ux`. Aquí se evalúa cada una por su impacto en **venta y adopción**, no por su estética.

### Variante A — Fiel a la planilla (skeuomórfica)

La pantalla replica visualmente las 3 hojas PAMI y la ficha catastral.

| Criterio | Evaluación |
| :--- | :--- |
| **Velocidad de adopción** | **Muy alta.** Cero curva de aprendizaje: "es la misma planilla, pero en la compu". El demo se vende solo. |
| **Riesgo de abandono** | **Bajo al inicio.** Riesgo medio a mediano plazo: si solo replica el papel, no demuestra valor superior y puede sentirse "más lento que escribir a mano" en campos largos. |
| **Percepción "profesional"** | Media. Profesional para PAMI/auditoría, pero puede verse "anticuado" frente a competidores modernos. |
| **Argumento de venta principal** | *"Es tu misma planilla PAMI, ahora imposible de perder, siempre legible y lista para presentar."* |

### Variante B — Clínica moderna por pestañas (integrada)

Ficha del paciente con pestañas (Anamnesis, Odontograma, Plan, Consentimiento, Evolución, Documentos). Es coherente con la UI ya existente del repo (`PatientSearch.tsx` con pestañas).

| Criterio | Evaluación |
| :--- | :--- |
| **Velocidad de adopción** | Media. Requiere entender la navegación; el odontólogo debe saber "dónde está cada cosa". |
| **Riesgo de abandono** | **Bajo a largo plazo.** Es el modelo que escala: soporta más pacientes, historiales largos, multi-sesión. Reutiliza patrón ya construido. |
| **Percepción "profesional"** | **Alta.** Se ve como software clínico serio y moderno; bueno para diferenciarse y para clínicas que crecen. |
| **Argumento de venta principal** | *"Toda la historia del paciente en un solo lugar, ordenada y siempre accesible; crece con tu consultorio."* |

### Variante C — Wizard guiado por flujo de consulta

Paso a paso que conduce la consulta (datos → anamnesis → odontograma → plan → consentimiento → cerrar).

| Criterio | Evaluación |
| :--- | :--- |
| **Velocidad de adopción** | **Alta para el primer paciente** (te lleva de la mano, imposible saltarte un campo obligatorio). |
| **Riesgo de abandono** | **Medio-alto en uso repetido.** El profesional experto se frustra con un wizard rígido cuando solo quiere tocar una pieza del odontograma; demasiados clics para tareas rápidas. |
| **Percepción "profesional"** | Media-alta para onboarding; puede sentirse "para principiantes" en el día a día. |
| **Argumento de venta principal** | *"Nunca más una planilla rechazada: el sistema no te deja cerrar sin lo que PAMI exige."* (mata directamente el dolor D3). |

### Síntesis comparativa

- **A** gana en *vender el demo y entrar* (familiaridad).
- **B** gana en *retener y escalar* (uso diario y crecimiento).
- **C** gana en *garantizar completitud* (cero rechazos), que es el dolor económico central.

Ninguna pura es óptima: A sola envejece, B sola asusta al inicio, C sola cansa al experto.

---

## 3. Diferenciadores VENDIBLES para el nicho Jujuy

Ordenados por fuerza comercial (capacidad de cerrar una venta):

1. **"HC PAMI lista para presentar en 1 clic, sin rechazos."** Exportación del PDF oficial de 3 hojas (ÉPICA G) con **validación previa** que bloquea/avisa de lo que falta (afiliado, anamnesis firmada, consentimiento, matrícula/sello). Ataca D3 y D2, el dinero perdido. **Este es el diferenciador #1.**

2. **Odontograma rojo/azul idéntico al de la Ficha Catastral de Jujuy** (ÉPICA B): rojo = existente, azul = a realizar, con la simbología que ya usan. "Es tu odontograma de siempre, pero que se actualiza solo cuando marcás un tratamiento como hecho." Familiaridad + utilidad clínica real. **Diferenciador #2.**

3. **Anamnesis y consentimiento firmados con validez legal y auditoría inmutable** (ÉPICAS A, D + AuditEvent): firma del paciente atada a la versión exacta del texto, inmutable, defendible ante auditoría retroactiva de la obra social o reclamo. "Si PAMI te audita dentro de dos años, tenés todo firmado y con fecha." **Diferenciador #3.**

Diferenciadores de soporte (refuerzan, no cierran solos):

4. **Funciona en el celular/tablet en el sillón** (responsive obligatorio del proyecto, HU-B4). Cargar mirando la boca, no volviendo al escritorio.
5. **Carga una vez, se reusa en todas las hojas**: datos del afiliado y del profesional precargados (HU-F1) — mata D4.
6. **Nunca más perdés una historia** (respaldo en la nube, búsqueda instantánea) — mata D1 y D5.

---

## 4. MVP vendible — el "momento ajá"

El MVP debe producir el **momento ajá** en una demo de 10 minutos: *"con esto cobro sin que me rechacen y tardo menos que con el papel."*

### 4.1 Subconjunto mínimo que cierra una venta

Alineado con la **Fase 1 + parte de Fase 3** de la spec funcional (núcleo legal + salida oficial), priorizando lo cobrable sobre lo gráficamente complejo:

| Incluir en MVP | De qué épica | Por qué es imprescindible para vender |
| :--- | :--- | :--- |
| Datos de afiliado/profesional precargados | F (HU-F1) | Sin esto el PDF PAMI no es válido; mata D4. |
| Anamnesis estructurada PAMI + firma del paciente | A (HU-A1, A3, A4) | Hoja 1 válida; valor legal; mata D3 parcial. |
| Estado bucal + diagnóstico + plan | C (HU-C1, C2) | Completa el contenido clínico mínimo de la HC. |
| Consentimiento informado firmado (con matrícula/sello) | D (HU-D1) | Requisito de aceptación PAMI; mata D3 (rechazo por falta de consentimiento). |
| **Exportación PDF oficial PAMI con validación de completitud** | G (HU-G1) | **Es el momento ajá.** El profesional ve la planilla salir completa y "presentable". |
| Odontograma **básico** rojo/azul (existente/a realizar) | B (HU-B1, versión reducida) | La imagen reconocible que genera confianza en el demo; aunque sea con simbología limitada. |

### 4.2 Qué queda FUERA del MVP (Fase 2 completa y Fase 3 avanzada)

- Simbología odontológica ampliada completa (HU-B3) y transición fina azul→rojo con doble fecha (HU-B2): aportan profundidad clínica pero NO cierran la primera venta. Van en la siguiente iteración.
- Anexo de evolución multi-página con conformidad firmada por sesión (ÉPICA E): valioso para retención, no para la venta inicial.
- Codificación CIE-10/SNOMED obligatoria en diagnóstico: en MVP, texto libre; codificación como mejora.

### 4.3 El "momento ajá" en una frase

> El odontólogo carga un paciente PAMI, marca cuatro piezas en rojo/azul, completa la anamnesis, el paciente firma en la tablet, y **en un clic sale el PDF de 3 hojas oficial, completo, listo para presentar**. Ahí decide comprar.

---

## 5. Recomendación de enfoque

### 5.1 Recomendación: **híbrido B (base) + A (presentación) + C (red de seguridad)**

Desde negocio/adopción, **ninguna variante pura** es la respuesta. Recomiendo un **híbrido con estructura de pestañas (B) como esqueleto**, porque es lo que escala y reutiliza el patrón ya construido en el repo, **con dos refuerzos**:

- **Capa de familiaridad (A):** el odontograma se renderiza fiel a la Ficha Catastral de Jujuy (rojo/azul, simbología conocida) y el **PDF de salida es pixel-fiel a las 3 hojas PAMI**. La fidelidad al papel se concentra donde más confianza genera: el odontograma que ve en pantalla y la planilla que entrega. No hace falta que toda la app sea skeuomórfica.

- **Red de seguridad tipo wizard (C) solo donde paga:** no un wizard global rígido, sino un **asistente de completitud previo a exportar** (el "checklist PAMI"): antes de generar el PDF, el sistema guía paso a paso lo que falta para que la planilla no sea rechazada (HU-G1 ya lo especifica como validación bloqueante/blanda). Así se obtiene el beneficio de C (cero rechazos) sin su fricción en el uso diario.

### 5.2 Por qué este híbrido para Jujuy

- **Adopción rápida** (de A): el demo muestra el odontograma de siempre y la planilla de siempre.
- **Retención y escalabilidad** (de B): el día a día con muchos pacientes es manejable y reutiliza la UI existente.
- **Cero rechazos / cobro asegurado** (de C, acotado): el asistente de completitud ataca el dolor económico D3 sin cansar al experto.
- **Coherencia con el proyecto:** B reaprovecha `PatientSearch.tsx` con pestañas y `Odontogram.tsx`, reduciendo riesgo y tiempo de entrega.

### 5.3 Relación con la recomendación de UX

Esta recomendación de producto es **complementaria** a UX, no impositiva: si `ux` concluye que B es la base correcta, coincidimos. Si UX prefiere arrancar con A por accesibilidad/familiaridad en el sillón, es compatible: A puede ser el **modo de entrada** dentro del esqueleto B. El punto **no negociable de producto** es: (1) odontograma rojo/azul fiel, (2) PDF PAMI fiel y validado, (3) asistente de completitud antes de exportar. El "cómo" visual lo cierra UX.

---

## 6. Riesgos de adopción y mitigación

| # | Riesgo de adopción | Impacto | Mitigación de producto |
| :- | :--- | :--- | :--- |
| AR1 | "Es más lento que escribir a mano." | Abandono temprano. | Precarga de afiliado/profesional (HU-F1), plantillas de anamnesis, valores por defecto, odontograma táctil. Medir tiempo real vs. papel en piloto. |
| AR2 | "El PDF que sale no me lo acepta PAMI." | Pérdida total de confianza; el peor escenario. | Validar el PDF con **odontólogos reales de Jujuy** contra rechazos previos antes de lanzar; decidir fidelidad pixel-a-pixel (punto de decisión #3 de la spec). |
| AR3 | "No sé usar la compu / me da miedo romper algo." | No compra o no usa. | Variante A como modo de entrada; onboarding asistido; el asistente de completitud (C) como guía. Soporte humano en español, cercano. |
| AR4 | "¿Y si se cae internet en el consultorio?" | Bloqueo de la consulta. | Definir comportamiento offline/borrador local; al menos no perder datos cargados. (Decisión técnica para `architect`.) |
| AR5 | "¿Mis datos están seguros / pueden verlos otros?" | Desconfianza, freno legal. | Mensaje claro de respaldo + aislamiento multi-inquilino (Zero Trust ya activo, R8 de la spec); certificación de `security`. |
| AR6 | Resistencia gremial / "el Círculo no lo reconoce." | Barrera de mercado. | Buscar aval/piloto con el Círculo Odontológico de Jujuy; usar su ficha catastral como base es un argumento de legitimidad. |
| AR7 | Firma del paciente: el paciente mayor PAMI no maneja la tablet. | Fricción en el sillón. | Firma en canvas simple con dedo, opción de firma del tutor/familiar (HU-A4 ya lo contempla); fallback de impresión para firma manual y re-escaneo. |

---

## 7. Métricas de éxito de la venta/adopción (para validar el MVP en piloto)

- **Tasa de rechazo PAMI** de planillas generadas con DentHCE vs. papel (objetivo: cercano a 0).
- **Tiempo de carga** de una HC completa digital vs. papel (objetivo: igual o menor desde la 3.ª consulta).
- **Tasa de conversión demo → compra** y **tasa de uso a los 30 días** (anti-abandono).
- **Nº de HC exportadas en modo "definitiva"** (todo firmado) vs. "borrador" — mide completitud real.

---

## 8. RESUMEN EJECUTIVO

### MVP vendible
Núcleo legal + salida oficial que produce el **momento ajá** en una demo: datos de afiliado/profesional precargados (F) + anamnesis estructurada PAMI firmada (A) + estado bucal/diagnóstico/plan (C) + consentimiento firmado con matrícula/sello (D) + **odontograma básico rojo/azul** (B reducida) + **exportación del PDF oficial PAMI de 3 hojas con validación de completitud** (G). Lo que cierra la venta: el odontólogo ve **salir la planilla completa y presentable en un clic**.

### Los 3 diferenciadores más fuertes
1. **HC PAMI lista para presentar en 1 clic, sin rechazos** (PDF oficial 3 hojas + asistente de completitud que bloquea/avisa lo faltante). Ataca el dolor económico #1: la planilla rechazada = no cobro.
2. **Odontograma rojo/azul idéntico al de la Ficha Catastral de Jujuy**, que se actualiza solo al marcar un tratamiento como hecho (familiaridad + utilidad).
3. **Anamnesis y consentimiento firmados, inmutables y auditables**: defendibles ante auditoría retroactiva de PAMI o reclamo legal.

### Recomendación de enfoque (justificada para Jujuy)
**Híbrido: esqueleto de pestañas (B) + fidelidad concentrada al papel (A) en el odontograma y en el PDF + red de seguridad tipo wizard (C) acotada al asistente de completitud previo a exportar.**

Justificación: el odontólogo de Jujuy adopta por **familiaridad** (A vende el demo), se queda por **escalabilidad y orden** (B sostiene el uso diario y reaprovecha lo ya construido en el repo) y compra porque **deja de perder plata por rechazos** (C, acotado al checklist PAMI, sin cansar al experto). Ninguna variante pura logra las tres cosas; el híbrido sí, y es compatible con lo que recomiende `ux`. Los tres puntos no negociables de producto son: odontograma rojo/azul fiel, PDF PAMI fiel y validado, y asistente de completitud antes de exportar.

---

> **Trazabilidad:** este análisis complementa `docs/specs/hc-odontologica-pami.md` (no lo reemplaza) y orienta la priorización de las entradas REQ-003-ENC-3.13 a 3.19 sugeridas en la sección 6 de aquella spec. Pendiente de certificación funcional del Quality Gate de `product` tras validación con odontólogos reales de Jujuy (AR2, AR6).
