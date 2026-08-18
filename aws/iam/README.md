# IAM — DentHCE

## Estado antes del 2026-08-17

La cuenta AWS operaba con **cero usuarios IAM** y **dos claves de acceso root activas**
(creadas el 2026-06-13 y el 2026-07-07). Todo — deploys, scripts, consultas — se
hacía con credenciales root, que dan acceso irrestricto a la cuenta entera,
incluido el bucket `odontocloud-clinical-evidence-751835847253` donde vive la
evidencia clínica de los pacientes (firmas de conformidad y adjuntos).

## Qué se creó

**Usuario:** `denthce-deploy`
**Política:** `DentHCE-Deploy` (`DentHCE-Deploy.policy.json`, versionada acá)

### Puede

| Servicio | Alcance |
| :-- | :-- |
| Elastic Beanstalk | Describe\*, `CreateApplicationVersion`, `UpdateEnvironment` |
| S3 — artefactos | `elasticbeanstalk-us-east-1-751835847253` (put/get/list) |
| S3 — frontend | `odontocloud-frontend-2026` (put/get/delete/list — `sync --delete` necesita delete) |
| CloudFront | `CreateInvalidation`, `GetInvalidation`, `ListDistributions` |

### No puede — con `Deny` explícito

| Recurso | Motivo |
| :-- | :-- |
| `odontocloud-clinical-evidence-*` | **Datos de pacientes.** Un usuario de deploy no tiene ninguna razón para leerlos |
| `iam:*` | No puede escalar sus propios privilegios |
| `rds:*` | No puede tocar la base de producción |
| `kms:ScheduleKeyDeletion`, `ec2:TerminateInstances` | Acciones destructivas irreversibles |

El `Deny` explícito gana sobre cualquier `Allow` futuro: aunque alguien adjunte
otra política más amplia a este usuario, estas cuatro siguen bloqueadas.

### Verificado

```
aws sts get-caller-identity --profile denthce-deploy
  → arn:aws:iam::751835847253:user/denthce-deploy

PERMITIDO  describe-environments        → prod-backend-20260817-17fddd6
PERMITIDO  s3 ls (artefactos)           → OK
DENEGADO   s3 ls (evidencia clínica)    → AccessDenied ... explicit deny
DENEGADO   iam list-users               → AccessDenied ... explicit deny
DENEGADO   rds describe-db-instances    → AccessDenied ... explicit deny
```

## Uso

`deploy-aws.ps1` usa el perfil `denthce-deploy` por defecto y **avisa en amarillo
si detecta que estás operando como root**.

```powershell
$env:AWS_PROFILE = 'denthce-deploy'
.\deploy-aws.ps1 -Backend -RequireTag
```

## ⚠️ Pendiente — lo tiene que hacer una persona

**Las dos claves root siguen activas.** No se desactivaron a propósito: si algo
más las usa (GitHub Actions, otro script, otra máquina), desactivarlas a ciegas
rompe ese flujo sin aviso.

Orden seguro:

1. Verificar qué usa cada clave: **IAM → Users → Security credentials → Last used**.
2. Migrar cada consumidor al perfil `denthce-deploy` (o a un usuario propio con
   su propia política acotada).
3. Revisar el secreto `AWS_ACCESS_KEY_ID` de GitHub Actions: si es una clave root,
   reemplazarlo por el del usuario de deploy.
4. Recién entonces: **desactivar** las claves root (no borrarlas todavía).
5. Esperar unos días. Si nada se rompe, borrarlas.
6. Activar MFA en la cuenta root y guardar sus credenciales fuera de línea.

Mientras las claves root existan y estén en una máquina de desarrollo, el
mínimo privilegio de este usuario es una mejora parcial: el camino amplio sigue
abierto al lado.
