package co.edu.escuelaing.dashboard.thehive.cliente;

import co.edu.escuelaing.dashboard.config.ConfiguracionTheHive;
import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertPathBuilderException;
import java.security.cert.CertPathValidatorException;
import java.security.cert.CertificateException;
import java.time.Duration;
import java.util.StringJoiner;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import javax.net.ssl.SSLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Único punto de salida hacia TheHive, y de SOLO LECTURA: expone únicamente {@code POST /api/v1/query}, que en TheHive
 * es una consulta (no modifica nada). No existe ningún método para crear, editar o borrar.
 *
 * <p>Reglas de seguridad y robustez:
 * <ul>
 *   <li>{@code Authorization} y {@code X-Organisation} se fijan en cada petición desde la configuración
 *       (THEHIVE_API_KEY y THEHIVE_ORG) y SOBREESCRIBEN cualquier otro valor: ningún llamador puede cambiarlos.</li>
 *   <li>Nunca se registran cabeceras. El cuerpo de la consulta solo se registra en nivel DEBUG.</li>
 *   <li>Solo se envían consultas de la lista blanca de {@link ConsultaTheHive}; el resto se rechaza antes de enviar.</li>
 *   <li>La respuesta se lee como bytes con un tope de tamaño y se decodifica SIEMPRE en UTF-8 (TheHive no declara
 *       charset). No se siguen redirecciones (no se reenviaría la key a otro sitio).</li>
 *   <li>Tiempos de espera de conexión y de lectura (también del cuerpo) y un máximo de consultas simultáneas.</li>
 *   <li>La validación TLS nunca se desactiva; un certificado no confiable da un mensaje claro.</li>
 *   <li>Los errores se traducen a {@link TheHiveException} con mensajes fijos: jamás incluyen la key.</li>
 * </ul>
 */
@Component
public class TheHiveClient {

    /** ÚNICA ruta de TheHive que usa este backend. Un test falla si aparece otra. */
    static final String RUTA_CONSULTA = "/api/v1/query";

    private static final Logger log = LoggerFactory.getLogger(TheHiveClient.class);
    private static final MediaType JSON_UTF8 = new MediaType("application", "json", StandardCharsets.UTF_8);
    private static final ExecutorService LECTORES = Executors.newVirtualThreadPerTaskExecutor();

    private final RestClient http;
    private final String clave;
    private final ObjectMapper mapper;
    private final long maxBytes;
    private final Duration timeoutLectura;
    private final Semaphore permisos;

    @Autowired
    public TheHiveClient(ConfiguracionTheHive configuracion, LimitesTheHive limites, ObjectMapper mapper) {
        this(configuracion, limites, mapper, RestClient.builder().requestFactory(crearFabrica(limites)));
    }

    /** Para las pruebas: permite enlazar un servidor simulado al constructor. */
    TheHiveClient(ConfiguracionTheHive configuracion, LimitesTheHive limites, ObjectMapper mapper, RestClient.Builder constructor) {
        this.mapper = mapper;
        this.clave = configuracion.apiKey();
        this.maxBytes = limites.maxRespuesta().toBytes();
        this.timeoutLectura = limites.timeoutLectura();
        this.permisos = new Semaphore(limites.maxConsultasSimultaneas(), true);

        String claveBearer = "Bearer " + configuracion.apiKey();
        String organizacion = configuracion.organizacion();
        this.http = constructor
                .baseUrl(configuracion.url().trim().replaceAll("/+$", ""))
                // Se SOBREESCRIBEN en cada petición: nada que venga de fuera puede cambiar la key ni la organización.
                .requestInterceptor((peticion, cuerpo, ejecucion) -> {
                    peticion.getHeaders().set(HttpHeaders.AUTHORIZATION, claveBearer);
                    peticion.getHeaders().set("X-Organisation", organizacion);
                    return ejecucion.execute(peticion, cuerpo);
                })
                .build();
    }

    private static JdkClientHttpRequestFactory crearFabrica(LimitesTheHive limites) {
        HttpClient cliente = HttpClient.newBuilder()
                .connectTimeout(limites.timeoutConexion())
                .followRedirects(HttpClient.Redirect.NEVER)   // no se reenvía la key a otro sitio
                .build();                                      // usa el almacén de certificados por defecto de Java
        var fabrica = new JdkClientHttpRequestFactory(cliente);
        fabrica.setReadTimeout(limites.timeoutLectura());
        return fabrica;
    }

