param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "status")]
    [string]$Action
)

$ErrorActionPreference = "Stop"

$RDS_INSTANCE = "hce-database-3"
$EB_ENV_BACKEND = "Odontocloud-env"
$EB_ENV_KEYCLOAK = "Odontocloud-Keycloak-env"

function Stop-AWSEnv {
    Write-Host "[STOP] Iniciando proceso de pausa de recursos AWS para ahorro de costos..." -ForegroundColor Cyan
    
    Write-Host "1. Deteniendo base de datos RDS ($RDS_INSTANCE)..."
    aws rds stop-db-instance --db-instance-identifier $RDS_INSTANCE > $null
    Write-Host "   -> Comando enviado (puede tardar unos minutos en apagarse completamente)." -ForegroundColor Yellow

    Write-Host "2. Reduciendo instancias del Backend EB ($EB_ENV_BACKEND) a 0..."
    aws elasticbeanstalk update-environment --environment-name $EB_ENV_BACKEND --option-settings Namespace=aws:autoscaling:asg,OptionName=MinSize,Value=0 Namespace=aws:autoscaling:asg,OptionName=MaxSize,Value=0 > $null
    Write-Host "   -> Comando enviado." -ForegroundColor Yellow

    Write-Host "3. Reduciendo instancias de Keycloak EB ($EB_ENV_KEYCLOAK) a 0..."
    aws elasticbeanstalk update-environment --environment-name $EB_ENV_KEYCLOAK --option-settings Namespace=aws:autoscaling:asg,OptionName=MinSize,Value=0 Namespace=aws:autoscaling:asg,OptionName=MaxSize,Value=0 > $null
    Write-Host "   -> Comando enviado." -ForegroundColor Yellow

    Write-Host "[OK] Proceso de pausa completado. Los recursos estan apagandose." -ForegroundColor Green
}

function Start-AWSEnv {
    Write-Host "[START] Iniciando proceso de encendido de recursos AWS..." -ForegroundColor Cyan
    
    Write-Host "1. Iniciando base de datos RDS ($RDS_INSTANCE)..."
    aws rds start-db-instance --db-instance-identifier $RDS_INSTANCE > $null
    Write-Host "   -> Comando enviado (espera un par de minutos a que este disponible)." -ForegroundColor Yellow

    Write-Host "2. Restaurando instancias del Backend EB ($EB_ENV_BACKEND) a 1..."
    aws elasticbeanstalk update-environment --environment-name $EB_ENV_BACKEND --option-settings Namespace=aws:autoscaling:asg,OptionName=MinSize,Value=1 Namespace=aws:autoscaling:asg,OptionName=MaxSize,Value=1 > $null
    Write-Host "   -> Comando enviado." -ForegroundColor Yellow

    Write-Host "3. Restaurando instancias de Keycloak EB ($EB_ENV_KEYCLOAK) a 1..."
    aws elasticbeanstalk update-environment --environment-name $EB_ENV_KEYCLOAK --option-settings Namespace=aws:autoscaling:asg,OptionName=MinSize,Value=1 Namespace=aws:autoscaling:asg,OptionName=MaxSize,Value=1 > $null
    Write-Host "   -> Comando enviado." -ForegroundColor Yellow

    Write-Host "[OK] Proceso de encendido completado. Los servidores estaran disponibles en breve." -ForegroundColor Green
}

function Get-AWSEnvStatus {
    Write-Host "[STATUS] Consultando estado de recursos AWS..." -ForegroundColor Cyan
    
    $rdsStatus = (aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE --query "DBInstances[0].DBInstanceStatus" --output text)
    Write-Host "RDS Database ($RDS_INSTANCE): $rdsStatus" -ForegroundColor $(if($rdsStatus -eq 'available') {'Green'} elseif($rdsStatus -eq 'stopped') {'Gray'} else {'Yellow'})

    $ebBackendStatus = (aws elasticbeanstalk describe-environments --environment-names $EB_ENV_BACKEND --query "Environments[0].Status" --output text)
    $ebBackendHealth = (aws elasticbeanstalk describe-environments --environment-names $EB_ENV_BACKEND --query "Environments[0].Health" --output text)
    Write-Host "EB Backend ($EB_ENV_BACKEND): $ebBackendStatus (Health: $ebBackendHealth)" -ForegroundColor $(if($ebBackendStatus -eq 'Ready') {'Green'} else {'Yellow'})

    $ebKeycloakStatus = (aws elasticbeanstalk describe-environments --environment-names $EB_ENV_KEYCLOAK --query "Environments[0].Status" --output text)
    $ebKeycloakHealth = (aws elasticbeanstalk describe-environments --environment-names $EB_ENV_KEYCLOAK --query "Environments[0].Health" --output text)
    Write-Host "EB Keycloak ($EB_ENV_KEYCLOAK): $ebKeycloakStatus (Health: $ebKeycloakHealth)" -ForegroundColor $(if($ebKeycloakStatus -eq 'Ready') {'Green'} else {'Yellow'})
}

switch ($Action) {
    "start"  { Start-AWSEnv }
    "stop"   { Stop-AWSEnv }
    "status" { Get-AWSEnvStatus }
}
