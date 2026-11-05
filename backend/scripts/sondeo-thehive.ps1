<#
.SYNOPSIS
  Paso 0 del backend: sondeo de SOLO LECTURA contra TheHive para decidir qué consultas usará el backend.

.DESCRIPTION
  - Lee THEHIVE_URL, THEHIVE_API_KEY y (opcional) THEHIVE_ORG de variables de entorno. La key NUNCA se imprime.
  - Solo hace POST /api/v1/query con operaciones de lectura (lista cerrada, ver $OperacionesPermitidas).
    Cualquier otra operación hace que el script se detenga antes de enviar nada.
  - Solo imprime códigos HTTP, números, tiempos y tipos de error. No imprime alertas, IPs, usuarios ni descripciones.
    (Los nombres de herramientas, tipos, estados y etiquetas de regla sí aparecen; los que parecen IP, correo o
    dominio se ocultan.)
  - Funciona en Windows PowerShell 5.1 y en PowerShell 7.

.EXAMPLE
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  $env:THEHIVE_URL = "https://<servidor>:8445"
  $segura = Read-Host "THEHIVE_API_KEY" -AsSecureString
  $env:THEHIVE_API_KEY = [System.Net.NetworkCredential]::new("", $segura).Password
  .\scripts\sondeo-thehive.ps1 | Tee-Object -FilePath "$env:TEMP\sondeo-thehive.txt"
  Remove-Item Env:THEHIVE_API_KEY
#>
[CmdletBinding()]
param(
    [int]$TimeoutSegundos = 60,
    # IPs a comprobar en la sonda N (por ejemplo las del "Top IPs"). Nunca se imprimen: solo se numeran (IP 1, IP 2...).
    [string[]]$Ips = @()
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------------------------------------------
# Configuración (la key solo vive en esta variable; no se imprime ni se guarda)
# ---------------------------------------------------------------------------------------------------------------
$clave = $env:THEHIVE_API_KEY
$url = $env:THEHIVE_URL
$org = if ([string]::IsNullOrWhiteSpace($env:THEHIVE_ORG)) { "escuelaing" } else { $env:THEHIVE_ORG }

if ([string]::IsNullOrWhiteSpace($clave)) { Write-Host "Falta la variable de entorno THEHIVE_API_KEY."; exit 2 }
if ([string]::IsNullOrWhiteSpace($url)) { Write-Host "Falta la variable de entorno THEHIVE_URL."; exit 2 }
$url = $url.Trim().TrimEnd("/")

try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
[Net.ServicePointManager]::DefaultConnectionLimit = 16   # Windows PowerShell 5.1 limita a 2 conexiones por defecto
Add-Type -AssemblyName System.Net.Http
$http = New-Object System.Net.Http.HttpClient
$http.Timeout = [TimeSpan]::FromSeconds($TimeoutSegundos)

# Lista cerrada de operaciones de consulta (lectura). El sondeo se niega a enviar cualquier otra.
$OperacionesPermitidas = @("listAlert", "listCase", "listTask", "getAlert", "getCase", "tasks",
    "filter", "sort", "page", "count", "aggregation")

# ---------------------------------------------------------------------------------------------------------------
# Constructores de consultas
# ---------------------------------------------------------------------------------------------------------------
function Paso([string]$nombre, [hashtable]$propiedades) {
    $p = @{ _name = $nombre }
    if ($propiedades) { foreach ($k in $propiedades.Keys) { $p[$k] = $propiedades[$k] } }
    return $p
}
function Eq([string]$campo, $valor) { @{ _eq = @{ _field = $campo; _value = $valor } } }
function Ne([string]$campo, $valor) { @{ _ne = @{ _field = $campo; _value = $valor } } }
function Gte([string]$campo, $valor) { @{ _gte = @{ _field = $campo; _value = $valor } } }
function Lt([string]$campo, $valor) { @{ _lt = @{ _field = $campo; _value = $valor } } }
function Lte([string]$campo, $valor) { @{ _lte = @{ _field = $campo; _value = $valor } } }
function Entre([string]$campo, $desde, $hasta) { @{ _between = @{ _field = $campo; _from = $desde; _to = $hasta } } }
function Como([string]$campo, [string]$valor) { @{ _like = @{ _field = $campo; _value = $valor } } }
function Tiene([string]$campo) { @{ _has = $campo } }
function No($filtro) { @{ _not = $filtro } }
function Y([object[]]$filtros) { @{ _and = @($filtros) } }

# ---------------------------------------------------------------------------------------------------------------
# Envío (único punto que habla con TheHive)
# ---------------------------------------------------------------------------------------------------------------
function Nueva-Peticion([object[]]$operaciones) {
    foreach ($op in $operaciones) {
        if ($OperacionesPermitidas -notcontains $op._name) {
            throw "Operación no permitida en el sondeo (solo lectura): $($op._name)"
        }
    }
    $cuerpo = @{ query = @($operaciones) } | ConvertTo-Json -Depth 30 -Compress
    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$url/api/v1/query")
    $req.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $clave)
    $req.Headers.Add("X-Organisation", $org)
    # UTF-8 explícito: Content-Type: application/json; charset=utf-8
    $req.Content = [System.Net.Http.StringContent]::new($cuerpo, [System.Text.Encoding]::UTF8, "application/json")
    return $req
}