    /**
     * Ejecuta una consulta de lectura y devuelve el JSON de la respuesta (un número para un {@code count}, un arreglo
     * para una lista, un objeto para una agregación).
     *
     * @throws ConsultaNoPermitidaException si la consulta usa algo fuera de la lista blanca (no se envía nada)
     * @throws TheHiveException             si TheHive no responde, rechaza las credenciales o la consulta, etc.
     */
    public JsonNode consultar(ConsultaTheHive consulta) {
        consulta.validar(); // la lista blanca se aplica SIEMPRE, también a lo construido con deOperaciones()

        byte[] cuerpo;
        try {
            cuerpo = mapper.writeValueAsBytes(consulta.cuerpo()); // UTF-8
        } catch (IOException e) {
            throw new ConsultaNoPermitidaException("La consulta no se puede convertir a JSON.");
        }
        if (log.isDebugEnabled()) {
            log.debug("Consulta a TheHive: {}", consulta.comoJson());
        }

        adquirirPermiso();
        long inicio = System.nanoTime();
        try {
            Respuesta respuesta = enviar(cuerpo);
            if (log.isDebugEnabled()) {
                log.debug("TheHive respondió HTTP {} ({} bytes) en {} ms", respuesta.codigo(), respuesta.bytes().length,
                        (System.nanoTime() - inicio) / 1_000_000);
            }
            return interpretar(respuesta);
        } catch (TheHiveException e) {
            log.warn("TheHive: {}", e.getMessage());
            throw e;
        } finally {
            permisos.release();
        }
    }

