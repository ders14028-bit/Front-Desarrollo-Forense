package co.edu.escuelaing.dashboard.alertas;

import co.edu.escuelaing.dashboard.alertas.ListaAlertas.AlertaFila;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas.CasoResumen;
import co.edu.escuelaing.dashboard.alertas.ListaAlertas.Composicion;
import co.edu.escuelaing.dashboard.config.ReglasNegocio;
import co.edu.escuelaing.dashboard.config.SlaMinutos;
import co.edu.escuelaing.dashboard.dominio.Alerta;
import co.edu.escuelaing.dashboard.dominio.Caso;
import co.edu.escuelaing.dashboard.dominio.DiasBogota;
import co.edu.escuelaing.dashboard.dominio.EstadoSla;
import co.edu.escuelaing.dashboard.dominio.TipoAmenaza;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.resumen.TacticasPorRegla;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.ConsultaTheHive;
import co.edu.escuelaing.dashboard.thehive.cliente.Filtro;
import co.edu.escuelaing.dashboard.thehive.cliente.Orden;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveConsultaInvalidaException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * La lista y el detalle de alertas (SOLO lectura).
 *
 * <p>Lista: las {@value #TOPE_RECIENTES} más recientes de los últimos {@value #DIAS_VENTANA} días (Bogotá) más TODAS las
 * críticas y altas sin atender de esa ventana, aunque sean más antiguas. {@code total} sale de un {@code count}; en
 * {@code composicion} se cuenta cuántas son recientes y cuántas se añadieron aparte.
 *
 * <p>Detalle: {@code getAlert}; TheHive responde 200 con resultado vacío si el id no existe, y eso es el 404.
 */
@Service
public class AlertasService {

    private static final Logger log = LoggerFactory.getLogger(AlertasService.class);
    private static final ExecutorService HILOS = Executors.newVirtualThreadPerTaskExecutor();
    private static final Pattern ID = Pattern.compile("^~?[A-Za-z0-9_-]{1,64}$");

    static final int DIAS_VENTANA = 30;
    static final int TOPE_RECIENTES = 1000;
    /** Páginas de 1000 que se piden como máximo para las críticas y altas sin atender más antiguas. */
    static final int MAX_PAGINAS_ADICIONALES = 5;
    private static final int CASOS_POR_CONSULTA = 50;

    private final TheHiveClient thehive;
    private final ConsultasDashboard consultas;
    private final SlaMinutos sla;
    private final ReglasNegocio reglas;
    private final TacticasPorRegla tacticas;
    private final Clock reloj;
    private final ObjectMapper mapper;

    public AlertasService(TheHiveClient thehive, ConsultasDashboard consultas, SlaMinutos sla, ReglasNegocio reglas,
                          TacticasPorRegla tacticas, Clock reloj, ObjectMapper mapper) {
        this.thehive = thehive;
        this.consultas = consultas;
        this.sla = sla;
        this.reglas = reglas;
        this.tacticas = tacticas;
        this.reloj = reloj;
        this.mapper = mapper;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Lista
    // ---------------------------------------------------------------------------------------------------------

    public ListaAlertas calcularLista() {
        final long ahora = reloj.millis();
        // Ventana de 30 días terminando en este instante: el total y las filas salen del mismo conjunto de alertas.
        final Filtro ventana = Filtro.and(
                Filtro.gte("_createdAt", DiasBogota.inicio(DiasBogota.ultimos(ahora, DIAS_VENTANA).get(0))),
                Filtro.lt("_createdAt", ahora + 1));

        var total = async(() -> thehive.contar(consultas.alertas(ventana).count()));
        var alertasDeLaboratorio = async(() -> thehive.contar(
                consultas.alertas(ventana, Filtro.eq("tags", reglas.etiquetaLaboratorio())).count()));
        var casosDeLaboratorio = async(() -> thehive.contar(consultas.casos(Filtro.eq("tags", reglas.etiquetaLaboratorio())).count()));
        List<Alerta> recientes = thehive.listar(
                        consultas.alertas(ventana).sort("_createdAt", Orden.DESCENDENTE).page(0, TOPE_RECIENTES))
                .stream().map(Alerta::desde).toList();
        long nTotal = esperar(total);

        List<Alerta> adicionales = recientes.size() >= TOPE_RECIENTES && nTotal > recientes.size()
                ? criticasYAltasSinAtenderMasAntiguas(ventana, recientes) : List.of();

        List<Alerta> todas = new ArrayList<>(recientes);
        todas.addAll(adicionales);
        todas.sort(Comparator.comparingLong(Alerta::creadaEn).reversed().thenComparing(Alerta::id));

        Map<String, CasoResumen> casos = casosDe(todas);
        List<AlertaFila> filas = todas.stream().map(a -> fila(a, ahora, casos)).toList();

        boolean laboratorio = esperar(alertasDeLaboratorio) > 0 || esperar(casosDeLaboratorio) > 0;
        return new ListaAlertas(ahora, nTotal, nTotal > filas.size(), laboratorio,
                new Composicion(recientes.size(), adicionales.size()), new EstadoTheHive(true, ahora), filas);
    }

    /** Críticas y altas sin atender de la ventana que NO están entre las recientes (son más antiguas que la última). */
    private List<Alerta> criticasYAltasSinAtenderMasAntiguas(Filtro ventana, List<Alerta> recientes) {
        long masAntiguaReciente = recientes.get(recientes.size() - 1).creadaEn();
        Set<String> yaIncluidas = new HashSet<>();
        recientes.forEach(a -> yaIncluidas.add(a.id()));

        List<Alerta> adicionales = new ArrayList<>();
        for (int pagina = 0; pagina < MAX_PAGINAS_ADICIONALES; pagina++) {
            List<JsonNode> lote = thehive.listar(consultas.alertas(
                            ventana,
                            Filtro.eq("status", Alerta.ESTADO_SIN_ATENDER),
                            Filtro.gte("severity", 3),
                            Filtro.lte("_createdAt", masAntiguaReciente))
                    .sort("_createdAt", Orden.DESCENDENTE)
                    .page(pagina * TOPE_RECIENTES, (pagina + 1) * TOPE_RECIENTES));
            for (JsonNode nodo : lote) {
                Alerta alerta = Alerta.desde(nodo);
                if (yaIncluidas.add(alerta.id())) {
                    adicionales.add(alerta);
                }
            }
            if (lote.size() < TOPE_RECIENTES) {
                return adicionales;
            }
        }
        log.warn("Hay más de {} críticas y altas sin atender más antiguas que las {} recientes: la lista no las trae todas.",
                MAX_PAGINAS_ADICIONALES * TOPE_RECIENTES, TOPE_RECIENTES);
        return adicionales;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Detalle
    // ---------------------------------------------------------------------------------------------------------

    /** El detalle de una alerta, o vacío si no existe (TheHive responde 200 con resultado vacío). */
    public Optional<DetalleAlerta> detalle(String id) {
        if (id == null || !ID.matcher(id).matches()) {
            return Optional.empty(); // un id así no puede existir en TheHive
        }
        final long ahora = reloj.millis();
        Optional<JsonNode> nodo = primero(thehive.consultar(ConsultaTheHive.getAlert(id)));
        if (nodo.isEmpty()) {
            return Optional.empty();
        }
        Alerta alerta = Alerta.desde(nodo.get());
        if (alerta.id().isEmpty()) {
            return Optional.empty();
        }

        Optional<JsonNode> caso = Optional.empty();
        if (alerta.tieneCaso()) {
            caso = primero(thehive.consultar(ConsultaTheHive.getCase(alerta.casoId())));
        }
        ObjectNode casoConTareas = null;
        CasoResumen resumen = null;
        if (alerta.tieneCaso()) {
            resumen = caso.map(c -> resumenDe(alerta.casoId(), Caso.desde(c))).orElse(new CasoResumen(alerta.casoId(), null, null, null));
        }
        if (caso.isPresent() && caso.get().isObject()) {
            casoConTareas = ((ObjectNode) caso.get()).deepCopy();
            JsonNode tareas = thehive.consultar(ConsultaTheHive.getCase(alerta.casoId()).tasks());
            casoConTareas.set("tareas", tareas.isArray() ? tareas : mapper.createArrayNode());
        }
        AlertaFila fila = fila(alerta, ahora, resumen == null ? Map.of() : Map.of(alerta.casoId(), resumen));
        return Optional.of(new DetalleAlerta(ahora, nodo.get(), fila, casoConTareas));
    }

    /** TheHive devuelve una lista de uno (o vacía); se acepta también un objeto suelto. */
    private static Optional<JsonNode> primero(JsonNode respuesta) {
        if (respuesta == null || respuesta.isNull()) {
            return Optional.empty();
        }
        if (respuesta.isArray()) {
            return respuesta.isEmpty() ? Optional.empty() : Optional.of(respuesta.get(0));
        }
        return respuesta.isObject() && respuesta.has("_id") ? Optional.of(respuesta) : Optional.empty();
    }

    // ---------------------------------------------------------------------------------------------------------
    // Filas
    // ---------------------------------------------------------------------------------------------------------

    AlertaFila fila(Alerta a, long ahora, Map<String, CasoResumen> casos) {
        CasoResumen caso = null;
        if (a.tieneCaso()) {
            caso = casos.getOrDefault(a.casoId(), new CasoResumen(a.casoId(), null, null, null));
        }
        return new AlertaFila(a.id(), a.creadaEn(), a.titulo(), a.severidad(), a.estado(), a.origen(), tipoDe(a),
                EstadoSla.antiguedadMs(a, ahora), EstadoSla.evaluar(a, ahora, sla), caso);
    }

    /** {@code escenario:} > táctica MITRE (del bloque de la propia alerta o, si no, de su regla en caché) > null. */
    private String tipoDe(Alerta a) {
        String escenario = TipoAmenaza.escenarioDe(a.etiquetas());
        if (escenario != null) {
            return escenario;
        }
        return TipoAmenaza.tacticaDe(a.descripcion())
                .or(() -> Optional.ofNullable(TipoAmenaza.reglaDe(a.etiquetas())).flatMap(tacticas::tactica))
                .orElse(null);
    }

    private static CasoResumen resumenDe(String id, Caso caso) {
        return new CasoResumen(id, caso.numero(), caso.etapa(), caso.estado());
    }

    /** Datos de los casos a los que apuntan las alertas ({@code caseId}); si un caso no se puede leer, solo trae su id. */
    private Map<String, CasoResumen> casosDe(List<Alerta> alertas) {
        Set<String> ids = new LinkedHashSet<>();
        alertas.stream().filter(Alerta::tieneCaso).forEach(a -> ids.add(a.casoId()));
        Map<String, CasoResumen> resultado = new HashMap<>();
        List<String> pendientes = new ArrayList<>(ids);
        for (int desde = 0; desde < pendientes.size(); desde += CASOS_POR_CONSULTA) {
            List<String> lote = pendientes.subList(desde, Math.min(desde + CASOS_POR_CONSULTA, pendientes.size()));
            Filtro[] porId = lote.stream().map(id -> Filtro.eq("_id", id)).toArray(Filtro[]::new);
            try {
                List<JsonNode> casos = thehive.listar(consultas.casos(porId.length == 1 ? porId[0] : Filtro.or(porId)).page(0, CASOS_POR_CONSULTA));
                for (JsonNode nodo : casos) {
                    Caso caso = Caso.desde(nodo);
                    resultado.put(caso.id(), resumenDe(caso.id(), caso));
                }
            } catch (TheHiveConsultaInvalidaException e) {
                log.warn("TheHive no aceptó buscar casos por _id; las filas traerán solo el id del caso. {}", e.getMessage());
            }
        }
        return resultado;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Concurrencia
    // ---------------------------------------------------------------------------------------------------------

    private static <T> CompletableFuture<T> async(Supplier<T> trabajo) {
        return CompletableFuture.supplyAsync(trabajo, HILOS);
    }

    private static <T> T esperar(CompletableFuture<T> futuro) {
        try {
            return futuro.join();
        } catch (CompletionException e) {
            if (e.getCause() instanceof RuntimeException causa) {
                throw causa;
            }
            throw e;
        }
    }
}
