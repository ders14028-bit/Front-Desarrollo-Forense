package co.edu.escuelaing.dashboard.thehive.cliente;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Garantiza que el backend solo LEE de TheHive: falla si aparece otro método HTTP, otra ruta o cualquier forma de
 * llamar a TheHive que no pase por {@link TheHiveClient}.
 */
class SoloLecturaClienteTest {

    private static final Path FUENTES = Path.of("src/main/java");

    private static List<Path> archivosJava() throws IOException {
        try (Stream<Path> todos = Files.walk(FUENTES)) {
            return todos.filter(p -> p.toString().endsWith(".java")).toList();
        }
    }

    private static String leer(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void elClienteSoloUsaPostYSoloLaRutaDeConsulta() throws IOException {
        String codigo = leer(FUENTES.resolve("co/edu/escuelaing/dashboard/thehive/cliente/TheHiveClient.java"));

        // Métodos HTTP: únicamente .post()
        for (String prohibido : List.of(".get()", ".put()", ".patch()", ".delete()", ".head()", ".options()", ".method(")) {
            assertThat(codigo).as("TheHiveClient no debe usar " + prohibido).doesNotContain("http" + prohibido);
        }
        assertThat(codigo).containsOnlyOnce("http.post()");

        // Rutas: únicamente /api/v1/query
        Matcher rutas = Pattern.compile("\"(/api/[^\"]*)\"").matcher(codigo);
        List<String> encontradas = rutas.results().map(r -> r.group(1)).toList();
        assertThat(encontradas).containsExactly("/api/v1/query");
        assertThat(TheHiveClient.RUTA_CONSULTA).isEqualTo("/api/v1/query");
        assertThat(codigo).containsOnlyOnce(".uri(RUTA_CONSULTA)");
    }

    @Test
    void ningunOtroArchivoHablaConTheHive() throws IOException {
        Path cliente = FUENTES.resolve("co/edu/escuelaing/dashboard/thehive/cliente/TheHiveClient.java");
        List<String> sospechosos = List.of("RestClient", "RestTemplate", "WebClient", "HttpClient", "HttpURLConnection",
                "java.net.http", "URLConnection", "OkHttp", "/api/v1", "/api/case", "/api/alert");

        for (Path archivo : archivosJava()) {
            if (archivo.equals(cliente) || archivo.getFileName().toString().equals("ConsultaTheHive.java")) {
                continue; // ConsultaTheHive solo menciona nombres de operaciones, no rutas
            }
            String codigo = leer(archivo);
            for (String palabra : sospechosos) {
                assertThat(codigo).as(archivo + " no debe contener " + palabra).doesNotContain(palabra);
            }
        }
    }

    @Test
    void ningunControladorExponeEscrituras() throws IOException {
        for (Path archivo : archivosJava()) {
            String codigo = leer(archivo);
            for (String anotacion : List.of("@PostMapping", "@PutMapping", "@PatchMapping", "@DeleteMapping")) {
                assertThat(codigo).as(archivo + " no debe usar " + anotacion).doesNotContain(anotacion);
            }
        }
    }

    @Test
    void lasOperacionesDeEscrituraDeTheHiveNoEstanEnLaListaBlanca() {
        for (String escritura : List.of("createAlert", "createCase", "updateAlert", "updateCase", "deleteAlert", "deleteCase",
                "mergeAlert", "promoteAlert", "createTask", "updateTask", "deleteTask", "createObservable", "close", "assign")) {
            java.util.Map<String, Object> operacion = java.util.Map.of("_name", escritura);

            org.assertj.core.api.Assertions.assertThatThrownBy(() -> ConsultaTheHive.deOperaciones(List.of(operacion)).validar())
                    .as(escritura)
                    .isInstanceOf(ConsultaNoPermitidaException.class);
        }
    }

    @Test
    void laListaBlancaEsExactamenteLaAcordada() {
        assertThat(ConsultaTheHive.OPERACIONES_PERMITIDAS).containsExactlyInAnyOrder(
                "listAlert", "listCase", "listTask", "getAlert", "getCase", "tasks", "observables",
                "filter", "sort", "page", "count", "aggregation");
    }
}
