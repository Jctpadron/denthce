<#
.SYNOPSIS
Script para preparar y desplegar los componentes de HCE a AWS.

.DESCRIPTION
Este script asume que tienes AWS CLI instalado y configurado (`aws configure`).
Ejecuta el empaquetado del backend y lo prepara para subir a Elastic Beanstalk.
#>

param (
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Keycloak,
    [switch]$CloudFront
)

# IDs de distribuciones CloudFront (se completan tras la Fase 2)
$CF_FRONTEND_ID  = $env:CF_FRONTEND_ID   # Ejemplo: E1ABCDEFGHIJKL
$CF_KEYCLOAK_ID  = $env:CF_KEYCLOAK_ID
$CF_BACKEND_ID   = $env:CF_BACKEND_ID

$ErrorActionPreference = "Stop"

if ($Backend) {
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
