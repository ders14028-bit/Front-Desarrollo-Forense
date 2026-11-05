package co.edu.escuelaing.dashboard.thehive.cliente;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

/** El cliente contra un servidor HTTP local de verdad (127.0.0.1): tiempos de espera, redirecciones, tamaño, concurrencia. */
class RedRealTest {

    private HttpServer servidor;

    @AfterEach
    void parar() {
        if (servidor != null) {
            servidor.stop(0);
        }
    }

    private String levantar(com.sun.net.httpserver.HttpHandler manejador) throws IOException {
        servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        servidor.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        servidor.createContext("/", manejador);
        servidor.start();
        return "http://127.0.0.1:" + servidor.getAddress().getPort();
    }

    private static LimitesTheHive limites(Duration lectura, DataSize max, Integer simultaneas) {
        return new LimitesTheHive(Duration.ofSeconds(2), lectura, max, simultaneas);
    }

    private static ConsultaTheHive total() {
        return ConsultaTheHive.listAlert().count();
    }

    @Test
    void leeUnaRespuestaSinCharsetEnUtf8() throws Exception {
        String url = levantar(intercambio -> {
            byte[] cuerpo = "[{\"description\":\"Ejecución de código — ñandú\"}]".getBytes(StandardCharsets.UTF_8);
            intercambio.getResponseHeaders().set("Content-Type", "application/json"); // sin charset, como TheHive
            intercambio.sendResponseHeaders(200, cuerpo.length);
            try (OutputStream salida = intercambio.getResponseBody()) {
                salida.write(cuerpo);
            }
        });

        var respuesta = ClienteDePrueba.contraServidorReal(url, limites(Duration.ofSeconds(5), null, null))
                .consultar(ConsultaTheHive.listAlert().page(0, 1));

        assertThat(respuesta.get(0).path("description").asText()).isEqualTo("Ejecución de código — ñandú");
    }

    @Test
    void enviaSoloPostALaRutaDeConsultaConLasCabecerasConfiguradas() throws Exception {
        var metodo = new AtomicReference<String>();
        var ruta = new AtomicReference<String>();
        var autorizacion = new AtomicReference<String>();
        var organizacion = new AtomicReference<String>();
        String url = levantar(intercambio -> {
            metodo.set(intercambio.getRequestMethod());
            ruta.set(intercambio.getRequestURI().getPath());
            autorizacion.set(intercambio.getRequestHeaders().getFirst("Authorization"));
            organizacion.set(intercambio.getRequestHeaders().getFirst("X-Organisation"));
            byte[] cuerpo = "7".getBytes(StandardCharsets.UTF_8);
            intercambio.sendResponseHeaders(200, cuerpo.length);
            try (OutputStream salida = intercambio.getResponseBody()) {
                salida.write(cuerpo);
            }
        });

        ClienteDePrueba.contraServidorReal(url, limites(Duration.ofSeconds(5), null, null)).consultar(total());

        assertThat(metodo.get()).isEqualTo("POST");
        assertThat(ruta.get()).isEqualTo("/api/v1/query");
        assertThat(autorizacion.get()).isEqualTo("Bearer " + ClienteDePrueba.CLAVE);
        assertThat(organizacion.get()).isEqualTo(ClienteDePrueba.ORGANIZACION);
    }

    @Test
    void sinRespuestaVenceElTiempoDeLectura() throws Exception {
        var liberar = new CountDownLatch(1);
        String url = levantar(intercambio -> {
            try {
                liberar.await(10, java.util.concurrent.TimeUnit.SECONDS);
            } catch (InterruptedException ignorada) {
                Thread.currentThread().interrupt();
            }
            intercambio.close();
        });
        var cliente = ClienteDePrueba.contraServidorReal(url, limites(Duration.ofMillis(500), null, null));

        long inicio = System.nanoTime();
        assertThatThrownBy(() -> cliente.consultar(total()))
                .isInstanceOf(TheHiveNoRespondeException.class)
                .hasMessage("TheHive no responde: se agotó el tiempo de espera.");
        long ms = (System.nanoTime() - inicio) / 1_000_000;
        liberar.countDown();

        assertThat(ms).isLessThan(5000);
    }

    @Test
    void siElCuerpoSeDetieneATresCuartosTambienVenceElTiempo() throws Exception {
        var liberar = new CountDownLatch(1);
        String url = levantar(intercambio -> {
            intercambio.sendResponseHeaders(200, 1000); // promete 1000 bytes y manda 10
            OutputStream salida = intercambio.getResponseBody();
            salida.write("0123456789".getBytes(StandardCharsets.UTF_8));
            salida.flush();
            try {
                liberar.await(10, java.util.concurrent.TimeUnit.SECONDS);
            } catch (InterruptedException ignorada) {
                Thread.currentThread().interrupt();
            }
            intercambio.close();
        });
        var cliente = ClienteDePrueba.contraServidorReal(url, limites(Duration.ofMillis(500), null, null));

        assertThatThrownBy(() -> cliente.consultar(total()))
                .isInstanceOf(TheHiveNoRespondeException.class)
                .hasMessageContaining("tiempo de espera");
        liberar.countDown();
    }

