package co.edu.escuelaing.dashboard.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import co.edu.escuelaing.dashboard.DashboardApplication;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * Arranque real de la aplicación (con un servidor HTTP de verdad en un puerto libre): sin la key no arranca y, en
 * ningún caso, la key sale en logs, mensajes de error ni respuestas.
 */
@ExtendWith(OutputCaptureExtension.class)
class ArranqueTest {

    private static final String CLAVE = "CLAVE-SECRETA-QUE-NO-DEBE-SALIR";

    private static ConfigurableApplicationContext arrancar(String... propiedades) {
        List<String> args = new ArrayList<>(List.of("--server.port=0", "--spring.main.banner-mode=off"));
        for (String p : propiedades) {
            args.add("--" + p);
        }
        // Los argumentos de línea de comandos tienen prioridad sobre las variables de entorno del equipo.
        return new SpringApplicationBuilder(DashboardApplication.class)
                .web(WebApplicationType.SERVLET)
                .run(args.toArray(String[]::new));
    }

    private static String trazaCompleta(Throwable t) {
        var sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }

    private static boolean contieneLaCausa(Throwable t) {
        for (Throwable e = t; e != null; e = e.getCause()) {
            if (e instanceof ConfiguracionInvalidaException) {
                return true;
            }
        }
        return false;
    }

    @Test
    void sinApiKeyLaAplicacionNoArrancaYDiceElPorQue(CapturedOutput salida) {
        Throwable error = catchThrowable(() -> arrancar(
                "dashboard.thehive.url=https://servidor.prueba.invalid", "dashboard.thehive.api-key="));

        assertThat(error).isNotNull();
        assertThat(contieneLaCausa(error)).as("la causa es ConfiguracionInvalidaException").isTrue();
        assertThat(salida.getAll())
                .contains("APPLICATION FAILED TO START")
                .contains("THEHIVE_API_KEY");
    }

    @Test
    void sinUrlTampocoArrancaYLaClaveNoSale(CapturedOutput salida) {
        Throwable error = catchThrowable(() -> arrancar("dashboard.thehive.url=", "dashboard.thehive.api-key=" + CLAVE));

        assertThat(error).isNotNull();
        assertThat(contieneLaCausa(error)).isTrue();
        assertThat(salida.getAll()).contains("THEHIVE_URL").doesNotContain(CLAVE);
        assertThat(trazaCompleta(error)).doesNotContain(CLAVE);
    }

    @Test
    void conLaConfiguracionCompletaArrancaYLaClaveNoApareceEnLogsNiRespuestas(CapturedOutput salida) throws Exception {
        try (ConfigurableApplicationContext contexto = arrancar(
                "dashboard.thehive.url=https://servidor.prueba.invalid", "dashboard.thehive.api-key=" + CLAVE)) {

            String puerto = contexto.getEnvironment().getProperty("local.server.port");
            var cliente = HttpClient.newHttpClient();
            HttpResponse<String> ok = cliente.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + puerto + "/api/dashboard/configuracion")).build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            HttpResponse<String> noExiste = cliente.send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + puerto + "/api/dashboard/no-existe")).build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            assertThat(ok.statusCode()).isEqualTo(200);
            assertThat(ok.body()).doesNotContain(CLAVE).contains("slaMinutos");
            assertThat(ok.headers().map().toString()).doesNotContain(CLAVE);
            assertThat(noExiste.statusCode()).isEqualTo(404);
            assertThat(noExiste.body()).doesNotContain(CLAVE);

            assertThat(contexto.getBean(ConfiguracionTheHive.class).toString()).doesNotContain(CLAVE);
        }
        assertThat(salida.getAll()).doesNotContain(CLAVE);
    }
}
