package co.edu.escuelaing.dashboard.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

/** El application.yml documenta los valores por defecto y no contiene secretos ni la URL interna de TheHive. */
class ArchivoDeConfiguracionTest {

    private static Properties yml() {
        var fabrica = new YamlPropertiesFactoryBean();
        fabrica.setResources(new ClassPathResource("application.yml"));
        return fabrica.getObject();
    }

    @Test
    void escuchaSoloEnLocalhostPorDefecto() {
        assertThat(yml().getProperty("server.address")).isEqualTo("${SERVER_ADDRESS:127.0.0.1}");
    }

    @Test
    void elOrigenPorDefectoEsElDeViteEnDesarrollo() {
        assertThat(yml().getProperty("dashboard.cors.origenes")).isEqualTo("${DASHBOARD_ORIGINS:http://localhost:5173}");
    }

    @Test
    void laConexionConTheHiveSoloSaleDeVariablesDeEntorno() {
        var p = yml();
        assertThat(p.getProperty("dashboard.thehive.api-key")).isEqualTo("${THEHIVE_API_KEY:}");
        assertThat(p.getProperty("dashboard.thehive.url")).isEqualTo("${THEHIVE_URL:}");
        assertThat(p.getProperty("dashboard.thehive.organizacion")).isEqualTo("${THEHIVE_ORG:escuelaing}");
    }

    @Test
    void elSlaVieneDeLaConfiguracion() {
        var p = yml();
        assertThat(p.getProperty("dashboard.sla-minutos.critica")).isEqualTo("15");
        assertThat(p.getProperty("dashboard.sla-minutos.alta")).isEqualTo("30");
        assertThat(p.getProperty("dashboard.sla-minutos.media")).isEqualTo("120");
        assertThat(p.getProperty("dashboard.sla-minutos.baja")).isEqualTo("240");
    }

    @Test
    void losErroresNoRevelanDetallesInternos() {
        var p = yml();
        assertThat(p.getProperty("server.error.include-stacktrace")).isEqualTo("never");
        assertThat(p.getProperty("server.error.include-message")).isEqualTo("never");
    }

    @Test
    void elCodigoYLaConfiguracionNoContienenLaUrlInternaDeTheHive() throws IOException {
        try (Stream<Path> archivos = Files.walk(Path.of("src"))) {
            var conLaUrl = archivos
                    .filter(Files::isRegularFile)
                    .filter(f -> !f.getFileName().toString().equals("ArchivoDeConfiguracionTest.java"))
                    .filter(f -> {
                        try {
                            String texto = Files.readString(f, StandardCharsets.UTF_8);
                            return texto.contains("ts.net") || texto.contains("tail2ab6e9");
                        } catch (IOException e) {
                            return false; // un archivo binario no cuenta
                        }
                    })
                    .toList();

            assertThat(conLaUrl).as("archivos que mencionan la URL interna de TheHive").isEmpty();
        }
    }
}
