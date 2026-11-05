#!/usr/bin/env python3
"""
Anonimiza alertas REALES de TheHive para usarlas como fixtures de las pruebas del backend.

Uso (desde la raíz del repo o desde backend/):

    python backend/scripts/anonimizar-fixtures.py "C:\\ruta\\fuera\\del\\repo\\alertas.json"

- Lee el original que le pasas por argumento (un arreglo JSON de alertas, tal como lo devuelve TheHive).
  El original DEBE estar fuera del repositorio: el script se niega a leerlo si está dentro.
- Escribe SOLO el resultado anonimizado en backend/src/test/resources/thehive/alertas.json
  (unas 15 alertas representativas). Nunca copia ni escribe el original.
- No imprime valores de las alertas: solo conteos. Si algo sensible sobrevive, borra la salida y termina con error.

Qué se anonimiza (en todos los textos: título, descripción, bloque ```json, tags, sourceRef, extra_data, mensajes de
Windows, ubicación...):
  IPv4 e IPv6 -> rangos de documentación (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32)
  correos -> usuario-NN@example.test        MAC -> 02:00:00:00:00:NN
  SID de dominio (S-1-5-21-...) -> SID ficticio       logonGuid -> GUID ficticio
  usuarios, dominios y equipos (srcuser, dstuser, targetUserName, subjectUserName, agente.name, computer,
  "Account Name:" de los mensajes, etc.) -> usuario-NN / DOMINIO-NN / equipo-NN, de forma consistente en TODO el texto
  _id -> ids ficticios        _createdBy / _updatedBy -> sistema@example.test

Se conservan: cuentas genéricas (root, SYSTEM, NT AUTHORITY...), reglas y tácticas MITRE, severidades, estados, fechas
y la herramienta de origen (campo source).

Solo usa la biblioteca estándar de Python 3.
"""
import argparse
import ipaddress
import json
import re
import sys
from pathlib import Path

RAIZ_REPO = Path(__file__).resolve().parents[2]
SALIDA = RAIZ_REPO / "backend" / "src" / "test" / "resources" / "thehive" / "alertas.json"

# Se arman por partes para que este archivo no contenga el dominio interno de TheHive.
DOMINIOS_INTERNOS = ["ts" + ".net", "tail2ab" + "6e9"]