function Resumir-Respuesta($resp, $reloj) {
    $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $reloj.Stop()
    $tipoContenido = ""
    if ($resp.Content.Headers.ContentType) { $tipoContenido = $resp.Content.Headers.ContentType.ToString() }
    return [pscustomobject]@{
        Codigo        = [int]$resp.StatusCode
        Texto         = [System.Text.Encoding]::UTF8.GetString($bytes)   # TheHive no declara charset: siempre UTF-8
        Bytes         = $bytes.Length
        Ms            = [int]$reloj.ElapsedMilliseconds
        TipoContenido = $tipoContenido
    }
}

function Consulta([object[]]$operaciones) {
    $req = Nueva-Peticion $operaciones
    $reloj = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = $http.SendAsync($req).GetAwaiter().GetResult()
    } catch {
        $e = $_.Exception
        while ($e.InnerException) { $e = $e.InnerException }
        return [pscustomobject]@{ Codigo = 0; Texto = ""; Bytes = 0; Ms = [int]$reloj.ElapsedMilliseconds; TipoContenido = ""; ErrorRed = $e.GetType().Name }
    }
    return (Resumir-Respuesta $resp $reloj)
}

# Varias consultas a la vez (como hará el backend, con concurrencia limitada)
function Consultas-En-Paralelo([object[]]$listaDeOperaciones, [int]$concurrencia) {
    $reloj = [System.Diagnostics.Stopwatch]::StartNew()
    $codigos = New-Object System.Collections.Generic.List[int]
    for ($i = 0; $i -lt $listaDeOperaciones.Count; $i += $concurrencia) {
        $tareas = @()
        for ($j = $i; $j -lt [Math]::Min($i + $concurrencia, $listaDeOperaciones.Count); $j++) {
            $tareas += $http.SendAsync((Nueva-Peticion $listaDeOperaciones[$j]))
        }
        [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tareas)
        foreach ($t in $tareas) { $codigos.Add([int]$t.Result.StatusCode) }
    }
    $reloj.Stop()
    return [pscustomobject]@{ Ms = [int]$reloj.ElapsedMilliseconds; Codigos = $codigos }
}

# ---------------------------------------------------------------------------------------------------------------
# Utilidades de lectura de resultados (solo números y nombres de categorías)
# ---------------------------------------------------------------------------------------------------------------
function Es-Exito($r) { return ($r.Codigo -ge 200 -and $r.Codigo -lt 300) }

function Numero($r) {
    if ((Es-Exito $r) -and $r.Texto.Trim() -match '^-?\d+(\.\d+)?$') {
        return [double]::Parse($r.Texto.Trim(), [System.Globalization.CultureInfo]::InvariantCulture)
    }
    return $null
}

function Tipo-De-Error($r) {
    if ($r.PSObject.Properties["ErrorRed"]) { return "red:" + $r.ErrorRed }
    try { $o = $r.Texto | ConvertFrom-Json; if ($o.type) { return [string]$o.type } } catch { }
    return ""
}

function Fmt([double]$n) { return $n.ToString("0", [System.Globalization.CultureInfo]::InvariantCulture) }

function Texto-Resultado($r) {
    $n = Numero $r
    if ($null -ne $n) { return ((Fmt $n) + "   (" + $r.Ms + " ms)") }
    if (Es-Exito $r) { return ("HTTP " + $r.Codigo + " (no numérico)   (" + $r.Ms + " ms)") }
    return ("HTTP " + $r.Codigo + " " + (Tipo-De-Error $r))
}

function Clave-Segura($k) {
    $s = [string]$k
    if ($s -match '\d{1,3}(\.\d{1,3}){3}' -or $s -match '@' -or $s -match '(?i)[a-z0-9-]+\.(local|lan|com|net|org|edu|io)\b') { return "<oculto>" }
    return $s
}

# Respuesta de una agregación por campo: {"field_x":[{"_key":...,"count":...}, ..., {"_key":"_total",...}]}
function Buckets($r) {
    $o = $r.Texto | ConvertFrom-Json
    $prop = @($o.PSObject.Properties)[0]
    $salida = @()
    foreach ($b in @($prop.Value)) {
        $clavePropia = $b.PSObject.Properties["_key"]
        $cuenta = $b.PSObject.Properties["count"]
        $salida += [pscustomobject]@{
            Clave = $(if ($clavePropia) { Clave-Segura $clavePropia.Value } else { "?" })
            N     = $(if ($cuenta) { [double]$cuenta.Value } else { [double]::NaN })
        }
    }
    return $salida
}

function Linea([string]$texto) { Write-Host ("   " + $texto) }

$script:Abortar = $false
$S = [ordered]@{}   # resumen final (solo códigos y números)

function Sonda([string]$nombre, [scriptblock]$bloque) {
    if ($script:Abortar) { return }
    Write-Host ""
    Write-Host ("== " + $nombre)
    try { & $bloque } catch { Write-Host ("   ERROR inesperado en el sondeo: " + $_.Exception.GetType().Name) }
}

