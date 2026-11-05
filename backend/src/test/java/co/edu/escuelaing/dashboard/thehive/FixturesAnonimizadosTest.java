package co.edu.escuelaing.dashboard.thehive;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Los fixtures vienen de alertas reales ya ANONIMIZADAS (backend/scripts/anonimizar-fixtures.py). Esta prueba es la
 * red de seguridad: falla si en el archivo queda una IP que no sea de documentación, un correo real, un SID de
 * dominio, una MAC o el dominio interno de TheHive.
 */
class FixturesAnonimizadosTest {

    private static final String RUTA = "/thehive/alertas.json";
    private static final Pattern IPV4 = Pattern.compile(
            "(?<![\\d.])(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?!\\d)(?!\\.\\d)");
    private static final Pattern IPV6 = Pattern.compile("(?<![\\w:.])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![\\w:.])");
    private static final Pattern CORREO = Pattern.compile("[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}");
    private static final Pattern MAC = Pattern.compile("(?<![0-9A-Fa-f:-])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:-])");
    private static final Pattern SID_DOMINIO = Pattern.compile("S-1-5-21-(\\d+)-(\\d+)-(\\d+)");
    private static final Pattern BLOQUE_JSON = Pattern.compile("```json\\s*(.*?)\\s*```", Pattern.DOTALL);

    private static final ObjectMapper JSON = new ObjectMapper();
    private static String texto;
    private static JsonNode alertas;

    @BeforeAll
    static void cargar() throws IOException {
        try (InputStream entrada = FixturesAnonimizadosTest.class.getResourceAsStream(RUTA)) {
            assertThat(entrada).as("falta " + RUTA + ": corre backend/scripts/anonimizar-fixtures.py").isNotNull();
            texto = new String(entrada.readAllBytes(), StandardCharsets.UTF_8);
        }
        alertas = JSON.readTree(texto);
    }

    private static boolean esDocumentacionV4(String ip) {
        return ip.startsWith("192.0.2.") || ip.startsWith("198.51.100.") || ip.startsWith("203.0.113.");
    }

    @Test
    void sonUnasQuinceAlertasConLaFormaDeTheHive() {
        assertThat(alertas.isArray()).isTrue();
        assertThat(alertas.size()).isBetween(12, 20);

        Set<String> ids = new HashSet<>();
        for (JsonNode alerta : alertas) {
            for (String campo : List.of("_id", "_type", "_createdAt", "type", "source", "sourceRef", "title", "description",
                    "severity", "severityLabel", "date", "tags", "tlp", "tlpLabel", "pap", "papLabel", "follow",
                    "customFields", "observableCount", "status", "stage", "extraData", "newDate", "timeToDetect")) {
                assertThat(alerta.has(campo)).as("campo " + campo + " en " + alerta.path("_id").asText()).isTrue();
            }
            assertThat(alerta.path("_type").asText()).isEqualTo("Alert");
            assertThat(ids.add(alerta.path("_id").asText())).as("ids únicos").isTrue();
            assertThat(alerta.has("caseId")).isFalse(); // el TheHive de laboratorio no tiene casos
        }
    }

    @Test
    void representanTodosLosOrigenes() {
        Set<String> origenes = new HashSet<>();
        for (JsonNode alerta : alertas) {
            origenes.add(alerta.path("source").asText() + "/" + alerta.path("type").asText());
        }

        assertThat(origenes).contains("wazuh/wazuh", "misp-kali-rase/misp", "sla-simulado/simulacion", "powershell/external",
                "Laboratorio-Forense/external");
    }

    @Test
    void lasAlertasDeWazuhTraenSuBloqueJsonValido() throws IOException {
        int wazuh = 0;
        for (JsonNode alerta : alertas) {
            if (!"wazuh".equals(alerta.path("source").asText())) {
                continue;
            }
            wazuh++;
            Matcher bloque = BLOQUE_JSON.matcher(alerta.path("description").asText());
            assertThat(bloque.find()).as("bloque ```json en " + alerta.path("_id").asText()).isTrue();
            JsonNode datos = JSON.readTree(bloque.group(1));
            assertThat(datos.path("regla").path("id").asText()).isNotEmpty();
            assertThat(alerta.path("tags").toString()).contains("regla:" + datos.path("regla").path("id").asText());
        }
        assertThat(wazuh).isGreaterThanOrEqualTo(5);
    }

