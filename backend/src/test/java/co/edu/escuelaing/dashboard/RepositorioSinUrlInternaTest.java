package co.edu.escuelaing.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * Recorre TODO lo versionable del repositorio (código, pruebas, fixtures, docs, scripts, frontend) y falla si aparece
 * el dominio interno de TheHive. La URL real solo vive en THEHIVE_URL y en {@code docs/contexto-backend-thehive.md},
 * que está ignorado por git.
 *
 * <p>Los textos prohibidos se arman por partes para que este archivo no los contenga.
 */
class RepositorioSinUrlInternaTest {

    private static final List<String> PROHIBIDOS = List.of("ts" + ".net", "tail2ab" + "6e9");
    private static final Set<String> DIRECTORIOS_AJENOS = Set.of(".git", "node_modules", "target", "dist", ".idea", ".mvn");
    private static final Path RAIZ = Path.of("..").toAbsolutePath().normalize();

    /** Archivos que git versionaría: los rastreados más los nuevos que no están ignorados. */
    private static List<Path> versionables() throws IOException {
        try {
            Process proceso = new ProcessBuilder("git", "-C", RAIZ.toString(), "ls-files", "-z", "--cached", "--others", "--exclude-standard")
                    .redirectErrorStream(true).start();
            String salida = new String(proceso.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (proceso.waitFor() == 0 && !salida.isBlank()) {
                List<Path> archivos = new ArrayList<>();
                for (String ruta : salida.split("\0")) {
                    Path archivo = RAIZ.resolve(ruta);
                    if (Files.isRegularFile(archivo)) {
                        archivos.add(archivo);
                    }
                }
                return archivos;
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            // sin git disponible: se recorre el disco
        }
        try (Stream<Path> todos = Files.walk(RAIZ)) {
            return todos.filter(Files::isRegularFile)
                    .filter(p -> RAIZ.relativize(p).normalize().toString().replace('\\', '/').split("/").length > 0
                            && java.util.stream.StreamSupport.stream(RAIZ.relativize(p).spliterator(), false)
                                    .noneMatch(parte -> DIRECTORIOS_AJENOS.contains(parte.toString())))
                    .filter(p -> !RAIZ.relativize(p).toString().replace('\\', '/').equals("docs/contexto-backend-thehive.md"))
                    .toList();
        }
    }

    @Test
    void ningunArchivoVersionableMencionaElDominioInternoDeTheHive() throws IOException {
        List<Path> archivos = versionables();
        assertThat(archivos).as("el recorrido debe encontrar el repositorio").isNotEmpty();
        assertThat(archivos.stream().map(p -> p.getFileName().toString())).contains("CLAUDE.md", "pom.xml");

        List<String> infractores = new ArrayList<>();
        for (Path archivo : archivos) {
            String texto;
            try {
                texto = new String(Files.readAllBytes(archivo), StandardCharsets.UTF_8).toLowerCase();
            } catch (IOException e) {
                continue;
            }
            for (String prohibido : PROHIBIDOS) {
                if (texto.contains(prohibido)) {
                    infractores.add(RAIZ.relativize(archivo) + " contiene un dominio interno");
                    break;
                }
            }
        }

        assertThat(infractores).as("archivos versionables con el dominio interno de TheHive").isEmpty();
    }

    @Test
    void elContextoInternoEstaIgnoradoPorGit() throws IOException {
        String gitignore = Files.readString(RAIZ.resolve(".gitignore"), StandardCharsets.UTF_8);

        assertThat(gitignore).contains("docs/contexto-backend-thehive.md");
    }
}