# Datos de referencia
$ahoraMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$SLA = @(@{ Sev = 4; Min = 15 }, @{ Sev = 3; Min = 30 }, @{ Sev = 2; Min = 120 }, @{ Sev = 1; Min = 240 })   # minutos: crítica, alta, media, baja
$SinSim = Ne "type" "simulacion"
# "Contención" escrita con un código de carácter: no depende de cómo lea este archivo cada versión de PowerShell
$grupoContencion = "Contenci" + [char]0x00F3 + "n"
function Contar-Alertas($filtro) {
    $ops = @(@{ _name = "listAlert" })
    if ($filtro) { $ops += (Paso "filter" $filtro) }
    $ops += @{ _name = "count" }
    return (Consulta $ops)
}

Write-Host "SONDEO DE TheHive (solo lectura) - $([DateTimeOffset]::UtcNow.ToString('yyyy-MM-dd HH:mm')) UTC"
Write-Host "PowerShell $($PSVersionTable.PSVersion)   Organización: $org   (la key no se imprime)"

# ===============================================================================================================
Sonda "A. Conexión, autenticación y codificación" {
    $r = Contar-Alertas $null
    $n = Numero $r
    if ($null -eq $n) {
        Linea ("FALLA: " + (Texto-Resultado $r))
        if ($r.Codigo -eq 401 -or $r.Codigo -eq 403) { Linea "La key o la organización no son válidas. Revisa THEHIVE_API_KEY y THEHIVE_ORG." }
        if ($r.Codigo -eq 0) { Linea "No hubo conexión (¿Tailscale activo? ¿certificado TLS válido?). No se continúa." }
        $script:Abortar = $true
        $S["A_conexion"] = "FALLA codigo=" + $r.Codigo + " " + (Tipo-De-Error $r)
        return
    }
    Linea ("Total de alertas: " + (Fmt $n) + "   (" + $r.Ms + " ms, HTTP " + $r.Codigo + ")")
    Linea ("Content-Type de la respuesta: " + $r.TipoContenido + $(if ($r.TipoContenido -match "charset") { "  (declara charset)" } else { "  (SIN charset: se decodifica siempre como UTF-8)" }))
    $S["A_total"] = Fmt $n
    $S["A_contentType"] = $r.TipoContenido
}

# ===============================================================================================================
Sonda "B. Simulaciones: ¿funciona excluir type = simulacion?" {
    $total = Numero (Contar-Alertas $null)
    $ne = Contar-Alertas (Ne "type" "simulacion")
    $eq = Contar-Alertas (Eq "type" "simulacion")
    $no = Contar-Alertas (No (Eq "type" "simulacion"))
    Linea ("_ne type simulacion        : " + (Texto-Resultado $ne))
    Linea ("_eq type simulacion        : " + (Texto-Resultado $eq))
    Linea ("_not(_eq type simulacion)  : " + (Texto-Resultado $no))
    $okNe = ($null -ne (Numero $ne)) -and ($null -ne (Numero $eq)) -and ((Numero $ne) + (Numero $eq) -eq $total)
    $okNo = ($null -ne (Numero $no)) -and ((Numero $no) -eq (Numero $ne))
    Linea ("¿_ne suma con _eq el total?: " + $(if ($okNe) { "SÍ" } else { "NO" }))
    Linea ("¿_not(_eq) == _ne?         : " + $(if ($okNo) { "SÍ" } else { "NO" }))
    $S["B_ne_simulacion"] = $(if ($okNe) { "OK" } else { "NO" })
    $S["B_not_eq"] = $(if ($okNo) { "OK" } else { "NO" })
    $S["B_sin_simulaciones"] = $(if ($null -ne (Numero $ne)) { Fmt (Numero $ne) } else { "?" })
    $S["B_simulaciones"] = $(if ($null -ne (Numero $eq)) { Fmt (Numero $eq) } else { "?" })

    $agg = Consulta @(@{ _name = "listAlert" }, (Paso "aggregation" @{ _agg = "field"; _field = "type"; _select = @(@{ _agg = "count" }) }))
    if (Es-Exito $agg) {
        Linea "Alertas por type:"
        foreach ($b in (Buckets $agg)) { Linea ("   {0,-24} {1}" -f $b.Clave, (Fmt $b.N)) }
    } else { Linea ("agregación por type: " + (Texto-Resultado $agg)) }
}

# ===============================================================================================================
Sonda "C. Alertas con caso (_has case) y estado Imported" {
    $tiene = Contar-Alertas (Tiene "case")
    $sin = Contar-Alertas (No (Tiene "case"))
    $imp = Contar-Alertas (Eq "status" "Imported")
    Linea ("_has case          : " + (Texto-Resultado $tiene))
    Linea ("_not(_has case)    : " + (Texto-Resultado $sin))
    Linea ("status = Imported  : " + (Texto-Resultado $imp))
    $S["C_has_case"] = $(if ($null -ne (Numero $tiene)) { "OK=" + (Fmt (Numero $tiene)) } else { "NO " + (Texto-Resultado $tiene) })
    $S["C_imported"] = $(if ($null -ne (Numero $imp)) { "OK=" + (Fmt (Numero $imp)) } else { "NO" })
}

