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

Java no reconoce la cadena de certificados de Maven Central (por ejemplo, un JDK que no tiene la cadena nueva de Let's Encrypt). Solo en Windows y
solo en tu equipo (no lo pongas en el repo):

```powershell
$env:MAVEN_OPTS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE"
```

### Si la aplicación dice "TheHive no es alcanzable: certificado no confiable"

Es el mismo problema pero al ejecutar la aplicación: tu JDK no reconoce la cadena de certificados con la que responde
TheHive (típico de un JDK que no trae la cadena nueva de Let's Encrypt). **La validación TLS nunca se desactiva** ni
hay opción para hacerlo. Hay dos soluciones: actualizar el JDK 21 a la última versión de parche, o hacer que Java use
el almacén de certificados de Windows, que sí tiene la cadena. Solo en tu equipo:

```powershell
# Con Maven (spring-boot:run arranca otra JVM, por eso va como argumento de esa JVM):
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.jvmArguments=-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE"

# Con el jar:
java -Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE -jar target\dashboard-soc-backend-0.1.0.jar

# Para cualquier arranque de la sesión actual:
$env:JAVA_TOOL_OPTIONS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE"
```

Si aun así falla, revisa que Tailscale esté activo y que `THEHIVE_URL` use el esquema y el puerto correctos.

## Errores de TheHive que verás en los registros

| Situación | Mensaje |
|---|---|
| 401 / 403 | TheHive rechazó las credenciales (revisa THEHIVE_API_KEY y THEHIVE_ORG). |
| 400 | TheHive rechazó la consulta (HTTP 400): tipo y mensaje de TheHive. |
| Sin respuesta, red caída, 5xx | TheHive no responde. |
| Certificado no confiable | TheHive no es alcanzable: certificado no confiable. Si tu JDK no reconoce la cadena nueva de Let's Encrypt, arranca con Windows-ROOT o actualiza el JDK 21 (ver README). |

Nunca se registran cabeceras ni la key. El cuerpo de cada consulta solo aparece con el nivel `DEBUG`
(`logging.level.co.edu.escuelaing.dashboard.thehive=DEBUG`).

## Endpoints

| Ruta | Estado |
|---|---|
| `GET /api/dashboard/configuracion` | listo |
| `GET /api/dashboard/resumen` | listo (se calcula al pedirlo y se reutiliza 10 s; 503 si TheHive no responde, hasta el paso 6) |
| `GET /api/dashboard/alertas`, `/alertas/{id}` | pendientes (pasos siguientes) |

Toda la API es de solo `GET`; hay un test que falla si aparece otro método.
