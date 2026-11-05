<#
.SYNOPSIS
    Levanta el dashboard completo para la presentación: backend (Spring Boot) y frontend (Vite) en dos ventanas, y abre
    el navegador cuando el backend ya responde.

.DESCRIPTION
    Pide lo necesario por pantalla:
      - La API key de TheHive, con Read-Host -AsSecureString: no se muestra al escribirla, no se guarda en ningún
        archivo y no queda en el historial de PowerShell.
      - La URL de TheHive (se toma de la variable de entorno THEHIVE_URL si ya está definida; si no, se pregunta).
        La URL NUNCA está escrita en este script.
      - La organización (por defecto la de THEHIVE_ORG, o "escuelaing").

    El backend arranca con el almacén de certificados de Windows (Windows-ROOT) por si el JDK no reconoce la cadena de
    certificados de TheHive. La validación TLS NO se desactiva. El frontend arranca con VITE_USE_MOCK=false y
    VITE_API_URL=http://127.0.0.1:<puerto>, así que lee datos reales del backend.

    La key viaja solo en las variables de entorno del proceso del backend (no como argumento de ningún comando, que se
    vería en la lista de procesos). El frontend se lanza ANTES y sin ninguna variable de TheHive, y al terminar este script
    borra la key de su propio entorno.

.PARAMETER Organizacion
    Organización de TheHive (X-Organisation). Si no se indica: THEHIVE_ORG, y si tampoco está, se pregunta ("escuelaing").

.PARAMETER PuertoBackend
    Puerto del backend. Por defecto 8080.

.PARAMETER PuertoFrontend
    Puerto del frontend. Por defecto 5173 (el origen que el backend permite por CORS).

.PARAMETER EsperaMaxSegundos
    Cuánto espera a que el backend responda antes de rendirse. Por defecto 240 (la primera compilación de Maven tarda).

.PARAMETER NoAbrirNavegador
    No abre el navegador al final.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\backend\scripts\iniciar-demo.ps1

.NOTES
    Para detener todo, cierra las dos ventanas ("Backend SOC" y "Frontend SOC").
#>
[CmdletBinding()]
param(
    [string]$Organizacion,
    [int]$PuertoBackend = 8080,
    [int]$PuertoFrontend = 5173,
    [int]$EsperaMaxSegundos = 240,
    [switch]$NoAbrirNavegador
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Escribir-Paso([string]$texto) { Write-Host ("`n== " + $texto) -ForegroundColor Cyan }
function Escribir-Ok([string]$texto) { Write-Host ("   OK  " + $texto) -ForegroundColor Green }

# Variables que este script pone en SU entorno (para que las hereden las ventanas que lanza) y que borra al terminar.
$variablesTemporales = @('THEHIVE_API_KEY', 'THEHIVE_URL', 'THEHIVE_ORG', 'JAVA_TOOL_OPTIONS', 'SERVER_PORT', 'SERVER_ADDRESS',
    'DASHBOARD_ORIGINS', 'VITE_USE_MOCK', 'VITE_API_URL')

function Abrir-Ventana([string]$titulo, [string]$carpeta, [string]$comando) {
    # -EncodedCommand evita problemas de comillas. El comando no lleva ningún secreto.
    $cuerpo = "`$Host.UI.RawUI.WindowTitle = '$titulo'; $comando"
    $codificado = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cuerpo))
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $carpeta -ArgumentList @('-NoExit', '-NoProfile', '-EncodedCommand', $codificado) | Out-Null
}

