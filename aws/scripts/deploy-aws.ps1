<#
.SYNOPSIS
Script para preparar y desplegar los componentes de HCE a AWS.

.DESCRIPTION
Este script asume que tienes AWS CLI instalado y configurado (`aws configure`).
Ejecuta el empaquetado del backend y lo prepara para subir a Elastic Beanstalk.

GUARD DE TRAZABILIDAD (2026-08-17)
Antes de empaquetar o desplegar, el script verifica que el codigo a publicar
este commiteado. Motivo: el 2026-08-17 se detecto que el frontend en produccion
(app.systia.ar) se habia construido desde archivos SIN commitear, con lo cual
producción no era reconstruible, reversible ni auditable desde git.

Reglas:
  - Arbol sucio en las rutas que entran al artefacto  -> BLOQUEA.
  - HEAD no apunta a un tag                           -> ADVIERTE (BLOQUEA con -RequireTag).
  - Commit no publicado en origin                     -> ADVIERTE.
  - -Force omite los bloqueos, deja constancia en el log y exige confirmacion.

Cada corrida que produce un artefacto registra su procedencia en deploy-log.txt.

.PARAMETER Force
Omite los bloqueos del guard. Uso excepcional (hotfix). Queda asentado en el log.

.PARAMETER RequireTag
Eleva a bloqueante la exigencia de que HEAD sea un tag. Activar cuando se adopte
el tagueo de releases.

.EXAMPLE
.\deploy-aws.ps1 -Frontend
.EXAMPLE
.\deploy-aws.ps1 -Backend -RequireTag
#>

param (
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Keycloak,
    [switch]$CloudFront,
    [switch]$Force,
    [switch]$RequireTag
)

# IDs de distribuciones CloudFront (se completan tras la Fase 2)
$CF_FRONTEND_ID  = $env:CF_FRONTEND_ID   # Ejemplo: E1ABCDEFGHIJKL
$CF_KEYCLOAK_ID  = $env:CF_KEYCLOAK_ID
$CF_BACKEND_ID   = $env:CF_BACKEND_ID

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# GUARD DE TRAZABILIDAD
# Impide que un artefacto se construya desde codigo que no esta en git.
# Ver el bloque .DESCRIPTION de la cabecera para el contexto.
# ---------------------------------------------------------------------------

$script:RepoRoot = $null

function Get-RepoRoot {
    if ($script:RepoRoot) { return $script:RepoRoot }
    $root = git -C $PSScriptRoot rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0) { return $null }
    $script:RepoRoot = $root.Trim()
    return $script:RepoRoot
}

function Write-DeployLog {
    param([string]$Linea)
    $logPath = Join-Path $PSScriptRoot "deploy-log.txt"
    Add-Content -Path $logPath -Value $Linea -Encoding utf8
}

