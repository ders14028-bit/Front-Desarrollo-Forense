package co.edu.escuelaing.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Revisa {@code scripts/iniciar-demo.ps1} sin ejecutarlo: que la key se pida de forma segura y nunca quede escrita, que la
 * URL de TheHive no esté en el script y que se use el almacén de certificados de Windows SIN desactivar la validación TLS.
 */
class ScriptIniciarDemoTest {

    private static final Path SCRIPT = Path.of("scripts/iniciar-demo.ps1");

    private static String script() throws IOException {
        return Files.readString(SCRIPT, StandardCharsets.UTF_8);
    }

    private static List<String> lineasDeCodigo() throws IOException {
        return script().lines().map(String::strip).filter(l -> !l.startsWith("#") && !l.isEmpty()).toList();
    }

    @Test
    void tieneBomUtf8ParaQueWindowsPowerShell51LeaLasTildes() throws IOException {
        byte[] bytes = Files.readAllBytes(SCRIPT);

        assertThat(bytes).startsWith(0xEF, 0xBB, 0xBF);
    }

    @Test
    void laKeySePideConReadHostAsSecureString() throws IOException {
        String texto = script();

        assertThat(texto).contains("Read-Host").contains("-AsSecureString");
        assertThat(lineasDeCodigo().stream().filter(l -> l.contains("API key de TheHive")))
                .allMatch(l -> l.contains("-AsSecureString"));
    }

    @Test
    void laKeyNuncaSeEscribeEnElScriptNiViajaComoArgumento() throws IOException {
        List<String> codigo = lineasDeCodigo();

        // Toda asignación a THEHIVE_API_KEY sale del SecureString, no de un texto escrito.
        assertThat(codigo.stream().filter(l -> l.contains("$env:THEHIVE_API_KEY =")))
                .allMatch(l -> l.contains("PtrToStringBSTR"));
        // Ninguna línea que lance un proceso lleva la key (se vería en la lista de procesos).
        assertThat(codigo.stream().filter(l -> l.contains("Start-Process") || l.contains("-ArgumentList") || l.contains("Abrir-Ventana")))
                .noneMatch(l -> l.contains("API_KEY") || l.contains("$segura"));
        // Y no se escribe en pantalla ni en archivos.
        assertThat(codigo.stream().filter(l -> l.contains("API_KEY") || l.contains("$segura")))
                .noneMatch(l -> l.contains("Write-Host") || l.contains("Out-File") || l.contains("Set-Content") || l.contains("Add-Content")
                        || l.contains("Write-Output") || l.contains(">>"));
    }

    @Test
    void laKeyYElEntornoSeBorranAlTerminarAunqueFalle() throws IOException {
        String texto = script();

        assertThat(texto).contains("} finally {");
        assertThat(texto.substring(texto.lastIndexOf("} finally {"))).contains("Remove-Item").contains("$variablesTemporales");
        assertThat(texto).contains("'THEHIVE_API_KEY'");
    }

    @Test
    void laUrlDeTheHiveNoEstaEscritaSeLeeDelEntornoOSePregunta() throws IOException {
        String texto = script();

        assertThat(texto).contains("$env:THEHIVE_URL").contains("Read-Host 'URL de TheHive");
        Pattern direccion = Pattern.compile("https?://[^\\s'\"`]+");
        var encontradas = direccion.matcher(texto).results().map(r -> r.group()).toList();
        // Solo direcciones locales, el ejemplo genérico del mensaje y la expresión regular que valida lo que se escribe.
        assertThat(encontradas).isNotEmpty().allSatisfy(d -> assertThat(d)
                .satisfiesAnyOf(
                        x -> assertThat(x).matches("https?://(127\\.0\\.0\\.1|localhost).*"),
                        x -> assertThat(x).startsWith("https://servidor:puerto"),
                        x -> assertThat(x).startsWith("https?://"),
                        x -> assertThat(x).isEqualTo("http://)")));   // "(https:// o http://)" en un mensaje
        assertThat(texto.toLowerCase()).doesNotContain("ts" + ".net").doesNotContain("tail2ab" + "6e9");
    }

    @Test
    void usaWindowsRootSinDesactivarLaValidacionTls() throws IOException {
        String texto = script();

        assertThat(texto).contains("trustStoreType=Windows-ROOT").contains("trustStore=NONE");
        assertThat(texto.toLowerCase()).doesNotContain("trustall").doesNotContain("-skipcertificatecheck")
                .doesNotContain("checkrevocation=false").doesNotContain("allowunsafe").doesNotContain("insecure");
    }

    @Test
    void arrancaElFrontendConDatosRealesYSinLasVariablesDeTheHive() throws IOException {
        String texto = script();

        assertThat(texto).contains("VITE_USE_MOCK = 'false'").contains("VITE_API_URL = \"http://127.0.0.1:$PuertoBackend\"");
        // El frontend se lanza antes de poner cualquier variable de TheHive en el entorno.
        assertThat(texto.indexOf("Abrir-Ventana 'Frontend SOC'")).isLessThan(texto.indexOf("$env:THEHIVE_URL = $url"));
        assertThat(texto.indexOf("Abrir-Ventana 'Backend SOC'")).isGreaterThan(texto.indexOf("$env:THEHIVE_API_KEY ="));
    }

    @Test
    void abreElNavegadorSoloCuandoElBackendRespondeConfiguracion() throws IOException {
        String texto = script();

        assertThat(texto).contains("/api/dashboard/configuracion");
        assertThat(texto.indexOf("Start-Process \"http://localhost:$PuertoFrontend\"")).isGreaterThan(texto.indexOf("Esperar-Respuesta $urlConfiguracion"));
        assertThat(texto).contains("THEHIVE_ORG").contains("-AsSecureString");
    }
}
