# Walkthrough: Publicación HCE via Cloudflare Tunnel

**Fecha:** 2026-05-27  
**URL pública:** `https://historiaclinica.systia.ar`  
**Tunnel:** `mi-app-web-v2` (ID: `7da2d27d-8808-41b1-b15b-efd2ed5ae7a6`)

---

## Cambios realizados

### 1. `C:\Users\jctsi\.cloudflared\config.yml` — Corregido

El archivo apuntaba al tunnel inactivo `df9855f4`. Se actualizó al tunnel activo `mi-app-web-v2`:

```yaml
tunnel: 7da2d27d-8808-41b1-b15b-efd2ed5ae7a6
credentials-file: C:\Users\jctsi\.cloudflared\7da2d27d-8808-41b1-b15b-efd2ed5ae7a6.json

ingress:
  - hostname: historiaclinica.systia.ar
    service: http://localhost:5173
  - service: http_status:404
```

### 2. DNS Cloudflare — CNAME creado

```
historiaclinica.systia.ar  →  CNAME  →  7da2d27d-8808-41b1-b15b-efd2ed5ae7a6.cfargotunnel.com
```

Comando ejecutado:
```powershell
cloudflared tunnel route dns --overwrite-dns mi-app-web-v2 historiaclinica.systia.ar
```

### 3. Script `start-demo.ps1` — Creado

Ubicación: [`D:\APP-jct\app-historias-clinicas\start-demo.ps1`](file:///d:/APP-jct/app-historias-clinicas/start-demo.ps1)

Levanta en orden:
1. Docker Compose → PostgreSQL (`hce-db`) + Keycloak (`hce-identity`)
2. Backend NestJS en ventana separada → puerto 3000
3. Frontend Vite en ventana separada → puerto 5173
4. Cloudflare Tunnel en primer plano → publica en `https://historiaclinica.systia.ar`

---

## Arquitectura de la demo

```
Doctor (celular/PC)
  └─► https://historiaclinica.systia.ar  (HTTPS - Cloudflare Edge)
          └─► Cloudflare Tunnel cifrado
                  └─► cloudflared (PC Windows - jctsi)
                          └─► http://localhost:5173  (Vite Frontend)
                                  └─► http://localhost:3000  (NestJS API)
                                          ├─► PostgreSQL:5432  (Docker)
                                          └─► Keycloak:8080    (Docker)
```

---

## Cómo iniciar la demo

### Opción A — Script automático (recomendado)

Abrir PowerShell como **Administrador** y ejecutar:

```powershell
cd D:\APP-jct\app-historias-clinicas
.\start-demo.ps1
```

Si hay error de política de ejecución:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start-demo.ps1
```

### Opción B — Manual paso a paso

```powershell
# 1. Servicios Docker
cd D:\APP-jct\app-historias-clinicas
docker compose up -d hce-db hce-identity

# 2. Backend (nueva ventana PowerShell)
cd D:\APP-jct\app-historias-clinicas\hce-backend
npm run start:dev

# 3. Frontend (nueva ventana PowerShell)
cd D:\APP-jct\app-historias-clinicas\hce-frontend
npm run dev

# 4. Tunnel (nueva ventana PowerShell)
cloudflared tunnel --config "C:\Users\jctsi\.cloudflared\config.yml" run mi-app-web-v2
```

---

## Cómo detener la demo

1. En la ventana del tunnel: **Ctrl+C**
2. Cerrar las ventanas de backend y frontend
3. Para también bajar Docker:
```powershell
cd D:\APP-jct\app-historias-clinicas
docker compose down
```

---

## Verificación

### ✅ Verificar que el tunnel está activo
```powershell
cloudflared tunnel info mi-app-web-v2
```
Debe mostrar conexiones activas con `CONNECTIONS`.

### ✅ Verificar acceso externo
1. Desconectar WiFi del celular (usar datos móviles)
2. Abrir: `https://historiaclinica.systia.ar`
3. Debe cargar la pantalla de login

---

## Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| El tunnel no conecta | Vite no está corriendo en :5173 | Verificar que `npm run dev` está activo |
| Error 502 Bad Gateway | Backend caído | Verificar NestJS en puerto 3000 |
| Login falla | Keycloak no disponible | Verificar `hce-identity` en Docker |
| Script bloqueado | Política de ejecución de PS | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| DNS no resuelve | Propagación DNS pendiente | Esperar 2-5 minutos |
