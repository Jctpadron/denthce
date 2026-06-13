# Walkthrough: Consolidación Git y Preparación de Despliegue en AWS (Producción)

Este walkthrough detalla los pasos ejecutados para establecer la estrategia formal de ramas en Git (desarrollo local en `develop` y producción en `main`) y la preparación del empaquetado de producción de los servicios frontend y backend para su respectivo despliegue en AWS.

---

## 1. Flujo de Trabajo en Git (Estrategia de Ramas)

Para aislar de forma segura los desarrollos locales de producción y cumplir con el diseño propuesto:
1. **Creación de la rama `develop`:** Se creó la rama de desarrollo local y se migró a ella de forma segura.
   ```powershell
   git checkout -b develop
   ```
2. **Confirmación de Cambios:** Se registraron y confirmaron en `develop` todos los archivos modificados de la separación de entornos, diagnósticos de base de datos, inicializaciones y la prueba de estrés de 200 pacientes.
   ```powershell
   git add .
   git commit -m "feat: separacion de entornos, diagnostico de BD y prueba de esfuerzo de 200 pacientes"
   ```
3. **Fusión en `main`:** Se cambió de vuelta a la rama principal de producción y se fusionaron los cambios verificados mediante una actualización rápida (Fast-forward):
   ```powershell
   git checkout main
   git merge develop
   ```

---

## 2. Preparación y Empaquetado del Backend (AWS Elastic Beanstalk)

Para compilar y empaquetar el backend de NestJS listo para AWS:
1. **Compilación de NestJS:** Se ejecutó con éxito el build local de producción, generando la carpeta `./hce-backend/dist/`.
   ```powershell
   npm run build
   ```
2. **Generación del ZIP:** Se ejecutó el script de AWS con el switch `-Backend`, creando el paquete comprimido ZIP que contiene el compilado, dependencias de package y configuraciones de Elastic Beanstalk (`.ebextensions/` y `Procfile`):
   ```powershell
   cd aws/scripts
   ./deploy-aws.ps1 -Backend
   ```
   **ZIP resultante listo para subir a Beanstalk:**
   `aws/scripts/hce-backend-aws-20260528-2017.zip`

---

## 3. Preparación del Frontend (AWS S3)

1. **Compilación de Vite:** Se compiló localmente la aplicación de React/Vite para producción, generando con éxito la carpeta optimizada `./hce-frontend/dist/` (HTML, JS, CSS minimizados).
2. **Sincronización con S3:**
   * **Importante:** Dado que la terminal local del agente no tiene el comando ejecutable `aws` (AWS CLI) configurado globalmente en su `PATH`, la sincronización final debe ser ejecutada de manera manual desde una consola local del host que tenga las credenciales de AWS activas.
   * **Comando a ejecutar:**
     ```powershell
     cd aws/scripts
     ./deploy-aws.ps1 -Frontend
     ```
     o de manera directa:
     ```powershell
     aws s3 sync d:/APP-jct/app-historias-clinicas/hce-frontend/dist/ s3://odontocloud-frontend-2026 --delete
     ```