function Assert-DeploySafe {
    param(
        [Parameter(Mandatory = $true)][string]$Componente,
        [Parameter(Mandatory = $true)][string[]]$RutasFuente
    )

    Write-Host ""
    Write-Host "[GUARD] Verificando trazabilidad de $Componente ..." -ForegroundColor Cyan

    $bloqueos = @()
    $avisos   = @()
    $sha = ""; $shaCorto = ""; $rama = ""; $tag = ""

    $repoRoot = Get-RepoRoot
    if (-not $repoRoot) {
        $bloqueos += "No se pudo determinar el repositorio git (git no disponible o fuera de un repo)."
    }
    else {
        $sha      = (git -C $repoRoot rev-parse HEAD).Trim()
        $shaCorto = (git -C $repoRoot rev-parse --short HEAD).Trim()
        $rama     = (git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()

        $tagRaw = git -C $repoRoot tag --points-at HEAD | Select-Object -First 1
        if ($tagRaw) { $tag = $tagRaw.Trim() }

        # 1) BLOQUEANTE: el codigo que entra al artefacto debe estar commiteado.
        #    --porcelain incluye modificados, borrados y NO trackeados.
        $sucios = @(git -C $repoRoot status --porcelain -- $RutasFuente)
        if ($sucios.Count -gt 0) {
            $bloqueos += "Hay $($sucios.Count) archivo(s) sin commitear en: $($RutasFuente -join ', ')"
            foreach ($s in ($sucios | Select-Object -First 12)) { $bloqueos += "        $s" }
            if ($sucios.Count -gt 12) { $bloqueos += "        ... y $($sucios.Count - 12) mas" }
        }

        # 2) HEAD deberia apuntar a un tag (identifica la release desplegada).
        if (-not $tag) {
            if ($RequireTag) {
                $bloqueos += "HEAD no apunta a ningun tag y -RequireTag esta activo."
            }
            else {
                $avisos += "HEAD no apunta a un tag: lo desplegado se identificara solo por SHA ($shaCorto)."
            }
        }

        # 3) El commit deberia estar publicado, o nadie mas puede reconstruirlo.
        $enRemoto = @(git -C $repoRoot branch -r --contains HEAD)
        if ($enRemoto.Count -eq 0) {
            $avisos += "El commit $shaCorto no esta publicado en origin. Hace push antes de desplegar."
        }
    }

    foreach ($a in $avisos)   { Write-Host "  [AVISO] $a" -ForegroundColor Yellow }

    if ($bloqueos.Count -gt 0) {
        Write-Host ""
        Write-Host "  ================================================================" -ForegroundColor Red
        Write-Host "   DEPLOY BLOQUEADO - el artefacto no seria reconstruible" -ForegroundColor Red
        Write-Host "  ================================================================" -ForegroundColor Red
        foreach ($b in $bloqueos) { Write-Host "   $b" -ForegroundColor Red }
        Write-Host ""

        if (-not $Force) {
            Write-Host "   Como resolverlo:" -ForegroundColor Yellow
            Write-Host "     1. git add <archivos>  &  git commit" -ForegroundColor Yellow
            Write-Host "     2. git push" -ForegroundColor Yellow
            Write-Host "     3. git tag -a vX.Y.Z -m 'release'  &  git push --tags" -ForegroundColor Yellow
            Write-Host "     4. Volver a correr este script" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   Si es una emergencia real, repeti el comando con -Force." -ForegroundColor Yellow
            Write-Host "   Quedara asentado en deploy-log.txt." -ForegroundColor Yellow
            Write-Host ""
            Write-DeployLog "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  BLOQUEADO   $Componente  sha=$shaCorto  rama=$rama  motivo=arbol-sucio-o-sin-tag"
            throw "Guard de trazabilidad: $Componente no se empaqueta desde codigo sin commitear."
        }

        Write-Host "   -Force activo: se continua PESE a los bloqueos." -ForegroundColor Red
        Write-Host "   El artefacto resultante NO sera reconstruible desde git." -ForegroundColor Red
        Write-Host ""
        Write-DeployLog "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  FORZADO     $Componente  sha=$shaCorto  rama=$rama  usuario=$env:USERNAME  bloqueos=$($bloqueos.Count)"
        return
    }

    $etiqueta = $tag
    if (-not $etiqueta) { $etiqueta = "(sin tag)" }

    Write-Host "  [OK] Arbol limpio en: $($RutasFuente -join ', ')" -ForegroundColor Green
    Write-Host "       commit : $shaCorto" -ForegroundColor Gray
    Write-Host "       rama   : $rama" -ForegroundColor Gray
    Write-Host "       tag    : $etiqueta" -ForegroundColor Gray
    Write-Host ""
    Write-DeployLog "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  OK          $Componente  sha=$sha  rama=$rama  tag=$etiqueta  usuario=$env:USERNAME"
}

if ($Backend) {
    # El ZIP se arma con hce-backend/dist + package*.json y aws/backend/.ebextensions:
    # esas son las rutas cuyo estado tiene que estar congelado en git.
    Assert-DeploySafe -Componente "Backend" -RutasFuente @("hce-backend", "aws/backend")

    Write-Host "[PACK] Empaquetando Backend para AWS Elastic Beanstalk..." -ForegroundColor Cyan

    $backendDir = "..\..\hce-backend"
    $buildDir = ".\build-backend"
    
    if (Test-Path $buildDir) { Remove-Item -Path $buildDir -Recurse -Force }
    New-Item -ItemType Directory -Path $buildDir | Out-Null
    
    # Copiar archivos esenciales
    Write-Host "Copiando archivos..."
    Copy-Item -Path "$backendDir\dist" -Destination "$buildDir\dist" -Recurse
    Copy-Item -Path "$backendDir\package.json" -Destination "$buildDir\"
    Copy-Item -Path "$backendDir\package-lock.json" -Destination "$buildDir\"
    
    # Copiar configuración de AWS EB
    Copy-Item -Path "..\backend\.ebextensions" -Destination "$buildDir\.ebextensions" -Recurse
    if (Test-Path "..\backend\Procfile") { Copy-Item -Path "..\backend\Procfile" -Destination "$buildDir\" }
    
    # Crear ZIP compatible con Linux (Forward slashes forzadas)
    Write-Host "Creando ZIP..."
    $timestamp = Get-Date -Format "yyyyMMdd-HHmm"
    $zipName = "hce-backend-aws-$timestamp.zip"
    $zipPath = "$PWD\$zipName"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipStream = [System.IO.File]::Create($zipPath)
    $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
    $basePath = (Resolve-Path $buildDir).Path
    Get-ChildItem -Path $basePath -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($basePath.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $relativePath) | Out-Null
    }
    $archive.Dispose()
    $zipStream.Dispose()
    
    Write-Host "[OK] Empaquetado completo: $zipName" -ForegroundColor Green
    Write-Host "Sube este ZIP a tu entorno de AWS Elastic Beanstalk." -ForegroundColor Yellow
}

if ($Keycloak) {
    Assert-DeploySafe -Componente "Keycloak" -RutasFuente @("aws/keycloak")

    Write-Host "[PACK] Empaquetando Keycloak para AWS Elastic Beanstalk..." -ForegroundColor Cyan

    $timestamp = Get-Date -Format "yyyyMMdd-HHmm"
    $zipName = "hce-keycloak-aws-$timestamp.zip"
    $zipPath = "$PSScriptRoot\$zipName"

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        (Resolve-Path "..\keycloak").Path,
        $zipPath
    )
    Write-Host "[OK] Keycloak empaquetado: $zipName" -ForegroundColor Green
    Write-Host "Sube este ZIP al entorno EB de Keycloak (Odontocloud-Keycloak-env)." -ForegroundColor Yellow
}

