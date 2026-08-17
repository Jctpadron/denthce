param(
  [string]$HostName = "hce-database-3.cmhgma6u2fhs.us-east-1.rds.amazonaws.com",
  [string]$Database = "hce_fhir",
  [string]$User = "hce_admin",
  [int]$Port = 5432
)

if (-not $env:PGPASSWORD) {
  Write-Error "Falta PGPASSWORD. Definilo en esta terminal antes de conectar. Ejemplo: `$env:PGPASSWORD='tu_clave_rds'"
  exit 1
}

docker run --rm -it `
  -e PGPASSWORD=$env:PGPASSWORD `
  postgres:16-alpine `
  psql `
  "sslmode=require host=$HostName port=$Port dbname=$Database user=$User"
