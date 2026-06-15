# GEMINI.md — puntero a la fuente única de verdad

> Archivo **fino a propósito**. La gobernanza y el estado del proyecto NO viven acá: viven en el repo.

Antes de trabajar, hacé el **Bootstrap de sesión** definido en **[`AGENTS.md`](AGENTS.md)**:
1. **`AGENTS.md`** — reglas de gobernanza (idioma **español** obligatorio, UI **100% responsive**, flujo de orquestación, coordinación multi-agente).
2. **`tablero_control.md`** + **`docs/backlog.json`** — estado vivo, tareas y **Responsable** de cada una.
3. **`docs/adr/`** — decisiones vigentes (no re-litigar lo ya decidido).
4. **`docs/walkthroughs/`** + `git log` — bitácora e historial de implementación.

## Reglas clave para no divergir con los otros agentes
- La **fuente única de verdad es el repo** (AGENTS.md + tablero + ADRs), **no tu memoria privada**.
- **Un artefacto = un dueño canónico**; los duplicados se marcan **SUPERSEDIDO** apuntando al vigente.
- Declarar **Responsable** por tarea en el tablero; editar archivos compartidos **solo si están libres** (no pisar a otro agente).
- Toda propuesta "para llevar adelante" se **registra en el tablero**.
- Toda comunicación y documentación, **en español**.