# ===============================================================================================================
Sonda "D. Antigüedad promedio: ¿acepta TheHive avg sobre _createdAt?" {
    $soloNew = Paso "filter" (Y @((Eq "status" "New"), $SinSim))
    $formas = @(
        @{ n = "avg directo (_agg avg, _field _createdAt)"; op = (Paso "aggregation" @{ _agg = "avg"; _field = "_createdAt" }) },
        @{ n = "avg dentro de _select, agrupando por status"; op = (Paso "aggregation" @{ _agg = "field"; _field = "status"; _select = @(@{ _agg = "avg"; _field = "_createdAt" }) }) },
        @{ n = "min dentro de _select, agrupando por status (control)"; op = (Paso "aggregation" @{ _agg = "field"; _field = "status"; _select = @(@{ _agg = "min"; _field = "_createdAt" }) }) }
    )
    $i = 0
    foreach ($f in $formas) {
        $i++
        $r = Consulta @(@{ _name = "listAlert" }, $soloNew, $f.op)
        if (Es-Exito $r) {
            $texto = $r.Texto
            if ($texto.Length -gt 260) { $texto = $texto.Substring(0, 260) + "..." }
            Linea ("[" + $i + "] " + $f.n + ": HTTP " + $r.Codigo + " (" + $r.Ms + " ms)")
            Linea ("    respuesta: " + $texto)
            $numeros = [regex]::Matches($r.Texto, '\d+(\.\d+)?([eE][+-]?\d+)?') | ForEach-Object { [double]::Parse($_.Value, [System.Globalization.CultureInfo]::InvariantCulture) } | Where-Object { $_ -gt 1e11 }
            if ($numeros) {
                $v = @($numeros)[0]
                $edadDias = ($ahoraMs - $v) / 86400000
                Linea ("    -> valor " + (Fmt $v) + " ms epoch = antigüedad de " + $edadDias.ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture) + " días")
                $S["D_forma" + $i] = "OK antiguedadDias=" + $edadDias.ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture)
            } else { $S["D_forma" + $i] = "OK sin_numero_reconocible" }
        } else {
            Linea ("[" + $i + "] " + $f.n + ": HTTP " + $r.Codigo + " " + (Tipo-De-Error $r))
            $S["D_forma" + $i] = "NO " + $r.Codigo + " " + (Tipo-De-Error $r)
        }
    }
}

# ===============================================================================================================
Sonda "E. _between: ¿cuáles extremos son inclusivos? (con la alerta más antigua)" {
    $r = Consulta @(@{ _name = "listAlert" }, (Paso "sort" @{ _fields = @(@{ _createdAt = "asc" }) }), (Paso "page" @{ from = 0; to = 1 }))
    if (-not (Es-Exito $r)) { Linea ("no se pudo leer la más antigua: " + (Texto-Resultado $r)); return }
    $arr = @($r.Texto | ConvertFrom-Json)
    $t0 = [long]$arr[0]._createdAt
    $script:IdMasAntigua = [string]$arr[0]._id
    Linea ("Alerta más antigua creada el " + [DateTimeOffset]::FromUnixTimeMilliseconds($t0).ToString("yyyy-MM-dd HH:mm:ss") + " UTC  (" + $r.Ms + " ms)")
    $n = @{}
    $n.a = Numero (Contar-Alertas (Entre "_createdAt" $t0 $t0))
    $n.b = Numero (Contar-Alertas (Entre "_createdAt" ($t0 - 1) $t0))
    $n.c = Numero (Contar-Alertas (Entre "_createdAt" $t0 ($t0 + 1)))
    $n.d = Numero (Contar-Alertas (Y @((Gte "_createdAt" $t0), (Lt "_createdAt" ($t0 + 1)))))
    $n.e = Numero (Contar-Alertas (Y @((Gte "_createdAt" $t0), (Lte "_createdAt" $t0))))
    Linea ("_between [T0, T0]       : " + $n.a)
    Linea ("_between [T0-1, T0]     : " + $n.b)
    Linea ("_between [T0, T0+1]     : " + $n.c)
    Linea ("_gte T0 y _lt  T0+1     : " + $n.d + "   (control: alertas creadas exactamente en T0)")
    Linea ("_gte T0 y _lte T0       : " + $n.e)
    if ($null -ne $n.c -and $null -ne $n.d -and $null -ne $n.b) {
        $desdeIncl = ($n.c -ge $n.d -and $n.d -ge 1)
        $hastaIncl = ($n.b -ge 1)
        Linea ("=> _from inclusivo: " + $(if ($desdeIncl) { "SÍ" } else { "NO" }) + "   _to inclusivo: " + $(if ($hastaIncl) { "SÍ" } else { "NO" }))
        $S["E_between_from_inclusivo"] = $(if ($desdeIncl) { "SI" } else { "NO" })
        $S["E_between_to_inclusivo"] = $(if ($hastaIncl) { "SI" } else { "NO" })
    }
}