    @Test
    void cubrenLosCasosQueImportanParaElDominio() throws IOException {
        boolean conMitre = false;
        boolean sinMitre = false;
        boolean windows = false;
        boolean linux = false;
        for (JsonNode alerta : alertas) {
            Matcher bloque = BLOQUE_JSON.matcher(alerta.path("description").asText());
            if (!bloque.find()) {
                continue;
            }
            JsonNode datos = JSON.readTree(bloque.group(1));
            if (datos.path("regla").has("mitre")) {
                conMitre = true;
            } else {
                sinMitre = true;
            }
            if (datos.path("datos").has("win")) {
                windows = true;
            } else {
                linux = true;
            }
        }

        assertThat(conMitre).as("alguna con MITRE").isTrue();
        assertThat(sinMitre).as("alguna sin MITRE (tipo 'Sin clasificar')").isTrue();
        assertThat(windows).as("alguna de Windows").isTrue();
        assertThat(linux).as("alguna de Linux").isTrue();
    }

    @Test
    void soloQuedanIpsDeDocumentacion() throws IOException {
        // Se buscan en el texto ya decodificado (los \n del JSON anidado no deben pegarse a una IP).
        String plano = texto.replace("\\n", " ").replace("\\r", " ").replace("\\t", " ");

        List<String> ajenas = new ArrayList<>();
        Matcher v4 = IPV4.matcher(plano);
        while (v4.find()) {
            if (!esDocumentacionV4(v4.group())) {
                ajenas.add("IPv4 no documentación");
            }
        }
        Matcher v6 = IPV6.matcher(plano);
        while (v6.find()) {
            String candidata = v6.group();
            if (candidata.equals("::") || !candidata.contains(":")) {
                continue;
            }
            try {
                InetAddress direccion = InetAddress.getByName("[" + candidata + "]");
                if (direccion.getAddress().length == 16 && !candidata.toLowerCase().startsWith("2001:db8:")) {
                    ajenas.add("IPv6 no documentación");
                }
            } catch (IOException noEsIp) {
                // no era una dirección (por ejemplo, una hora 12:30:45)
            }
        }

        assertThat(ajenas).as("direcciones IP que no son de documentación").isEmpty();
    }

    @Test
    void noQuedanCorreosReales() {
        Matcher m = CORREO.matcher(texto);
        while (m.find()) {
            assertThat(m.group().toLowerCase()).as("correo").endsWith("@example.test");
        }
    }

    @Test
    void noQuedanMacsNiSidsDeDominioReales() {
        Matcher mac = MAC.matcher(texto);
        while (mac.find()) {
            assertThat(mac.group()).startsWith("02:00:00:00:00:");
        }
        Matcher sid = SID_DOMINIO.matcher(texto);
        while (sid.find()) {
            assertThat(sid.group(1)).as("SID de dominio ficticio").startsWith("10000");
        }
    }

    @Test
    void noQuedaElDominioInternoDeTheHive() {
        String bajo = texto.toLowerCase();

        assertThat(bajo).doesNotContain("ts" + ".net").doesNotContain("tail2ab" + "6e9").doesNotContain("srvlinux");
    }

    @Test
    void losEquiposYLosUsuariosSonSeudonimos() throws IOException {
        for (JsonNode alerta : alertas) {
            Matcher bloque = BLOQUE_JSON.matcher(alerta.path("description").asText());
            if (!bloque.find()) {
                continue;
            }
            JsonNode datos = JSON.readTree(bloque.group(1));
            assertThat(datos.path("agente").path("name").asText()).startsWith("equipo-");
            JsonNode d = datos.path("datos");
            for (String campo : List.of("srcuser", "dstuser")) {
                if (d.has(campo)) {
                    String valor = d.path(campo).asText();
                    assertThat(valor.startsWith("usuario-") || List.of("root", "SYSTEM").contains(valor))
                            .as(campo + " debe ser un seudónimo o una cuenta genérica").isTrue();
                }
            }
            String computador = d.path("win").path("system").path("computer").asText();
            if (!computador.isEmpty()) {
                assertThat(computador).startsWith("equipo-");
            }
        }
    }
}