if ($Frontend) {
    # Esta es la rama que efectivamente PUBLICA (s3 sync --delete + invalidacion CF),
    # y la que el 2026-08-17 subio a produccion codigo sin commitear.
    Assert-DeploySafe -Componente "Frontend" -RutasFuente @("hce-frontend")

    Write-Host "[START] Compilando y subiendo Frontend a AWS S3..." -ForegroundColor Cyan

    # Bucket S3 del frontend
    $S3_BUCKET = "s3://odontocloud-frontend-2026"
    
    Set-Location "..\..\hce-frontend"
    
    Write-Host "Compilando Vite (modo production)..."
    npm run build
    
    Write-Host "Sincronizando con S3 ($S3_BUCKET)..."
    aws s3 sync dist/ $S3_BUCKET --delete
    
    Write-Host "[OK] Frontend desplegado en S3!" -ForegroundColor Green

    # Invalidar cache de CloudFront si el ID esta configurado
    if ($CF_FRONTEND_ID) {
        Write-Host "Invalidando cache CloudFront ($CF_FRONTEND_ID)..." -ForegroundColor Cyan
        aws cloudfront create-invalidation `
            --distribution-id $CF_FRONTEND_ID `
            --paths "/*" `
            --query "Invalidation.{Id:Id,Estado:Status}" `
            --output table
        Write-Host "[OK] Invalidacion solicitada. Propagacion: ~30 seg." -ForegroundColor Green
    } else {
        Write-Host "[INFO] CF_FRONTEND_ID no configurado. Defini la variable de entorno para invalidar cache automaticamente." -ForegroundColor Yellow
    }
}

if ($CloudFront) {
    Write-Host "[CF] Creando distribuciones CloudFront desde aws/cloudfront/*.json ..." -ForegroundColor Cyan
    $cfDir = "..\cloudfront"

    Write-Host "Creando CF-Frontend (app.systia.ar)..."
    $frontendResult = & "C:\Program Files\Amazon\AWSCLIV2\aws.exe" cloudfront create-distribution `
        --distribution-config file://$cfDir/cf-frontend.json `
        --query "Distribution.{Id:Id,Dominio:DomainName}" `
        --output json | ConvertFrom-Json
    Write-Host "  ID: $($frontendResult.Id)  Dominio: $($frontendResult.Dominio)" -ForegroundColor Green

    Write-Host "Creando CF-Keycloak (auth.systia.ar)..."
    $keycloakResult = & "C:\Program Files\Amazon\AWSCLIV2\aws.exe" cloudfront create-distribution `
        --distribution-config file://$cfDir/cf-keycloak.json `
        --query "Distribution.{Id:Id,Dominio:DomainName}" `
        --output json | ConvertFrom-Json
    Write-Host "  ID: $($keycloakResult.Id)  Dominio: $($keycloakResult.Dominio)" -ForegroundColor Green

    Write-Host "Creando CF-Backend (api.systia.ar)..."
    $backendResult = & "C:\Program Files\Amazon\AWSCLIV2\aws.exe" cloudfront create-distribution `
        --distribution-config file://$cfDir/cf-backend.json `
        --query "Distribution.{Id:Id,Dominio:DomainName}" `
        --output json | ConvertFrom-Json
    Write-Host "  ID: $($backendResult.Id)  Dominio: $($backendResult.Dominio)" -ForegroundColor Green

    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " DISTRIBUCIONES CREADAS - REGISTRA ESTOS DATOS" -ForegroundColor Yellow
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " Frontend  ID=$($frontendResult.Id)" -ForegroundColor White
    Write-Host "           CNAME: app.systia.ar -> $($frontendResult.Dominio)" -ForegroundColor White
    Write-Host " Keycloak  ID=$($keycloakResult.Id)" -ForegroundColor White
    Write-Host "           CNAME: auth.systia.ar -> $($keycloakResult.Dominio)" -ForegroundColor White
    Write-Host " Backend   ID=$($backendResult.Id)" -ForegroundColor White
    Write-Host "           CNAME: api.systia.ar -> $($backendResult.Dominio)" -ForegroundColor White
    Write-Host "========================================================" -ForegroundColor Cyan
}