# ===============================================================================================================
Sonda "F. Alertas por día de Bogotá (_gte + _lt), con el filtro de simulaciones" {
    $bogota = [TimeSpan]::FromHours(-5)
    $hoyBog = $ahoraMs | ForEach-Object { [DateTimeOffset]::FromUnixTimeMilliseconds($_).ToOffset($bogota).Date }
    function Inicio-DiaBogota([DateTime]$dia) { return ([DateTimeOffset]::new($dia.Date, $bogota)).ToUnixTimeMilliseconds() }

    $dias = @(); $listas = @()
    for ($i = 6; $i -ge 0; $i--) {
        $d = $hoyBog.AddDays(-$i)
        $ini = Inicio-DiaBogota $d; $fin = Inicio-DiaBogota ($d.AddDays(1))
        $dias += $d
        $listas += , @(@{ _name = "listAlert" }, (Paso "filter" (Y @($SinSim, (Gte "_createdAt" $ini), (Lt "_createdAt" $fin)))), @{ _name = "count" })
    }
    $secuencial = [System.Diagnostics.Stopwatch]::StartNew()
    $suma = 0.0; $todoOk = $true
    for ($i = 0; $i -lt $dias.Count; $i++) {
        $r = Consulta $listas[$i]
        $n = Numero $r
        if ($null -eq $n) { $todoOk = $false; Linea ($dias[$i].ToString("yyyy-MM-dd") + ": " + (Texto-Resultado $r)); continue }
        $suma += $n
        Linea ($dias[$i].ToString("yyyy-MM-dd") + "  " + (Fmt $n))
    }
    $secuencial.Stop()
    $inicioVentana = Inicio-DiaBogota $dias[0]
    $ventana = Numero (Contar-Alertas (Y @($SinSim, (Gte "_createdAt" $inicioVentana))))
    Linea ("Suma de los 7 días: " + (Fmt $suma) + "   |   conteo directo de la ventana: " + $(if ($null -ne $ventana) { Fmt $ventana } else { "?" }) + "   ->  " + $(if ($todoOk -and $null -ne $ventana -and $suma -eq $ventana) { "COINCIDEN" } else { "NO COINCIDEN (o falló alguna)" }))
    Linea ("7 consultas una tras otra: " + $secuencial.ElapsedMilliseconds + " ms")
    $par = Consultas-En-Paralelo $listas 4
    Linea ("7 consultas con concurrencia 4: " + $par.Ms + " ms   (códigos: " + (($par.Codigos | Select-Object -Unique) -join ",") + ")")
    $S["F_suma_dias_coincide"] = $(if ($todoOk -and $null -ne $ventana -and $suma -eq $ventana) { "SI" } else { "NO" })
    $S["F_7_dias_secuencial_ms"] = $secuencial.ElapsedMilliseconds
    $S["F_7_dias_paralelo4_ms"] = $par.Ms
}

# ===============================================================================================================
Sonda "G. Cifras del resumen (con el filtro de simulaciones) y fuera de SLA" {
    $r1 = Contar-Alertas $SinSim
    $r2 = Contar-Alertas (Y @($SinSim, (Eq "status" "New")))
    $r3 = Contar-Alertas (Y @($SinSim, (Gte "severity" 3)))
    Linea ("recibidas        : " + (Texto-Resultado $r1))
    Linea ("sin atender      : " + (Texto-Resultado $r2))
    Linea ("críticas y altas : " + (Texto-Resultado $r3))
    $S["G_recibidas"] = $(if ($null -ne (Numero $r1)) { Fmt (Numero $r1) } else { "?" })
    $S["G_sin_atender"] = $(if ($null -ne (Numero $r2)) { Fmt (Numero $r2) } else { "?" })
    $S["G_criticas_y_altas"] = $(if ($null -ne (Numero $r3)) { Fmt (Numero $r3) } else { "?" })

    $ahora = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $listas = @(); $etiquetas = @()
    foreach ($nivel in $SLA) {
        $limite = $ahora - ($nivel.Min * 60000)
        $listas += , @(@{ _name = "listAlert" }, (Paso "filter" (Y @($SinSim, (Eq "status" "New"), (Eq "severity" $nivel.Sev), (Lt "_createdAt" $limite)))), @{ _name = "count" })
        $etiquetas += ("severidad {0} (SLA {1} min)" -f $nivel.Sev, $nivel.Min)
    }
    $par = Consultas-En-Paralelo $listas 4
    Linea ("fuera de SLA, 4 count en paralelo: " + $par.Ms + " ms")
    for ($i = 0; $i -lt $listas.Count; $i++) {
        $r = Consulta $listas[$i]
        Linea ("   " + $etiquetas[$i] + ": " + (Texto-Resultado $r))
        $S["G_fuera_sla_sev" + $SLA[$i].Sev] = $(if ($null -ne (Numero $r)) { Fmt (Numero $r) } else { "?" })
    }
    $S["G_fuera_sla_4_paralelo_ms"] = $par.Ms
}

