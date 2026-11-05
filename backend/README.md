# Backend del Dashboard SOC

Spring Boot 3 · Java 21. Es el único componente que habla con TheHive, y lo hace en **solo lectura**.
Contrato con el frontend: `../docs/contrato-api.md`. Hallazgos de TheHive: `../docs/sondeo-thehive.md`.

## Variables de entorno

| Variable | Obligatoria | Por defecto | Qué es |
|---|---|---|---|
| `THEHIVE_API_KEY` | **sí** | — | API key de TheHive. Nunca en el código ni en archivos versionados. Si falta, la app no arranca. |
| `THEHIVE_URL` | **sí** | — | URL base de TheHive (`https://servidor:puerto`). |
| `THEHIVE_ORG` | no | `escuelaing` | Organización fija enviada en `X-Organisation`; el frontend no puede cambiarla. |
| `DASHBOARD_ORIGINS` | no | `http://localhost:5173` | Orígenes del frontend permitidos por CORS (varios, separados por comas). |
| `SERVER_ADDRESS` | no | `127.0.0.1` | Dirección en la que escucha. |
| `SERVER_PORT` | no | `8080` | Puerto. |

## Arrancar

```powershell
$env:THEHIVE_URL = "https://<servidor>:8445"
$segura = Read-Host "THEHIVE_API_KEY" -AsSecureString
$env:THEHIVE_API_KEY = [System.Net.NetworkCredential]::new("", $segura).Password
.\mvnw.cmd spring-boot:run
```

## Pruebas

```powershell
.\mvnw.cmd test
```

Las pruebas no llaman al TheHive real ni dependen de las variables de entorno del equipo.

### Si Maven falla con `PKIX path building failed`

Algo en la red (antivirus o proxy) cambia el certificado de Maven Central y Java no lo reconoce. Solo en Windows y
solo en tu equipo (no lo pongas en el repo):

```powershell
$env:MAVEN_OPTS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE"
```

## Endpoints

| Ruta | Estado |
|---|---|
| `GET /api/dashboard/configuracion` | listo |
| `GET /api/dashboard/resumen`, `/alertas`, `/alertas/{id}` | pendientes (pasos siguientes) |

Toda la API es de solo `GET`; hay un test que falla si aparece otro método.