    @Test
    void noSigueRedireccionesNiReenviaLaKey() throws Exception {
        var visitas = new AtomicInteger();
        var otroDestino = new AtomicInteger();
        // Un segundo servidor que NO debe recibir nada.
        HttpServer destino = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        destino.createContext("/", i -> {
            otroDestino.incrementAndGet();
            i.sendResponseHeaders(200, -1);
            i.close();
        });
        destino.start();
        try {
            String urlDestino = "http://127.0.0.1:" + destino.getAddress().getPort() + "/robado";
            String url = levantar(intercambio -> {
                visitas.incrementAndGet();
                intercambio.getResponseHeaders().set("Location", urlDestino);
                intercambio.sendResponseHeaders(302, -1);
                intercambio.close();
            });

            assertThatThrownBy(() -> ClienteDePrueba.contraServidorReal(url, limites(Duration.ofSeconds(5), null, null)).consultar(total()))
                    .isInstanceOf(TheHiveRespuestaInvalidaException.class)
                    .hasMessageContaining("redirección");

            assertThat(visitas.get()).isEqualTo(1);
            assertThat(otroDestino.get()).isZero();
        } finally {
            destino.stop(0);
        }
    }

    @Test
    void unaRespuestaEnormeSeCortaAlLlegarAlTope() throws Exception {
        String url = levantar(intercambio -> {
            intercambio.sendResponseHeaders(200, 0); // tamaño desconocido (chunked)
            try (OutputStream salida = intercambio.getResponseBody()) {
                byte[] bloque = new byte[8192];
                java.util.Arrays.fill(bloque, (byte) '1');
                for (int i = 0; i < 1000; i++) { // ~8 MB, el tope es 1 KB
                    salida.write(bloque);
                }
            } catch (IOException clienteCerro) {
                // esperado: el cliente corta
            }
        });

        assertThatThrownBy(() -> ClienteDePrueba.contraServidorReal(url, limites(Duration.ofSeconds(5), DataSize.ofKilobytes(1), null)).consultar(total()))
                .isInstanceOf(TheHiveRespuestaInvalidaException.class)
                .hasMessageContaining("supera el máximo");
    }

    @Test
    void siContentLengthYaSuperaElTopeNoSeLeeElCuerpo() throws Exception {
        String url = levantar(intercambio -> {
            intercambio.sendResponseHeaders(200, 5_000_000);
            try (OutputStream salida = intercambio.getResponseBody()) {
                salida.write(new byte[1024]);
            } catch (IOException esperado) {
                // el cliente cierra antes de terminar
            }
        });

        assertThatThrownBy(() -> ClienteDePrueba.contraServidorReal(url, limites(Duration.ofSeconds(5), DataSize.ofKilobytes(1), null)).consultar(total()))
                .isInstanceOf(TheHiveRespuestaInvalidaException.class)
                .hasMessageContaining("supera el máximo");
    }

    @Test
    void nuncaHayMasConsultasSimultaneasQueElLimite() throws Exception {
        var enCurso = new AtomicInteger();
        var maximo = new AtomicInteger();
        String url = levantar(intercambio -> {
            int ahora = enCurso.incrementAndGet();
            maximo.accumulateAndGet(ahora, Math::max);
            try {
                Thread.sleep(150);
            } catch (InterruptedException ignorada) {
                Thread.currentThread().interrupt();
            }
            enCurso.decrementAndGet();
            byte[] cuerpo = "1".getBytes(StandardCharsets.UTF_8);
            intercambio.sendResponseHeaders(200, cuerpo.length);
            try (OutputStream salida = intercambio.getResponseBody()) {
                salida.write(cuerpo);
            }
        });
        var cliente = ClienteDePrueba.contraServidorReal(url, limites(Duration.ofSeconds(10), null, 2));

        try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var tareas = new java.util.ArrayList<Future<?>>();
            for (int i = 0; i < 10; i++) {
                tareas.add(pool.submit(() -> cliente.consultar(total())));
            }
            for (Future<?> tarea : tareas) {
                tarea.get();
            }
        }

        assertThat(maximo.get()).isBetween(1, 2);
    }

    @Test
    void sinNadieEscuchandoEsTheHiveNoResponde() throws Exception {
        int puertoLibre;
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            puertoLibre = socket.getLocalPort();
        } // cerrado: nadie escucha

        var cliente = ClienteDePrueba.contraServidorReal("http://127.0.0.1:" + puertoLibre, limites(Duration.ofSeconds(5), null, null));

        assertThatThrownBy(() -> cliente.consultar(total()))
                .isInstanceOf(TheHiveNoRespondeException.class)
                .hasMessageContaining("TheHive no responde");
    }
}