# ===============================================================================================================
Sonda "H. Alerta más antigua sin atender (sort asc + page 0-1) y getAlert" {
    $r = Consulta @(@{ _name = "listAlert" }, (Paso "filter" (Y @($SinSim, (Eq "status" "New")))), (Paso "sort" @{ _fields = @(@{ _createdAt = "asc" }) }), (Paso "page" @{ from = 0; to = 1 }))
    if (Es-Exito $r) {
        $a = @($r.Texto | ConvertFrom-Json)[0]
        $edad = ($ahoraMs - [long]$a._createdAt) / 86400000
        Linea ("la más antigua sin atender: antigüedad " + $edad.ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture) + " días   (" + $r.Ms + " ms)")
        $S["H_mas_antigua_dias"] = $edad.ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture)
    } else { Linea (Texto-Resultado $r) }

    if ($script:IdMasAntigua) {
        $g = Consulta @(@{ _name = "getAlert"; idOrName = $script:IdMasAntigua })
        Linea ("getAlert de una alerta existente: HTTP " + $g.Codigo + "   (" + $g.Ms + " ms, " + [Math]::Round($g.Bytes / 1024.0, 1) + " KB)")
        $S["H_getAlert_existente"] = "HTTP " + $g.Codigo
    }
    $g0 = Consulta @(@{ _name = "getAlert"; idOrName = "~0" })
    Linea ("getAlert de una alerta que NO existe (~0): HTTP " + $g0.Codigo + " " + (Tipo-De-Error $g0))
    $S["H_getAlert_inexistente"] = "HTTP " + $g0.Codigo + " " + (Tipo-De-Error $g0)
    $c0 = Consulta @(@{ _name = "getCase"; idOrName = "~0" })
    Linea ("getCase  de un caso   que NO existe (~0): HTTP " + $c0.Codigo + " " + (Tipo-De-Error $c0))
    $S["H_getCase_inexistente"] = "HTTP " + $c0.Codigo + " " + (Tipo-De-Error $c0)
}

# ===============================================================================================================
Sonda "I. Etiquetas: agregación por tags (tipo de amenaza por regla) y _size" {
    function Agg-Tags($filtro, $size) {
        $ops = @(@{ _name = "listAlert" })
        if ($filtro) { $ops += (Paso "filter" $filtro) }
        $agg = @{ _agg = "field"; _field = "tags"; _select = @(@{ _agg = "count" }) }
        if ($size) { $agg["_size"] = $size }
        $ops += (Paso "aggregation" $agg)
        return (Consulta $ops)
    }
    $defecto = Agg-Tags $SinSim $null
    $cinco = Agg-Tags $SinSim 5
    $grande = Agg-Tags $SinSim 500
    foreach ($par in @(@("sin _size", $defecto), @("_size 5", $cinco), @("_size 500", $grande))) {
        if (Es-Exito $par[1]) {
            $b = @(Buckets $par[1])
            Linea ("tags " + $par[0].PadRight(9) + ": " + $b.Count + " elementos (incluye _total)   (" + $par[1].Ms + " ms, " + [Math]::Round($par[1].Bytes / 1024.0, 1) + " KB)")
        } else { Linea ("tags " + $par[0] + ": " + (Texto-Resultado $par[1])) }
    }
    $S["I_tags_size_5_elementos"] = $(if (Es-Exito $cinco) { @(Buckets $cinco).Count } else { "NO" })
    $S["I_tags_size_500_elementos"] = $(if (Es-Exito $grande) { @(Buckets $grande).Count } else { "NO" })

    $sinEsc = Agg-Tags (Y @($SinSim, (No (Como "tags" "escenario:*")))) 500
    $conEsc = Agg-Tags (Y @($SinSim, (Como "tags" "escenario:*"))) 500
    if (Es-Exito $sinEsc) {
        $b = @(Buckets $sinEsc)
        $reglas = @($b | Where-Object { $_.Clave -like "regla:*" })
        Linea ("Sin etiqueta escenario: (_not + _like): OK, " + $reglas.Count + " reglas distintas (R)")
        Linea "   las 8 reglas más frecuentes:"
        foreach ($x in ($reglas | Sort-Object N -Descending | Select-Object -First 8)) { Linea ("      {0,-14} {1}" -f $x.Clave, (Fmt $x.N)) }
        $S["I_not_like_escenario"] = "OK reglas_distintas=" + $reglas.Count
    } else {
        Linea ("Sin etiqueta escenario: (_not + _like): " + (Texto-Resultado $sinEsc))
        $S["I_not_like_escenario"] = "NO " + $sinEsc.Codigo + " " + (Tipo-De-Error $sinEsc)
    }
    if (Es-Exito $conEsc) {
        $b = @(Buckets $conEsc | Where-Object { $_.Clave -like "escenario:*" })
        Linea ("Con etiqueta escenario: OK, " + $b.Count + " tipos distintos")
        $S["I_escenario_tipos"] = $b.Count
    } else { Linea ("Con etiqueta escenario: " + (Texto-Resultado $conEsc)) }

    $rt = Contar-Alertas (Y @($SinSim, (Como "tags" "regla:*")))
    Linea ("alertas con alguna etiqueta regla:* : " + (Texto-Resultado $rt))
    $S["I_alertas_con_regla"] = $(if ($null -ne (Numero $rt)) { Fmt (Numero $rt) } else { "?" })
}