    /**
     * Agregación por campo. Si TheHive devuelve tantos valores como se pidieron (llegó al tope) se registra una
     * advertencia y {@link ResultadoAgregacion#truncada()} queda en {@code true}: no se trunca en silencio.
     */
    public ResultadoAgregacion consultarAgregacion(ConsultaTheHive consulta) {
        int tamano = consulta.tamanoAgregado();
        if (tamano < 1) {
            throw new ConsultaNoPermitidaException("consultarAgregacion necesita una agregación por campo con _size.");
        }
        ResultadoAgregacion resultado = ResultadoAgregacion.de(consultar(consulta), tamano);
        if (resultado.truncada()) {
            log.warn("La agregación por '{}' llegó al tope de {} valores: el resultado puede estar truncado.",
                    resultado.campo(), tamano);
        }
        return resultado;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Envío y lectura
    // ---------------------------------------------------------------------------------------------------------

    private record Respuesta(int codigo, byte[] bytes) {
    }

    private void adquirirPermiso() {
        try {
            permisos.acquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TheHiveNoRespondeException("TheHive no responde: la consulta fue interrumpida.");
        }
    }

    private Respuesta enviar(byte[] cuerpo) {
        try {
            return http.post()
                    .uri(RUTA_CONSULTA)
                    .contentType(JSON_UTF8)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(cuerpo)
                    .exchange((peticion, respuesta) -> leer(respuesta));
        } catch (TheHiveException e) {
            throw e;
        } catch (ResourceAccessException e) {
            throw traducirErrorDeRed(e);
        } catch (RestClientException e) {
            log.warn("TheHive: error del cliente HTTP ({})", resumenDeCausas(e));
            throw new TheHiveNoRespondeException("TheHive no responde: error de comunicación.");
        }
    }

    private Respuesta leer(ClientHttpResponse respuesta) throws IOException {
        int codigo = respuesta.getStatusCode().value();
        long declarado = respuesta.getHeaders().getContentLength();
        if (declarado > maxBytes) {
            throw demasiadoGrande();
        }
        return new Respuesta(codigo, leerAcotado(respuesta));
    }

    /** Lee el cuerpo con un tope de tamaño y un plazo total de lectura. */
    private byte[] leerAcotado(ClientHttpResponse respuesta) throws IOException {
        final long inicioLectura = System.nanoTime();
        CompletableFuture<byte[]> lectura = CompletableFuture.supplyAsync(() -> {
            try (InputStream entrada = respuesta.getBody()) {
                byte[] datos = entrada.readNBytes((int) maxBytes + 1);
                if (datos.length > maxBytes) {
                    throw demasiadoGrande();
                }
                return datos;
            } catch (IOException e) {
                throw new java.io.UncheckedIOException(e);
            }
        }, LECTORES);

        try {
            return lectura.get(timeoutLectura.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            respuesta.close(); // desbloquea la lectura
            lectura.cancel(true);
            throw new TheHiveNoRespondeException("TheHive no responde: se agotó el tiempo de espera.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TheHiveNoRespondeException("TheHive no responde: la consulta fue interrumpida.");
        } catch (ExecutionException e) {
            Throwable causa = e.getCause();
            if (causa instanceof TheHiveException tex) {
                throw tex;
            }
            if (causa instanceof java.io.UncheckedIOException uio) {
                // El JDK a veces corta la lectura con un IOException genérico justo al vencer el plazo: se informa
                // como lo que es (tiempo agotado) y no como "error de red".
                long transcurridoMs = (System.nanoTime() - inicioLectura) / 1_000_000;
                if (transcurridoMs >= timeoutLectura.toMillis() * 9 / 10) {
                    throw new TheHiveNoRespondeException("TheHive no responde: se agotó el tiempo de espera.");
                }
                throw uio.getCause();
            }
            throw new TheHiveRespuestaInvalidaException("No se pudo leer la respuesta de TheHive.");
        }
    }

    private TheHiveRespuestaInvalidaException demasiadoGrande() {
        return new TheHiveRespuestaInvalidaException("La respuesta de TheHive supera el máximo permitido ("
                + (maxBytes / (1024 * 1024)) + " MB) y se descartó.");
    }

    // ---------------------------------------------------------------------------------------------------------
    // Interpretación de la respuesta
    // ---------------------------------------------------------------------------------------------------------

    private JsonNode interpretar(Respuesta respuesta) {
        int codigo = respuesta.codigo();
        // TheHive no declara charset: los bytes se decodifican SIEMPRE como UTF-8.
        String texto = new String(respuesta.bytes(), StandardCharsets.UTF_8);

        if (codigo >= 200 && codigo < 300) {
            try {
                return mapper.readTree(texto);
            } catch (IOException e) {
                throw new TheHiveRespuestaInvalidaException("TheHive devolvió una respuesta que no es JSON válido.");
            }
        }
        if (codigo == 401 || codigo == 403) {
            throw new TheHiveCredencialesException();
        }
        if (codigo == 400) {
            throw new TheHiveConsultaInvalidaException(mensajeDeError(texto));
        }
        if (codigo >= 500) {
            throw new TheHiveNoRespondeException("TheHive respondió con un error del servidor (HTTP " + codigo + ").");
        }
        if (codigo >= 300 && codigo < 400) {
            throw new TheHiveRespuestaInvalidaException(
                    "TheHive respondió con una redirección (HTTP " + codigo + "); no se siguen redirecciones.");
        }
        throw new TheHiveRespuestaInvalidaException("TheHive respondió HTTP " + codigo + ".");
    }

    /** "tipo: mensaje" del error de TheHive, acotado y sin caracteres de control. Nunca incluye la consulta. */
    private String mensajeDeError(String texto) {
        try {
            JsonNode json = mapper.readTree(texto);
            String tipo = json.path("type").asText("");
            String mensaje = json.path("message").asText("");
            String completo = (tipo.isEmpty() ? "" : tipo + ": ") + mensaje;
            completo = completo.replaceAll("\\p{Cntrl}", " ").strip();
            if (clave != null && !clave.isBlank()) {
                completo = completo.replace(clave, "***"); // por si TheHive repitiera algo de la petición
            }
            if (completo.isEmpty()) {
                return "sin detalle";
            }
            return completo.length() > 300 ? completo.substring(0, 300) + "…" : completo;
        } catch (IOException e) {
            return "sin detalle";
        }
    }

    // ---------------------------------------------------------------------------------------------------------
    // Errores de red
    // ---------------------------------------------------------------------------------------------------------

    /** Traduce un fallo de red/TLS a una excepción propia con un mensaje claro. Visible para las pruebas. */
    static TheHiveException traducirErrorDeRed(Throwable error) {
        log.warn("TheHive: fallo de red ({})", resumenDeCausas(error));

        if (esProblemaDeCertificado(error)) {
            return new TheHiveCertificadoException();
        }
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof SSLException) {
                return new TheHiveCertificadoException("TheHive no es alcanzable: falló el handshake TLS "
                        + "(revisa que THEHIVE_URL use el esquema y el puerto correctos).");
            }
        }
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof HttpTimeoutException || t instanceof SocketTimeoutException || t instanceof TimeoutException) {
                return new TheHiveNoRespondeException("TheHive no responde: se agotó el tiempo de espera.");
            }
        }
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof ConnectException || t instanceof UnknownHostException || t instanceof java.nio.channels.ClosedChannelException) {
                return new TheHiveNoRespondeException("TheHive no responde: no se pudo conectar (¿Tailscale activo?).");
            }
        }
        return new TheHiveNoRespondeException("TheHive no responde: error de red.");
    }

    private static boolean esProblemaDeCertificado(Throwable error) {
        for (Throwable t = error; t != null; t = t.getCause()) {
            if (t instanceof CertPathBuilderException || t instanceof CertPathValidatorException || t instanceof CertificateException) {
                return true;
            }
            String mensaje = t.getMessage();
            if (mensaje != null && (mensaje.contains("PKIX path building failed")
                    || mensaje.contains("unable to find valid certification path"))) {
                return true;
            }
        }
        return false;
    }

    /** Solo nombres de clases (sin mensajes, que podrían traer detalles de la petición). */
    static String resumenDeCausas(Throwable error) {
        var unidos = new StringJoiner(" -> ");
        int profundidad = 0;
        for (Throwable t = error; t != null && profundidad < 8; t = t.getCause(), profundidad++) {
            unidos.add(t.getClass().getSimpleName());
        }
        return unidos.toString();
    }
}
