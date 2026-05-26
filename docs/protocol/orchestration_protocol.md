# Protocolo de Orquestación y Comunicación HCE

Este protocolo define las reglas de mensajería y la estructura de interacción entre los agentes de IA conceptuales, el script orquestador y el Super Administrador humano.

---

## 1. Flujo de Aprobación Humana (Human-in-the-Loop - HITL)

Cualquier cambio de diseño de arquitectura, política de seguridad o inyección de código requiere la aprobación del Super Administrador. El flujo sigue el siguiente protocolo:

1. **Pausa Operativa:** El script orquestador detecta una tarea que requiere aprobación, cambia su estado en `docs/backlog.json` a `"esperando_aprobacion"` y emite un evento por SSE.
2. **Notificación en Dashboard:** El Dashboard web resalta la tarjeta de la tarea en color ámbar y renderiza los botones interactivos:
   * **`✅ Aprobar Desarrollo`**
   * **`❌ Rechazar con comentarios`**
3. **Respuesta del Admin:**
   * Si aprueba: La página envía `POST /api/approve` con `"approved": true`, el script cambia el estado a `"completado"` y continúa el flujo.
   * Si rechaza: Se envía `"approved": false` junto con los comentarios. El Orquestador reasigna la tarea al agente correspondiente con el feedback para corregir.

---

## 2. Plantilla para Preguntas al Super Admin (RFI - Request for Information)

Cuando un agente de IA requiere más contexto (por ejemplo, Producto Clínico necesita saber el vademécum nacional de referencia), la pregunta se insertará en el buzón de entrada de `tablero_control.md` y en la consola web con el siguiente formato estructurado:

```md
### ❓ [RFI] Pregunta de [Agente] - Tarea [ID_Tarea]
* **Pregunta:** [Descripción clara de la duda o dato faltante]
* **Impacto en el Desarrollo:** [Qué pasará si no se responde]
* **Opciones Propuestas:**
  1. [Opción A]
  2. [Opción B]
* **Responder aquí:** (Escribe tu opción o comentarios debajo de esta línea para que el script los procese)
```

---

## 3. Plantilla para Propuestas de Mejora (RFC - Request for Comments)

Si los agentes de IA identifican una mejora potencial sobre el análisis funcional (por ejemplo, el agente de Seguridad recomienda autenticación biométrica en la admisión), se registrará en la sección de propuestas del Dashboard y del Markdown:

```md
### 💡 [RFC] Propuesta de Mejora de [Agente] - Módulo [ID_Modulo]
* **Descripción de la Mejora:** [Detalle técnico y asistencial]
* **Justificación Clínica:** [Cómo beneficia al médico, enfermero o paciente]
* **Riesgo/Esfuerzo:** [Esfuerzo estimado y dependencias]
* **Checkbox de Aprobación:**
  - [ ] APROBAR E INCORPORAR AL BACKLOG (El script moverá esta propuesta a la lista de tareas activas al marcar este check)
```