# ===============================================================================================================
Sonda "J. Páginas de alertas: tamaño máximo, tiempos y offset profundo" {
    function Pagina($desde, $hasta) {
        return (Consulta @(@{ _name = "listAlert" }, (Paso "filter" $SinSim), (Paso "sort" @{ _fields = @(@{ _createdAt = "desc" }) }), (Paso "page" @{ from = $desde; to = $hasta })))
    }
    function Contar-Items($r) { return ([regex]::Matches($r.Texto, '"_id"\s*:\s*"~')).Count }
    foreach ($p in @(@(0, 50), @(0, 500), @(0, 1000), @(500, 1000))) {
        $r = Pagina $p[0] $p[1]
        if (Es-Exito $r) {
            Linea ("página " + $p[0] + ".." + $p[1] + ": HTTP " + $r.Codigo + ", ~" + (Contar-Items $r) + " alertas, " + [Math]::Round($r.Bytes / 1024.0) + " KB, " + $r.Ms + " ms")
            $S["J_pagina_" + $p[0] + "_" + $p[1]] = "OK items=" + (Contar-Items $r) + " ms=" + $r.Ms + " KB=" + [Math]::Round($r.Bytes / 1024.0)
        } else {
            Linea ("página " + $p[0] + ".." + $p[1] + ": " + (Texto-Resultado $r))
            $S["J_pagina_" + $p[0] + "_" + $p[1]] = "NO " + $r.Codigo + " " + (Tipo-De-Error $r)
        }
    }
    $total = Numero (Contar-Alertas $SinSim)
    if ($total -gt 20500) {
        $r = Pagina 20000 20500
        Linea ("offset profundo 20000..20500: HTTP " + $r.Codigo + ", ~" + (Contar-Items $r) + " alertas, " + $r.Ms + " ms")
        $S["J_offset_profundo_ms"] = $r.Ms
    } else { Linea "offset profundo: omitido (hay menos de 20.500 alertas)" }
    # dos páginas de 500 a la vez (la lista del backend)
    $dos = Consultas-En-Paralelo @(
        @(@{ _name = "listAlert" }, (Paso "filter" $SinSim), (Paso "sort" @{ _fields = @(@{ _createdAt = "desc" }) }), (Paso "page" @{ from = 0; to = 500 })),
        @(@{ _name = "listAlert" }, (Paso "filter" $SinSim), (Paso "sort" @{ _fields = @(@{ _createdAt = "desc" }) }), (Paso "page" @{ from = 500; to = 1000 }))) 2
    Linea ("2 páginas de 500 en paralelo: " + $dos.Ms + " ms (códigos " + (($dos.Codigos | Select-Object -Unique) -join ",") + ")")
    $S["J_2_paginas_paralelo_ms"] = $dos.Ms
}

# ===============================================================================================================
Sonda "K. Casos y tareas (hoy deberían dar 0)" {
    $c1 = Consulta @(@{ _name = "listCase" }, @{ _name = "count" })
    Linea ("listCase count                       : " + (Texto-Resultado $c1))
    $S["K_casos_total"] = $(if ($null -ne (Numero $c1)) { Fmt (Numero $c1) } else { "NO " + $c1.Codigo + " " + (Tipo-De-Error $c1) })

    $porStage = Consulta @(@{ _name = "listCase" }, (Paso "aggregation" @{ _agg = "field"; _field = "stage"; _select = @(@{ _agg = "count" }) }))
    Linea ("listCase agregación por stage        : HTTP " + $porStage.Codigo + " " + $(if (Es-Exito $porStage) { "respuesta: " + $porStage.Texto.Substring(0, [Math]::Min(160, $porStage.Texto.Length)) } else { Tipo-De-Error $porStage }))
    $S["K_agg_stage"] = $(if (Es-Exito $porStage) { "OK" } else { "NO " + $porStage.Codigo + " " + (Tipo-De-Error $porStage) })

    $cierre = Consulta @(@{ _name = "listCase" }, (Paso "filter" (Y @((Eq "stage" "Closed"), (Eq "status" "TruePositive")))), @{ _name = "count" })
    Linea ("listCase stage=Closed y status=TruePositive: " + (Texto-Resultado $cierre))
    $S["K_filtro_closed_truepositive"] = $(if ($null -ne (Numero $cierre)) { "OK=" + (Fmt (Numero $cierre)) } else { "NO " + $cierre.Codigo + " " + (Tipo-De-Error $cierre) })

    $dur = Consulta @(@{ _name = "listCase" }, (Paso "filter" (Eq "stage" "Closed")), (Paso "aggregation" @{ _agg = "avg"; _field = "computed.handlingDuration" }))
    Linea ("listCase avg computed.handlingDuration : HTTP " + $dur.Codigo + " " + $(if (Es-Exito $dur) { "(acepta la consulta)" } else { Tipo-De-Error $dur }))
    $S["K_avg_handlingDuration"] = $(if (Es-Exito $dur) { "OK" } else { "NO " + $dur.Codigo + " " + (Tipo-De-Error $dur) })

    $t1 = Consulta @(@{ _name = "listTask" }, @{ _name = "count" })
    Linea ("listTask count                       : " + (Texto-Resultado $t1))
    $t2 = Consulta @(@{ _name = "listTask" }, (Paso "filter" (Y @((Eq "group" $grupoContencion), (Eq "status" "Completed")))), @{ _name = "count" })
    Linea ("listTask grupo=Contención (UTF-8) y Completed: " + (Texto-Resultado $t2))
    $S["K_tareas_total"] = $(if ($null -ne (Numero $t1)) { Fmt (Numero $t1) } else { "NO " + $t1.Codigo + " " + (Tipo-De-Error $t1) })
    $S["K_filtro_contencion_completadas"] = $(if ($null -ne (Numero $t2)) { "OK=" + (Fmt (Numero $t2)) } else { "NO " + $t2.Codigo + " " + (Tipo-De-Error $t2) })
}