REDES_DOC_V4 = [ipaddress.ip_network(n) for n in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24")]
RED_DOC_V6 = ipaddress.ip_network("2001:db8::/32")

# Cuentas y nombres genéricos que NO identifican a nadie: se conservan.
GENERICOS = {
    "", "-", "n/a", "root", "system", "administrator", "local service", "network service", "nt authority",
    "nt service", "anonymous logon", "window manager", "font driver host", "workgroup", "builtin",
    "localservice", "networkservice", "nobody",
}
GENERICOS_RE = re.compile(r"^(dwm|umfd)-\d+$", re.I)
# Palabras comunes: si un usuario se llamara así no se reemplazan en el texto libre (solo en el campo exacto).
PALABRAS_COMUNES = {"user", "users", "service", "windows", "security", "account", "logon", "login", "audit", "test", "guest",
                    "admin", "administrador", "mode", "restricted", "network", "local", "default", "domain"}
# "en el host WIN-LAB01": nombres de equipo que solo aparecen en texto libre (título/descripción).
RE_EQUIPO_EN_TEXTO = re.compile(r"\b(?:host|equipo|servidor|máquina)\s+([A-Z][A-Z0-9_-]{2,})\b")

# Valores que no se tocan (enumeraciones del dominio).
CLAVES_SIN_TOCAR = {"_type", "status", "stage", "type", "source", "severityLabel", "tlpLabel", "papLabel"}

CLAVES_USUARIO = {"srcuser", "dstuser", "targetusername", "subjectusername", "user", "username", "logonaccount"}
CLAVES_DOMINIO = {"targetdomainname", "subjectdomainname", "domain"}
CLAVES_EQUIPO = {"computer", "workstationname", "hostname", "computername", "sourcehost"}

ETIQUETAS_MENSAJE = {
    "account name": "usuario", "nombre de cuenta": "usuario", "logon account": "usuario",
    "account domain": "dominio", "dominio de cuenta": "dominio",
    "workstation name": "equipo", "nombre de estación de trabajo": "equipo", "computer name": "equipo",
    "source workstation": "equipo", "client name": "equipo",
}
RE_MENSAJE = re.compile(
    r"(" + "|".join(re.escape(k) for k in ETIQUETAS_MENSAJE) + r")\s*:\s*([^\r\n\t]+)", re.I)

# Nombres de equipo con forma típica (instalaciones por defecto de Windows / AWS) que aparecen sueltos en cualquier texto.
RE_EQUIPO_TIPICO = re.compile(r"(?<![\w-])(?:EC2AMAZ|DESKTOP|WIN|LAPTOP|SERVER|WORKSTATION)-[A-Z0-9]{3,}(?![\w-])", re.I)

RE_BLOQUE_JSON = re.compile(r"```json\s*(.*?)\s*```", re.S)
RE_IPV4 = re.compile(r"(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?!\d)(?!\.\d)")
RE_IPV6 = re.compile(r"(?<![\w:.])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![\w:.])")
RE_CORREO = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
RE_MAC = re.compile(r"(?<![0-9A-Fa-f:-])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:-])")
RE_SID = re.compile(r"S-1-5-21-(\d+)-(\d+)-(\d+)((?:-\d+)?)")
RE_GUID = re.compile(r"\{?[0-9A-Fa-f]{8}-(?:[0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}\}?")


def es_documentacion_v4(texto):
    ip = ipaddress.ip_address(texto)
    return any(ip in red for red in REDES_DOC_V4)


class Seudonimos:
    """Reemplazos consistentes: el mismo valor original siempre da el mismo seudónimo."""

    def __init__(self):
        self.mapas = {}          # categoría -> {original en minúsculas: seudónimo}
        self.sensibles = {}      # original en minúsculas -> categoría (para verificar que no sobreviva)
        self.patron_tokens = None
        self.v4_usadas = set()

    def _tomar(self, categoria, original, fabricar):
        mapa = self.mapas.setdefault(categoria, {})
        clave = original.lower()
        if clave not in mapa:
            mapa[clave] = fabricar(len(mapa) + 1)
        return mapa[clave]

    def usuario(self, v):
        return self._tomar("usuario", v, lambda n: f"usuario-{n:02d}")

    def dominio(self, v):
        return self._tomar("dominio", v, lambda n: f"DOMINIO-{n:02d}")

    def equipo(self, v):
        return self._tomar("equipo", v, lambda n: f"equipo-{n:02d}")

    def correo(self, v):
        if v.lower().endswith("@example.test"):
            return v
        return self._tomar("correo", v, lambda n: f"usuario-{n:02d}@example.test")

    def mac(self, v):
        return self._tomar("mac", v, lambda n: f"02:00:00:00:00:{n:02x}")

    def guid(self, v):
        return self._tomar("guid", v, lambda n: "{00000000-0000-4000-8000-%012d}" % n)

    def sid(self, m):
        n = self._indice("sid", "-".join(m.group(1, 2, 3)))
        return f"S-1-5-21-{1000000000 + n}-{2000000000 + n}-{3000000000 + n}{m.group(4)}"

    def _indice(self, categoria, original):
        mapa = self.mapas.setdefault(categoria, {})
        clave = original.lower()
        if clave not in mapa:
            mapa[clave] = len(mapa) + 1
        return mapa[clave]

    def ipv4(self, v):
        if es_documentacion_v4(v):
            self.v4_usadas.add(v)
            return v
        mapa = self.mapas.setdefault("ipv4", {})
        if v not in mapa:
            for red in REDES_DOC_V4:
                for host in red.hosts():
                    candidata = str(host)
                    if candidata not in self.v4_usadas:
                        self.v4_usadas.add(candidata)
                        mapa[v] = candidata
                        break
                if v in mapa:
                    break
            else:
                raise SystemExit("Hay más de 750 IPv4 distintas: sube el límite de selección o revisa el origen.")
        return mapa[v]

    def ipv6(self, v):
        try:
            ip = ipaddress.IPv6Address(v)
        except ValueError:
            return v
        if ip in RED_DOC_V6 or ip == ipaddress.IPv6Address("::"):
            return v
        return self._tomar("ipv6", v, lambda n: f"2001:db8::{n:x}")

    # --- recolección de nombres a proteger -------------------------------------------------------------------------
    def registrar(self, categoria, valor):
        if not isinstance(valor, str):
            return
        valor = valor.strip()
        if valor.lower() in GENERICOS or GENERICOS_RE.match(valor) or len(valor) < 2:
            return
        if valor.endswith("$") and len(valor) > 2:     # cuenta de máquina: DESKTOP-ABC$
            valor = valor[:-1]
            categoria = "equipo"
        # Un correo o una IP ya los cubren sus expresiones propias.
        if RE_CORREO.fullmatch(valor) or RE_IPV4.fullmatch(valor):
            return
        if "\\" in valor:                               # DOMINIO\usuario
            dom, _, usr = valor.partition("\\")
            self.registrar("dominio", dom)
            self.registrar("usuario", usr)
            return
        fabrica = {"usuario": self.usuario, "dominio": self.dominio, "equipo": self.equipo}[categoria]
        fabrica(valor)
        self.sensibles[valor.lower()] = categoria

    def compilar(self):
        todos = {}
        for categoria in ("usuario", "dominio", "equipo"):
            for original, seudonimo in self.mapas.get(categoria, {}).items():
                if len(original) >= 3 and original not in PALABRAS_COMUNES:
                    todos[original] = seudonimo
        self.tokens = todos
        if todos:
            alternativas = "|".join(re.escape(t) for t in sorted(todos, key=len, reverse=True))
            self.patron_tokens = re.compile(r"(?<![\w-])(?:" + alternativas + r")(?!\w)(?!-\w)", re.I)

    # --- aplicación -----------------------------------------------------------------------------------------------
    def texto(self, s):
        s = RE_CORREO.sub(lambda m: self.correo(m.group(0)), s)
        s = RE_MAC.sub(lambda m: self.mac(m.group(0)), s)
        s = RE_SID.sub(self.sid, s)
        s = RE_IPV4.sub(lambda m: self.ipv4(m.group(0)), s)
        s = RE_IPV6.sub(lambda m: self.ipv6(m.group(0)) if m.group(0) not in ("::",) else m.group(0), s)
        if self.patron_tokens:
            s = self.patron_tokens.sub(lambda m: self.tokens[m.group(0).lower()], s)
        return s


def hojas(o, ruta=()):
    """Recorre un JSON y entrega (ruta de claves en minúsculas, valor) de cada hoja de texto."""
    if isinstance(o, dict):
        for k, v in o.items():
            yield from hojas(v, ruta + (k.lower(),))
    elif isinstance(o, list):
        for v in o:
            yield from hojas(v, ruta)
    elif isinstance(o, str):
        yield ruta, o


def extraer_bloque(descripcion):
    m = RE_BLOQUE_JSON.search(descripcion or "")
    if not m:
        return None, None
    try:
        return m, json.loads(m.group(1))
    except ValueError:
        return m, None


def recolectar(alertas, seud):
    for a in alertas:
        for campo in ("title", "description"):
            texto = a.get(campo)
            if isinstance(texto, str):
                for nombre in RE_EQUIPO_EN_TEXTO.findall(RE_BLOQUE_JSON.sub("", texto)):
                    seud.registrar("equipo", nombre)
        for texto in [a.get("title"), a.get("description")] + [t for t in a.get("tags", [])]:
            if isinstance(texto, str):
                for nombre in RE_EQUIPO_TIPICO.findall(texto):
                    seud.registrar("equipo", nombre)
        _, datos = extraer_bloque(a.get("description"))
        if datos is None:
            continue
        for ruta, valor in hojas(datos):
            clave = ruta[-1] if ruta else ""
            for nombre in RE_EQUIPO_TIPICO.findall(valor):
                seud.registrar("equipo", nombre)
            if clave == "extra_data" and "->" in valor:      # "NOMBRE-DEL-EQUIPO->any"
                seud.registrar("equipo", valor.split("->", 1)[0])
            if clave in CLAVES_USUARIO:
                seud.registrar("usuario", valor)
            elif clave in CLAVES_DOMINIO:
                seud.registrar("dominio", valor)
            elif clave in CLAVES_EQUIPO or "workstation" in clave or "computer" in clave:
                seud.registrar("equipo", valor)
            elif ruta[-2:] == ("agente", "name"):
                seud.registrar("equipo", valor)
            if clave == "message":
                for etiqueta, v in RE_MENSAJE.findall(valor):
                    seud.registrar(ETIQUETAS_MENSAJE[etiqueta.lower()], v.strip())
    seud.compilar()


def anonimizar_valor(o, seud, ruta=()):
    if isinstance(o, dict):
        salida = {}
        for k, v in o.items():
            if k in CLAVES_SIN_TOCAR and not ruta:
                salida[k] = v
            elif k.lower() == "logonguid" and isinstance(v, str) and RE_GUID.fullmatch(v) and set(v.strip("{}")) - {"0", "-"}:
                salida[k] = seud.guid(v)
            else:
                salida[k] = anonimizar_valor(v, seud, ruta + (k.lower(),))
        return salida
    if isinstance(o, list):
        return [anonimizar_valor(v, seud, ruta) for v in o]
    if isinstance(o, str):
        clave = ruta[-1] if ruta else ""
        crudo = o.strip()
        if clave in CLAVES_USUARIO and crudo.lower() in seud.mapas.get("usuario", {}):
            return seud.usuario(crudo)
        if clave in CLAVES_DOMINIO and crudo.lower() in seud.mapas.get("dominio", {}):
            return seud.dominio(crudo)
        if (clave in CLAVES_EQUIPO or ruta[-2:] == ("agente", "name")) and crudo.lower() in seud.mapas.get("equipo", {}):
            return seud.equipo(crudo)
        return seud.texto(o)
    return o


def sangria_de(texto):
    lineas = texto.splitlines()
    if len(lineas) < 2:
        return None
    return len(lineas[1]) - len(lineas[1].lstrip()) or None


def anonimizar_alerta(a, indice, seud):
    resultado = {}
    for k, v in a.items():
        if k == "_id":
            resultado[k] = f"~{81920000 + 4096 * indice}"
        elif k in ("_createdBy", "_updatedBy"):
            resultado[k] = "sistema@example.test"
        elif k == "description":
            resultado[k] = anonimizar_descripcion(v, seud)
        else:
            resultado[k] = anonimizar_valor({k: v}, seud)[k] if k not in CLAVES_SIN_TOCAR else v
    return resultado


def anonimizar_descripcion(texto, seud):
    if not isinstance(texto, str):
        return texto
    m, datos = extraer_bloque(texto)
    if m is None or datos is None:
        return seud.texto(texto)
    sangria = sangria_de(m.group(1))
    nuevo = json.dumps(anonimizar_valor(datos, seud), ensure_ascii=False, indent=sangria)
    return seud.texto(texto[:m.start()]) + "```json\n" + nuevo + "\n```" + seud.texto(texto[m.end():])


# ---------------------------------------------------------------------------------------------------------------------
# Selección de ~15 alertas representativas
# ---------------------------------------------------------------------------------------------------------------------

def caracteristicas(a):
    c = {("origen", a.get("source"), a.get("type")), ("severidad", a.get("severity"))}
    if a.get("observableCount", 0) > 0:
        c.add(("con_observables",))
    _, datos = extraer_bloque(a.get("description"))
    if isinstance(datos, dict):
        d = datos.get("datos") or {}
        regla = datos.get("regla") or {}
        c.add(("regla", regla.get("id")))
        c.add(("plataforma", "windows" if "win" in d else "linux"))
        c.add(("agente_ip", bool((datos.get("agente") or {}).get("ip"))))
        c.add(("srcip", bool(d.get("srcip"))))
        c.add(("extra_data", bool(d.get("extra_data"))))
        mitre = regla.get("mitre") or {}
        tacticas = mitre.get("tactic") or []
        c.add(("mitre", bool(tacticas)))
        if tacticas:
            c.add(("tactica", tacticas[0]))
    return c


def seleccionar(alertas, maximo):
    por_fecha = sorted(alertas, key=lambda a: a.get("_createdAt", 0), reverse=True)
    elegidas, ids = [], set()

    def tomar(a):
        if a["_id"] not in ids:
            ids.add(a["_id"])
            elegidas.append(a)

    # 1) No-Wazuh: una de cada (source, type) y una segunda en los grupos con 3 o más.
    grupos = {}
    for a in por_fecha:
        if a.get("source") != "wazuh":
            grupos.setdefault((a.get("source"), a.get("type")), []).append(a)
    for grupo in grupos.values():
        for a in grupo[: 2 if len(grupo) >= 3 else 1]:
            tomar(a)

    # 2) Wazuh: la que más características nuevas aporte, hasta llegar al máximo.
    vistas = set()
    for a in elegidas:
        vistas |= caracteristicas(a)
    wazuh = [a for a in por_fecha if a.get("source") == "wazuh"]
    while len(elegidas) < maximo:
        mejor, ganancia = None, 0
        for a in wazuh:
            if a["_id"] in ids:
                continue
            g = len(caracteristicas(a) - vistas)
            if g > ganancia:
                mejor, ganancia = a, g
        if mejor is None:
            break
        tomar(mejor)
        vistas |= caracteristicas(mejor)
    return sorted(elegidas, key=lambda a: a.get("_createdAt", 0), reverse=True)


# ---------------------------------------------------------------------------------------------------------------------
# Verificación: si algo sensible sobrevive, no se deja el archivo
# ---------------------------------------------------------------------------------------------------------------------

def problemas(texto, seud):
    encontrados = []
    for m in RE_IPV4.finditer(texto):
        if not es_documentacion_v4(m.group(0)):
            encontrados.append("IPv4 fuera de los rangos de documentación")
    for m in RE_IPV6.finditer(texto):
        try:
            ip = ipaddress.IPv6Address(m.group(0))
        except ValueError:
            continue
        if ip not in RED_DOC_V6 and ip != ipaddress.IPv6Address("::"):
            encontrados.append("IPv6 fuera de 2001:db8::/32")
    for m in RE_CORREO.finditer(texto):
        if not m.group(0).lower().endswith("@example.test"):
            encontrados.append("correo real")
    for m in RE_MAC.finditer(texto):
        if not m.group(0).lower().startswith("02:00:00:00:00:"):
            encontrados.append("dirección MAC real")
    for m in RE_SID.finditer(texto):
        if not m.group(1).startswith("10000"):
            encontrados.append("SID de dominio real")
    bajo = texto.lower()
    for dominio in DOMINIOS_INTERNOS:
        if dominio in bajo:
            encontrados.append("dominio interno de TheHive")
    sin_ficticios = bajo.replace("example.test", "")  # "test" podría ser un usuario real y no es una fuga
    for original, categoria in seud.sensibles.items():
        if original in PALABRAS_COMUNES:
            continue  # se reemplazan solo en el campo exacto; en texto libre ("Restricted Admin Mode") son palabras normales
        if re.search(r"(?<![\w-])" + re.escape(original) + r"(?!\w)(?!-\w)", sin_ficticios):
            encontrados.append(f"un {categoria} original sobrevivió")
    return sorted(set(encontrados))


def main():
    ap = argparse.ArgumentParser(description="Anonimiza alertas reales de TheHive para usarlas como fixtures.")
    ap.add_argument("original", help="ruta al alertas.json original (FUERA del repositorio)")
    ap.add_argument("--max", type=int, default=15, help="cuántas alertas conservar (por defecto 15)")
    args = ap.parse_args()

    entrada = Path(args.original).expanduser().resolve()
    if not entrada.is_file():
        sys.exit("No existe el archivo original: " + str(entrada))
    if RAIZ_REPO == entrada or RAIZ_REPO in entrada.parents:
        sys.exit("El original está dentro del repositorio. Muévelo afuera: el original real nunca debe vivir en el repo.")

    alertas = json.loads(entrada.read_text(encoding="utf-8"))
    if not isinstance(alertas, list) or not alertas:
        sys.exit("Se esperaba un arreglo JSON de alertas.")

    seud = Seudonimos()
    recolectar(alertas, seud)
    elegidas = seleccionar(alertas, args.max)
    salida = [anonimizar_alerta(a, i + 1, seud) for i, a in enumerate(elegidas)]
    texto = json.dumps(salida, ensure_ascii=False, indent=2) + "\n"

    fallos = problemas(texto, seud)
    if fallos:
        print("NO se escribió nada. Quedó información sensible:", *fallos, sep="\n  - ")
        sys.exit(1)

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(texto, encoding="utf-8", newline="\n")

    print(f"Original: {len(alertas)} alertas  ->  fixtures: {len(salida)} alertas")
    por_origen = {}
    for a in salida:
        clave = f"{a.get('source')}/{a.get('type')}"
        por_origen[clave] = por_origen.get(clave, 0) + 1
    print("Por origen:", ", ".join(f"{k}={v}" for k, v in sorted(por_origen.items())))
    print("Reemplazos:", ", ".join(f"{k}={len(v)}" for k, v in sorted(seud.mapas.items())))
    print("Escrito en:", SALIDA.relative_to(RAIZ_REPO))


if __name__ == "__main__":
    main()
