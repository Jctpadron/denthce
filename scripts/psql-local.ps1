param(
  [string]$Database = "hce_fhir",
  [string]$User = "hce_admin",
  [string]$Container = "hce-database"
)

docker exec -it $Container psql -U $User -d $Database
