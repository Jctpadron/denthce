import http.server
import socketserver
import json
import os
import re
import threading
import time
import sys
from urllib.parse import urlparse, parse_qs

# Forzar codificación UTF-8 en la consola para soportar emojis en Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')


# Configuración de Rutas
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKLOG_PATH = os.path.join(BASE_DIR, "docs", "backlog.json")
TABLERO_PATH = os.path.join(BASE_DIR, "tablero_control.md")
PORT = 8000

# Clientes conectados a Server-Sent Events (SSE)
sse_clients = []
sse_lock = threading.Lock()
orchestration_active = False

def log_event(message, agent="orchestrator", task_id=None):
    """Envía un mensaje de log en tiempo real a todos los clientes SSE y lo imprime en consola."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    event_data = {
        "timestamp": timestamp,
        "agent": agent,
        "message": message,
        "task_id": task_id
    }
    
    print(f"[{timestamp}] [{agent.upper()}] {message}")
    
    with sse_lock:
        closed_clients = []
        for client in sse_clients:
            try:
                client.wfile.write(f"data: {json.dumps(event_data)}\n\n".encode("utf-8"))
                client.wfile.flush()
            except Exception:
                closed_clients.append(client)
        
        # Eliminar clientes desconectados
        for client in closed_clients:
            if client in sse_clients:
                sse_clients.remove(client)

# --- Sincronizador Bidireccional Markdown <--> JSON ---
def load_backlog():
    if not os.path.exists(BACKLOG_PATH):
        return []
    try:
        with open(BACKLOG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("Error cargando backlog JSON:", e)
        return []

def save_backlog(data):
    try:
        os.makedirs(os.path.dirname(BACKLOG_PATH), exist_ok=True)
        with open(BACKLOG_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Error guardando backlog JSON:", e)

def sync_markdown_to_json():
    """Lee tablero_control.md y actualiza los checkboxes en backlog.json."""
    if not os.path.exists(TABLERO_PATH):
        print("El archivo tablero_control.md no existe.")
        return
        
    backlog = load_backlog()
    if not backlog:
        return
        
    try:
        with open(TABLERO_PATH, "r", encoding="utf-8") as f:
            md_content = f.read()
            
        lines = md_content.splitlines()
        task_regex = r'^\s*-\s*\[([ xX])\]\s*\*\*Tarea\s+([0-9.]+):\*\*'
        
        updated_tasks = {}
        for line in lines:
            match = re.match(task_regex, line)
            if match:
                completed = match[1].trim().toLowerCase() == 'x' if hasattr(match[1], 'trim') else match[1].strip().lower() == 'x'
                code = match[2]
                updated_tasks[code] = completed
                
        # Actualizar en el backlog JSON
        changed = False
        for task in backlog:
            # Mapear el ID de la tarea a su código (ej: REQ-001-INF-1.1 -> 1.1)
            code_parts = task["id"].split("-")
            code = code_parts[-1] if code_parts else ""
            if code in updated_tasks:
                old_state = task["estado"]
                new_state = "completado" if updated_tasks[code] else "pendiente"
                if old_state == "completado" and new_state == "pendiente":
                    task["estado"] = "pendiente"
                    changed = True
                elif old_state != "completado" and new_state == "completado":
                    task["estado"] = "completado"
                    changed = True
                    
        if changed:
            save_backlog(backlog)
            print("Sincronizados cambios de tablero_control.md hacia backlog.json.")
    except Exception as e:
        print("Error sincronizando Markdown a JSON:", e)

def rebuild_markdown_from_json():
    """Lee backlog.json y vuelve a generar el tablero_control.md recalculando porcentajes."""
    backlog = load_backlog()
    if not backlog or not os.path.exists(TABLERO_PATH):
        return
        
    try:
        with open(TABLERO_PATH, "r", encoding="utf-8") as f:
            content = f.read()
            
        lines = content.splitlines()
        
        # 1. Agrupar estadísticas por módulo
        module_stats = {}
        total_global = 0
        completed_global = 0
        
        for task in backlog:
            m_id = task["modulo_id"]
            m_name = task["modulo_nombre"]
            
            if m_id not in module_stats:
                module_stats[m_id] = {"name": m_name, "total": 0, "completed": 0}
                
            module_stats[m_id]["total"] += 1
            total_global += 1
            if task["estado"] == "completado":
                module_stats[m_id]["completed"] += 1
                completed_global += 1
                
        # 2. Modificar las marcas de checkbox en las líneas de tareas
        task_regex = r'^(\s*-\s*\[)[ xX](\]\s*\*\*Tarea\s+([0-9.]+):\*\*)'
        for i, line in enumerate(lines):
            match = re.match(task_regex, line)
            if match:
                prefix = match[1]
                suffix = match[2]
                code = match[3]
                
                # Buscar estado en backlog JSON
                is_completed = False
                for task in backlog:
                    if task["id"].endswith(code):
                        is_completed = task["estado"] == "completado"
                        break
                
                check = "x" if is_completed else " "
                lines[i] = f"{prefix}{check}{suffix}" + line[match.end():]

        # 3. Reescribir la tabla de progreso general
        in_table = False
        table_start = -1
        table_end = -1
        for i, line in enumerate(lines):
            if "| Módulo / Componente | Tareas Completadas |" in line:
                in_table = True
                table_start = i
                continue
            if in_table:
                if line.strip() == '' or line.startswith('---') or line.startswith('###'):
                    table_end = i
                    break
                    
        if table_start != -1 and table_end != -1:
            new_table = [
                "| Módulo / Componente | Tareas Completadas | Tareas Totales | Progreso | Estado |",
                "| :--- | :---: | :---: | :---: | :--- |"
            ]
            
            def draw_bar(pct):
                filled = round(pct / 10)
                bar = "█" * filled + "░" * (10 - filled)
                return f"`[{bar}] {pct}%`"
                
            for m_id in sorted(module_stats.keys()):
                stat = module_stats[m_id]
                pct = round((stat["completed"] / stat["total"]) * 100) if stat["total"] > 0 else 0
                state = "Completado" if pct == 100 else ("En Progreso" if pct > 0 else "Pendiente")
                new_table.append(f"| **{m_id}. {stat['name']}** | {stat['completed']} | {stat['total']} | {draw_bar(pct)} | {state} |")
                
            global_pct = round((completed_global / total_global) * 100) if total_global > 0 else 0
            global_state = "**Completado**" if global_pct == 100 else ("**En Progreso**" if global_pct > 0 else "**Pendiente**")
            new_table.append(f"| **PROGRESO GLOBAL DEL PROYECTO** | **{completed_global}** | **{total_global}** | {draw_bar(global_pct)} | {global_state} |")
            
            lines[table_start:table_end] = new_table

        # Escribir de vuelta al disco
        with open(TABLERO_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
            
    except Exception as e:
        print("Error reconstruyendo Markdown:", e)

# --- Simulación del Flujo de Agentes (Orquestador) ---
def run_agent_simulation(module_id):
    """Simula el flujo asíncrono del Orquestador invocando a los subagentes para un módulo."""
    global orchestration_active
    orchestration_active = True
    
    log_event(f"🚀 Iniciando orquestación de desarrollo para el Módulo {module_id}.", "orchestrator")
    time.sleep(1.5)
    
    # 1. Cargar Backlog
    backlog = load_backlog()
    tasks_to_run = [t for t in backlog if t["modulo_id"] == int(module_id) and t["estado"] != "completado"]
    
    if not tasks_to_run:
        log_event(f"El Módulo {module_id} no tiene tareas pendientes.", "orchestrator")
        orchestration_active = False
        return
        
    for task in tasks_to_run:
        task_id = task["id"]
        log_event(f"Procesando Tarea {task_id}: {task['descripcion']}", "orchestrator", task_id)
        time.sleep(1.5)
        
        # Simular intervención del Agente Arquitecto
        if "architect" in task["agentes_asignados"]:
            log_event("Analizando requerimientos y diseñando especificación técnica...", "architect", task_id)
            time.sleep(2)
            log_event("Diseño de base de datos y endpoints API generados con éxito.", "architect", task_id)
            
        # Simular intervención del Especialista FHIR/MCP
        if "fhir-mcp" in task["agentes_asignados"]:
            log_event("Mapeando flujos clínicos a recursos estándar HL7 FHIR...", "fhir-mcp", task_id)
            time.sleep(2)
            log_event("Esquemas de recursos FHIR R4 mapeados.", "fhir-mcp", task_id)
            
        # Simular intervención del Agente de Seguridad
        if "security" in task["agentes_asignados"]:
            log_event("Ejecutando auditoría Zero Trust y verificando OIDC (Keycloak)...", "security", task_id)
            time.sleep(2)
            log_event("Políticas de seguridad auditadas y aprobadas en base a HIPAA.", "security", task_id)
            
        # Pausa interactiva (HITL) para Simular Aprobación
        log_event("Cambio de estado: ESPERANDO APROBACIÓN del Super Administrador.", "orchestrator", task_id)
        task["estado"] = "esperando_aprobacion"
        save_backlog(backlog)
        rebuild_markdown_from_json()
        
        # En una simulación real, aquí el servidor esperaría a recibir un POST /api/approve
        # Para la simulación fluida, pausaremos 5 segundos emulando la revisión humana
        log_event("Pausa de revisión humana (Simulación HITL). Esperando aprobación...", "orchestrator", task_id)
        time.sleep(4)
        
        # Simulamos aprobación del Admin
        log_event("Aprobación del Super Admin recibida. Procediendo con la fase de implementación.", "orchestrator", task_id)
        task["estado"] = "completado"
        
        # Simular intervenciones finales (QA y DevOps)
        if "qa" in task["agentes_asignados"] or "qa-test" in task["agentes_asignados"]:
            log_event("Generando y ejecutando pruebas unitarias de integración...", "qa", task_id)
            time.sleep(1.5)
        if "devops" in task["agentes_asignados"]:
            log_event("Preparando Dockerfile y Helm charts de Kubernetes para el despliegue...", "devops", task_id)
            time.sleep(1.5)
            
        log_event(f"Tarea {task_id} COMPLETADA con éxito.", "orchestrator", task_id)
        save_backlog(backlog)
        rebuild_markdown_from_json()
        time.sleep(1)

    log_event(f"✅ Desarrollo del Módulo {module_id} completado con éxito.", "orchestrator")
    orchestration_active = False

# --- Servidor API HTTP ---
class APIHandler(http.server.SimpleHTTPRequestHandler):
    
    def end_headers(self):
        # Habilitar CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
        
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
        
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/api/backlog":
            # Sincronizar antes de enviar para tener cambios manuales
            sync_markdown_to_json()
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            backlog = load_backlog()
            self.wfile.write(json.dumps(backlog, ensure_ascii=False).encode("utf-8"))
            
        elif parsed_path.path == "/api/events":
            # Endpoint Server-Sent Events (SSE) para logs en tiempo real
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            
            with sse_lock:
                sse_clients.append(self)
                
            # Mantener conexión abierta
            while True:
                time.sleep(10)
                
        else:
            # Servir archivos estáticos del workspace (por ejemplo, dashboard.html)
            super().do_GET()
            
    def do_POST(self):
        parsed_path = urlparse(self.path)
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        if parsed_path.path == "/api/action":
            try:
                data = json.loads(post_data)
                module_id = data.get("module_id")
                action = data.get("action")
                
                if orchestration_active:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "La orquestación ya está activa en otro módulo."}).encode("utf-8"))
                    return
                    
                # Iniciar la orquestación en un hilo secundario
                t = threading.Thread(target=run_agent_simulation, args=(module_id,))
                t.daemon = True
                t.start()
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "started", "module_id": module_id}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
                
        elif parsed_path.path == "/api/approve":
            try:
                data = json.loads(post_data)
                task_id = data.get("task_id")
                # En un flujo de desarrollo real, esta llamada desbloquearía la espera del hilo
                log_event(f"Aprobación manual del Super Admin recibida para Tarea {task_id}.", "orchestrator")
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "approved"}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == "__main__":
    # Sincronizar archivos al arrancar
    print("Sincronizando estado inicial...")
    sync_markdown_to_json()
    rebuild_markdown_from_json()
    
    server = ThreadedHTTPServer(("", PORT), APIHandler)
    print(f"🚀 Servidor API de Orquestación HCE corriendo en http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nApagando servidor...")
        server.shutdown()
        sys.exit(0)