# ===============================================================================================================
Sonda "L. SLA nativo de TheHive (slaStates.status) - opcional" {
    $r = Consulta @(@{ _name = "listAlert" }, (Paso "aggregation" @{ _agg = "field"; _field = "slaStates.status"; _select = @(@{ _agg = "count" }) }))
    if (Es-Exito $r) {
        Linea "alertas por slaStates.status:"
        foreach ($b in (Buckets $r)) { Linea ("   {0,-20} {1}" -f $b.Clave, (Fmt $b.N)) }
        $S["L_sla_nativo"] = "OK"
    } else {
        Linea (Texto-Resultado $r)
        $S["L_sla_nativo"] = "NO " + $r.Codigo + " " + (Tipo-De-Error $r)
    }
}

# ===============================================================================================================
Sonda "N. Top IPs: ¿hay alertas duplicadas? (solo números; las IPs no se imprimen)" {
    $conWazuh = Y @($SinSim, (Eq "type" "wazuh"))
    $total = Contar-Alertas $conWazuh
    Linea ("alertas type=wazuh (todas)                : " + (Texto-Resultado $total))
    $S["N_wazuh_total"] = $(if ($null -ne (Numero $total)) { Fmt (Numero $total) } else { "?" })

    # Duplicados por sourceRef: si una misma sourceRef aparece más de una vez, TheHive guarda alertas repetidas.
    $aggRef = Consulta @(@{ _name = "listAlert" }, (Paso "filter" $conWazuh),
        (Paso "aggregation" @{ _agg = "field"; _field = "sourceRef"; _select = @(@{ _agg = "count" }); _size = 500 }))
    if (Es-Exito $aggRef) {
        $b = @(Buckets $aggRef | Where-Object { $_.Clave -ne "_total" })
        $max = ($b | Measure-Object N -Maximum).Maximum
        $rep = @($b | Where-Object { $_.N -gt 1 }).Count
        Linea ("sourceRef: $($b.Count) valores revisados (tope 500), el que más se repite aparece $(Fmt $max) vez/veces, $rep repetidos")
        $S["N_sourceRef_max_repeticion"] = Fmt $max
    } else { Linea ("sourceRef: " + (Texto-Resultado $aggRef)) }

    $validas = @($Ips | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' })
    if ($validas.Count -eq 0) {
        Linea "Sin IPs: ejecuta el sondeo con -Ips '1.2.3.4','1.2.3.5' para contar las alertas de cada IP."
    }
    $i = 0
    foreach ($ip in $validas) {
        $i++
        $filtroIp = Como "description" ('*"' + $ip + '"*')
        $n = Contar-Alertas (Y @($conWazuh, $filtroIp))
        Linea ("IP $i : alertas cuya descripcion la contiene : " + (Texto-Resultado $n))
        $S["N_ip_$i"] = $(if ($null -ne (Numero $n)) { Fmt (Numero $n) } else { "?" })
        $agg = Consulta @(@{ _name = "listAlert" }, (Paso "filter" (Y @($conWazuh, $filtroIp))),
            (Paso "aggregation" @{ _agg = "field"; _field = "sourceRef"; _select = @(@{ _agg = "count" }); _size = 500 }))
        if (Es-Exito $agg) {
            $bb = @(Buckets $agg | Where-Object { $_.Clave -ne "_total" })
            $mx = ($bb | Measure-Object N -Maximum).Maximum
            Linea ("IP $i : sourceRef distintas (tope 500)         : $($bb.Count), maximo de repeticiones $(Fmt $mx)")
        }
    }
    # Alertas que mencionan a la vez dos de las IPs: si fueran muchas, una misma alerta se contaria para ambas.
    for ($a = 0; $a -lt $validas.Count; $a++) {
        for ($c = $a + 1; $c -lt $validas.Count; $c++) {
            $juntas = Contar-Alertas (Y @($conWazuh, (Como "description" ('*"' + $validas[$a] + '"*')), (Como "description" ('*"' + $validas[$c] + '"*'))))
            Linea ("alertas que contienen a la vez IP $($a + 1) e IP $($c + 1) : " + (Texto-Resultado $juntas))
        }
    }
}

# ===============================================================================================================
Sonda "M. Operaciones de escritura: el sondeo las rechaza antes de enviar" {
    try {
        [void](Nueva-Peticion @(@{ _name = "deleteAlert" }))
        Linea "FALLA: se aceptó una operación que no es de lectura."
        $S["M_solo_lectura"] = "FALLA"
    } catch {
        Linea "OK: una operación fuera de la lista se rechaza localmente, sin tocar la red."
        $S["M_solo_lectura"] = "OK"
    }
}

# ---------------------------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "================ RESUMEN PARA PEGAR (solo códigos y números) ================"
foreach ($k in $S.Keys) { Write-Host ("{0} = {1}" -f $k, $S[$k]) }
Write-Host "============================================================================="
if ($script:Abortar) { exit 1 }