function Esperar-Respuesta([string]$url, [int]$segundos) {
    $limite = (Get-Date).AddSeconds($segundos)
    while ((Get-Date) -lt $limite) {
        try {
            $respuesta = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
            if ($respuesta.StatusCode -eq 200) { return $true }
        } catch {
            # todavía no responde
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

try {
    $raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $carpetaBackend = Join-Path $raiz 'backend'
    $carpetaFrontend = Join-Path $raiz 'frontend'

    # ------------------------------------------------------------------------------------------------------------
    Escribir-Paso 'Comprobando requisitos'
    if (-not (Test-Path (Join-Path $carpetaBackend 'mvnw.cmd'))) { throw "No se encontro backend\mvnw.cmd en $raiz" }
    if (-not (Test-Path (Join-Path $carpetaFrontend 'package.json'))) { throw "No se encontro frontend\package.json en $raiz" }
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'No se encontro Java en el PATH. Instala el JDK 21.' }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        $nodo = Join-Path $env:ProgramFiles 'nodejs'
        if (Test-Path (Join-Path $nodo 'npm.cmd')) { $env:Path = "$nodo;$env:Path" }
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'No se encontro npm en el PATH. Instala Node.js.' }
    Escribir-Ok 'Java, Maven Wrapper y npm disponibles'

    # ------------------------------------------------------------------------------------------------------------
    Escribir-Paso 'Comprobando que los puertos esten libres'
    $ocupados = @()
    foreach ($par in @(@('backend', $PuertoBackend), @('frontend', $PuertoFrontend))) {
        $conexiones = @(Get-NetTCPConnection -State Listen -LocalPort $par[1] -ErrorAction SilentlyContinue)
        foreach ($pidDueno in ($conexiones | Select-Object -ExpandProperty OwningProcess -Unique)) {
            $proceso = Get-Process -Id $pidDueno -ErrorAction SilentlyContinue
            $nombreProceso = if ($proceso) { $proceso.ProcessName } else { 'desconocido' }
            $ocupados += "Puerto $($par[1]) ($($par[0])) en uso por el proceso '$nombreProceso' (PID $pidDueno)."
        }
    }
    if ($ocupados.Count -gt 0) {
        $ocupados | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
        throw 'Hay puertos ocupados. No se ha cerrado ningun proceso: cierralo tu (por ejemplo, la ventana anterior "Backend SOC" o "Frontend SOC") y vuelve a ejecutar el script.'
    }
    Escribir-Ok "Puertos $PuertoBackend y $PuertoFrontend libres"

    # ------------------------------------------------------------------------------------------------------------
    Escribir-Paso 'Datos de TheHive'
    $url = $env:THEHIVE_URL
    if ([string]::IsNullOrWhiteSpace($url)) {
        $url = Read-Host 'URL de TheHive (por ejemplo https://servidor:puerto)'
    } else {
        Escribir-Ok 'URL de TheHive tomada de la variable de entorno THEHIVE_URL'
    }
    $url = "$url".Trim()
    if ($url -notmatch '^https?://[^\s/]+') { throw 'La URL de TheHive debe empezar por https:// (o http://) y llevar el servidor.' }

    $org = $Organizacion
    if ([string]::IsNullOrWhiteSpace($org)) { $org = $env:THEHIVE_ORG }
    if ([string]::IsNullOrWhiteSpace($org)) {
        $org = Read-Host 'Organizacion de TheHive [escuelaing]'
        if ([string]::IsNullOrWhiteSpace($org)) { $org = 'escuelaing' }
    }
    $org = $org.Trim()

    $segura = Read-Host 'API key de TheHive (no se muestra ni se guarda)' -AsSecureString
    if ($segura.Length -eq 0) { throw 'La API key no puede estar vacia.' }

    # ------------------------------------------------------------------------------------------------------------
    Escribir-Paso "Iniciando el frontend (puerto $PuertoFrontend, datos reales)"
    # El frontend se lanza primero y SIN variables de TheHive: no hereda la key.
    $env:VITE_USE_MOCK = 'false'
    $env:VITE_API_URL = "http://127.0.0.1:$PuertoBackend"
    $comandoFrontend = "if (-not (Test-Path node_modules)) { npm install }; npm run dev -- --host localhost --port $PuertoFrontend --strictPort"
    Abrir-Ventana 'Frontend SOC' $carpetaFrontend $comandoFrontend
    Remove-Item Env:VITE_USE_MOCK, Env:VITE_API_URL -ErrorAction SilentlyContinue
    Escribir-Ok 'Ventana "Frontend SOC" abierta'

    # ------------------------------------------------------------------------------------------------------------
    Escribir-Paso "Iniciando el backend (puerto $PuertoBackend)"
    $env:THEHIVE_URL = $url
    $env:THEHIVE_ORG = $org
    $env:SERVER_ADDRESS = '127.0.0.1'
    $env:SERVER_PORT = "$PuertoBackend"
    $env:DASHBOARD_ORIGINS = "http://localhost:$PuertoFrontend"
    # Almacen de certificados de Windows para Java (Maven y la aplicacion). La validacion TLS sigue activa.
    $env:JAVA_TOOL_OPTIONS = '-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE'

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
    try {
        $env:THEHIVE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        $segura.Dispose()
    }

    Abrir-Ventana 'Backend SOC' $carpetaBackend '.\mvnw.cmd spring-boot:run'

    # La ventana del backend ya heredo su entorno: se borra el de este script cuanto antes.
    foreach ($nombre in $variablesTemporales) { Remove-Item -Path "Env:$nombre" -ErrorAction SilentlyContinue }
    Escribir-Ok 'Ventana "Backend SOC" abierta (la key solo existe en el entorno de esa ventana)'

    # ------------------------------------------------------------------------------------------------------------
    Escribir-Paso 'Esperando a que el backend responda (la primera vez Maven descarga y compila)'
    $urlConfiguracion = "http://127.0.0.1:$PuertoBackend/api/dashboard/configuracion"
    if (-not (Esperar-Respuesta $urlConfiguracion $EsperaMaxSegundos)) {
        throw "El backend no respondio en $EsperaMaxSegundos s. Revisa la ventana 'Backend SOC': suele ser la key, la URL o que Tailscale este apagado."
    }
    Escribir-Ok 'Backend listo'

    if (-not (Esperar-Respuesta "http://localhost:$PuertoFrontend" 60)) {
        Write-Host '   Aviso: el frontend aun no responde; revisa la ventana "Frontend SOC".' -ForegroundColor Yellow
    }

    if (-not $NoAbrirNavegador) {
        Start-Process "http://localhost:$PuertoFrontend"
        Escribir-Ok "Navegador abierto en http://localhost:$PuertoFrontend"
    }

    Write-Host "`nListo. Las metricas de Wazuh pueden tardar un par de minutos en aparecer (carga inicial en segundo plano)." -ForegroundColor Green
    Write-Host 'Para detener todo, cierra las ventanas "Backend SOC" y "Frontend SOC".'
} finally {
    # Pase lo que pase, ni la key ni nada de TheHive se queda en el entorno de esta ventana.
    foreach ($nombre in $variablesTemporales) { Remove-Item -Path "Env:$nombre" -ErrorAction SilentlyContinue }
    $segura = $null
}
