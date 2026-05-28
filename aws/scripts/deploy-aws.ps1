<#
.SYNOPSIS
Script para preparar y desplegar los componentes de HCE a AWS.

.DESCRIPTION
Este script asume que tienes AWS CLI instalado y configurado (`aws configure`).
Ejecuta el empaquetado del backend y lo prepara para subir a Elastic Beanstalk.
#>

param (
    [switch]$Backend,
    [switch]$Frontend
)

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

if ($Frontend) {
    Write-Host "[START] Compilando y subiendo Frontend a AWS S3..." -ForegroundColor Cyan
    
    # Requiere definir el bucket
    $S3_BUCKET = "s3://odontocloud-frontend-2026"
    
    Set-Location "..\..\hce-frontend"
    
    Write-Host "Compilando Vite..."
    npm run build
    
    Write-Host "Sincronizando con S3 ($S3_BUCKET)..."
    aws s3 sync dist/ $S3_BUCKET --delete
    
    Write-Host "[OK] Frontend desplegado en S3!" -ForegroundColor Green
}
