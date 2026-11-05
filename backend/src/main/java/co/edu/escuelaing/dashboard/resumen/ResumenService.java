package co.edu.escuelaing.dashboard.resumen;

import co.edu.escuelaing.dashboard.config.ReglasNegocio;
import co.edu.escuelaing.dashboard.config.SlaMinutos;
import co.edu.escuelaing.dashboard.dominio.Alerta;
import co.edu.escuelaing.dashboard.dominio.Caso;
import co.edu.escuelaing.dashboard.dominio.DiasBogota;
import co.edu.escuelaing.dashboard.dominio.TipoAmenaza;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.AlertasConvertidas;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorDia;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorOrigen;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorSeveridad;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ConteoPorTipo;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ResumenAlertas;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.ResumenCasos;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.ConsultaTheHive;
import co.edu.escuelaing.dashboard.thehive.cliente.Filtro;
import co.edu.escuelaing.dashboard.thehive.cliente.Orden;
import co.edu.escuelaing.dashboard.thehive.cliente.ResultadoAgregacion;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveException;
import com.fasterxml.jackson.databind.JsonNode;
import java.text.Collator;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Calcula el resumen gerencial consultando a TheHive (SOLO lectura). Cada cifra sale de una consulta del servidor
 * (count, agregación, avg), nunca del largo de una lista paginada ni de leer las 23.000 alertas:
 * <ul>
 *   <li>Convertidas en caso = {@code status = Imported} (NUNCA {@code _has case}: devuelve todas las alertas).</li>
 *   <li>Las agregaciones por campo piden {@code _size} 1000; si llegan al tope se avisa en el log.</li>
 *   <li>Antigüedad promedio = {@code ahora − avg(_createdAt)} de las {@code New}.</li>
 *   <li>Los días son de Bogotá con {@code _gte}/{@code _lt}; los pasados se guardan hasta la medianoche.</li>
 *   <li>Se excluyen las alertas {@code type = simulacion} salvo que la configuración diga otra cosa.</li>
 *   <li>Tipo de amenaza: {@code escenario:} > táctica MITRE de la regla (una alerta de muestra por regla, en caché)
 *       > sin clasificar.</li>
 * </ul>
 * Las consultas independientes se lanzan en paralelo; el cliente limita cuántas viajan a la vez.
 */
@Service
public class ResumenService {

    private static final Logger log = LoggerFactory.getLogger(ResumenService.class);
    private static final ExecutorService HILOS = Executors.newVirtualThreadPerTaskExecutor();
    private static final long MS_POR_MINUTO = 60_000L;

    /** Días de la serie "alertas por día". */
    static final int DIAS_SERIE = 30;
    private static final int TOPE_CASOS_CERRADOS = 1000;

    private final TheHiveClient thehive;
    private final SlaMinutos sla;
    private final ReglasNegocio reglas;
    private final Clock reloj;
    private final ConteosPorDia conteosPorDia;
    private final TacticasPorRegla tacticas;
    private final MuestreoDeTacticas muestreo;
    private final ConsultasDashboard consultas;

    public ResumenService(TheHiveClient thehive, SlaMinutos sla, ReglasNegocio reglas, Clock reloj,
                          ConteosPorDia conteosPorDia, TacticasPorRegla tacticas, MuestreoDeTacticas muestreo,
                          ConsultasDashboard consultas) {
        this.thehive = thehive;
        this.sla = sla;
        this.reglas = reglas;
        this.reloj = reloj;
        this.conteosPorDia = conteosPorDia;
        this.tacticas = tacticas;
        this.muestreo = muestreo;
        this.consultas = consultas;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Cálculo
    // ---------------------------------------------------------------------------------------------------------

    public ResumenGerencial calcular() {
        final long ahora = reloj.millis();
        final List<LocalDate> dias = DiasBogota.ultimos(ahora, DIAS_SERIE);
        // Todas las consultas de alertas miran el MISMO conjunto: las creadas antes de este instante. Así, aunque lleguen
        // alertas mientras se calcula, las cifras cuadran entre sí (por ejemplo, tipos + sin clasificar = recibidas).
        final Filtro hasta = Filtro.lt("_createdAt", ahora + 1);
        conteosPorDia.podar(dias.get(0));

        final Filtro sinAtender = Filtro.eq("status", Alerta.ESTADO_SIN_ATENDER);

        // --- alertas ---
        var recibidas = async(() -> thehive.contar(alertas(hasta).count()));
        var sinAtenderN = async(() -> thehive.contar(alertas(hasta, sinAtender).count()));
        var criticasYAltas = async(() -> thehive.contar(alertas(hasta, Filtro.gte("severity", 3)).count()));
        var masAntigua = async(() -> primeraCreada(alertas(hasta, sinAtender).sort("_createdAt", Orden.ASCENDENTE).page(0, 1)));
        var promedioCreada = async(() -> promedioCreada(alertas(hasta, sinAtender).promedioDe("_createdAt")));
        var fueraDeSla = new ArrayList<CompletableFuture<Long>>();
        for (int severidad = 1; severidad <= 4; severidad++) {
            final int s = severidad;
            final long limite = ahora - sla.porSeveridad(s) * MS_POR_MINUTO;
            // Fuera de SLA = antigüedad ESTRICTAMENTE mayor que el SLA => _createdAt estrictamente menor que (ahora − SLA).
            fueraDeSla.add(async(() -> thehive.contar(alertas(hasta, sinAtender, Filtro.eq("severity", s), Filtro.lt("_createdAt", limite)).count())));
        }
        var porSeveridad = async(() -> thehive.consultarAgregacion(alertas(hasta).agregarPorCampo("severity")));
        var porOrigen = async(() -> thehive.consultarAgregacion(alertas(hasta).agregarPorCampo("source")));

        // --- tipo de amenaza ---
        Filtro conEscenario = Filtro.like("tags", TipoAmenaza.PREFIJO_ESCENARIO + "*");
        var alertasConEscenario = async(() -> thehive.contar(alertas(hasta, conEscenario).count()));
        var etiquetasConEscenario = async(() -> thehive.consultarAgregacion(alertas(hasta, conEscenario).agregarPorCampo("tags")));
        var etiquetasSinEscenario = async(() -> thehive.consultarAgregacion(alertas(hasta, Filtro.not(conEscenario)).agregarPorCampo("tags")));

        // --- alertas por día ---
        var porDia = new ArrayList<CompletableFuture<ConteoPorDia>>();
        for (LocalDate dia : dias) {
            porDia.add(async(() -> new ConteoPorDia(dia.toString(), alertasDelDia(dia, ahora))));
        }

        // --- aviso de laboratorio y casos ---
        // Laboratorio = hay alertas con type = simulacion (el mismo criterio del filtro). La etiqueta no cuenta.
        var alertasDeLaboratorio = async(() -> consultas.incluyeSimulaciones()
                ? thehive.contar(consultas.alertasSimuladas(hasta).count()) : 0L);
        var reportados = async(() -> thehive.contar(casos().count()));
        var abiertos = async(() -> thehive.contar(casos(Filtro.eq("stage", reglas.etapaCasoNuevo())).count()));
        var enProgreso = async(() -> thehive.contar(casos(Filtro.eq("stage", reglas.etapaCasoEnProgreso())).count()));
        var cerrados = async(() -> thehive.contar(casos(Filtro.eq("stage", reglas.etapaCasoCerrado())).count()));
        var convertidas = async(() -> thehive.contar(alertas(hasta, Filtro.eq("status", Alerta.ESTADO_CONVERTIDA)).count()));
        var contenciones = async(() -> thehive.contar(ConsultaTheHive.listTask()
                .filter(Filtro.and(Filtro.eq("group", reglas.grupoContencion()), Filtro.eq("status", reglas.estadoTareaCompletada())))
                .count()));
        var confirmados = async(() -> thehive.contar(casos(
                Filtro.eq("stage", reglas.etapaCasoCerrado()), Filtro.eq("status", reglas.estadoCasoConfirmado())).count()));

        // --- unir ---
        long nRecibidas = esperar(recibidas);
        long nSinAtender = esperar(sinAtenderN);

        Long antiguaMs = esperar(masAntigua).map(creada -> Math.max(0, ahora - creada)).orElse(null);
        Long promedioMs = nSinAtender == 0 ? null : esperar(promedioCreada).stream()
                .mapToLong(media -> Math.max(0, ahora - Math.round(media))).boxed().findFirst().orElse(null);
        long nFueraDeSla = fueraDeSla.stream().mapToLong(ResumenService::esperar).sum();

        var tipos = clasificarTipos(nRecibidas, esperar(alertasConEscenario), esperar(etiquetasConEscenario),
                esperar(etiquetasSinEscenario));

        var alertasResumen = new ResumenAlertas(
                nRecibidas, nSinAtender, esperar(criticasYAltas), antiguaMs, promedioMs, nFueraDeSla,
                severidades(esperar(porSeveridad)), tipos.porTipo(), tipos.sinClasificar(), origenes(esperar(porOrigen)),
                porDia.stream().map(ResumenService::esperar).toList());

        long nCerrados = esperar(cerrados);
        long nConvertidas = esperar(convertidas);
        var casosResumen = new ResumenCasos(
                esperar(reportados), esperar(abiertos), esperar(enProgreso), nCerrados,
                new AlertasConvertidas(nConvertidas, nRecibidas, nRecibidas == 0 ? null : nConvertidas * 100.0 / nRecibidas),
                esperar(contenciones), esperar(confirmados),
                nCerrados == 0 ? null : tiempoPromedioDeCierre());

        boolean laboratorio = esperar(alertasDeLaboratorio) > 0;
        return new ResumenGerencial(ahora, laboratorio, alertasResumen, casosResumen, new EstadoTheHive(true, ahora));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Consultas
    // ---------------------------------------------------------------------------------------------------------

    private ConsultaTheHive alertas(Filtro... filtros) {
        return consultas.alertas(filtros);
    }

    private ConsultaTheHive casos(Filtro... filtros) {
        return consultas.casos(filtros);
    }

    private long alertasDelDia(LocalDate dia, long ahora) {
        final Filtro hasta = Filtro.lt("_createdAt", ahora + 1);
        boolean esHoy = dia.equals(DiasBogota.dia(ahora));
        if (!esHoy) {
            Optional<Long> guardado = conteosPorDia.guardado(dia, ahora);
            if (guardado.isPresent()) {
                return guardado.get();
            }
        }
        long cantidad = thehive.contar(alertas(hasta, 
                Filtro.gte("_createdAt", DiasBogota.inicio(dia)),
                Filtro.lt("_createdAt", DiasBogota.inicio(dia.plusDays(1)))).count());
        conteosPorDia.guardar(dia, cantidad, ahora);
        return cantidad;
    }

    private Optional<Long> primeraCreada(ConsultaTheHive consulta) {
        List<JsonNode> primera = thehive.listar(consulta);
        if (primera.isEmpty() || !primera.get(0).path("_createdAt").isNumber()) {
            return Optional.empty();
        }
        return Optional.of(primera.get(0).path("_createdAt").asLong());
    }

    /** {@code avg(_createdAt)}; si TheHive responde con una forma que no se reconoce se avisa y la cifra queda en null. */
    private Optional<Double> promedioCreada(ConsultaTheHive consulta) {
        OptionalDouble media = primerNumero(thehive.consultar(consulta));
        if (media.isEmpty()) {
            log.warn("La respuesta de avg(_createdAt) no trae un número reconocible: la antigüedad promedio queda sin dato.");
            return Optional.empty();
        }
        return Optional.of(media.getAsDouble());
    }

    /** Primer número de una respuesta de agregación, buscando antes en los campos que se llaman "avg". */
    static OptionalDouble primerNumero(JsonNode nodo) {
        if (nodo == null || nodo.isNull() || nodo.isMissingNode()) {
            return OptionalDouble.empty();
        }
        if (nodo.isNumber()) {
            return OptionalDouble.of(nodo.asDouble());
        }
        if (nodo.isObject()) {
            for (var campo : nodo.properties()) {
                if (campo.getKey().toLowerCase(Locale.ROOT).contains("avg")) {
                    OptionalDouble r = primerNumero(campo.getValue());
                    if (r.isPresent()) {
                        return r;
                    }
                }
            }
        }
        for (JsonNode hijo : nodo) {
            OptionalDouble r = primerNumero(hijo);
            if (r.isPresent()) {
                return r;
            }
        }
        return OptionalDouble.empty();
    }

    private Long tiempoPromedioDeCierre() {
        List<JsonNode> cerrados = thehive.listar(casos(Filtro.eq("stage", reglas.etapaCasoCerrado())).page(0, TOPE_CASOS_CERRADOS));
        if (cerrados.size() >= TOPE_CASOS_CERRADOS) {
            log.warn("Hay {} o más casos cerrados: el tiempo promedio de cierre se calcula con los primeros {}.",
                    TOPE_CASOS_CERRADOS, TOPE_CASOS_CERRADOS);
        }
        // Sin fecha de cierre no se puede medir la duración: ese caso no entra en el promedio.
        List<Long> duraciones = cerrados.stream().map(Caso::desde).map(Caso::duracionMs).filter(d -> d != null).toList();
        if (duraciones.isEmpty()) {
            return null;
        }
        return Math.round(duraciones.stream().mapToLong(Long::longValue).average().orElse(0));
    }

    // ---------------------------------------------------------------------------------------------------------
    // Armado de las listas
    // ---------------------------------------------------------------------------------------------------------

    private static List<ConteoPorSeveridad> severidades(ResultadoAgregacion agregacion) {
        Map<String, Long> porClave = new HashMap<>();
        agregacion.cubetas().forEach(c -> porClave.merge(c.clave(), c.cantidad(), Long::sum));
        List<ConteoPorSeveridad> lista = new ArrayList<>();
        for (int severidad = 4; severidad >= 1; severidad--) {
            lista.add(new ConteoPorSeveridad(severidad, porClave.getOrDefault(String.valueOf(severidad), 0L)));
        }
        return lista;
    }

    private static List<ConteoPorOrigen> origenes(ResultadoAgregacion agregacion) {
        Comparator<ResultadoAgregacion.Cubeta> orden = Comparator.comparingLong(ResultadoAgregacion.Cubeta::cantidad).reversed()
                .thenComparing(ResultadoAgregacion.Cubeta::clave, collator());
        return agregacion.cubetas().stream().sorted(orden).map(c -> new ConteoPorOrigen(c.clave(), c.cantidad())).toList();
    }

    private static Comparator<String> collator() {
        Collator es = Collator.getInstance(Locale.forLanguageTag("es"));
        return es::compare;
    }

    private record Tipos(List<ConteoPorTipo> porTipo, long sinClasificar) {
    }

    /**
     * {@code escenario:} > táctica MITRE de la regla > sin clasificar.
     *
     * @param conEscenario alertas que tienen alguna etiqueta {@code escenario:}
     * @param conEtiquetas etiquetas (con su recuento) de esas alertas
     * @param sinEtiquetas etiquetas (con su recuento) de las alertas SIN {@code escenario:}: de ahí salen sus reglas
     */
    private Tipos clasificarTipos(long recibidas, long conEscenario, ResultadoAgregacion conEtiquetas, ResultadoAgregacion sinEtiquetas) {
        Map<String, Long> porTipo = new HashMap<>();

        // 1. Escenario.
        for (var cubeta : conEtiquetas.cubetas()) {
            if (cubeta.clave().startsWith(TipoAmenaza.PREFIJO_ESCENARIO)) {
                String tipo = cubeta.clave().substring(TipoAmenaza.PREFIJO_ESCENARIO.length()).strip();
                if (!tipo.isEmpty()) {
                    porTipo.merge(tipo, cubeta.cantidad(), Long::sum);
                }
            }
        }

        // 2. Táctica MITRE de la regla, para las alertas sin escenario.
        Map<String, Long> porRegla = new HashMap<>();
        for (var cubeta : sinEtiquetas.cubetas()) {
            if (cubeta.clave().startsWith(TipoAmenaza.PREFIJO_REGLA)) {
                String regla = cubeta.clave().substring(TipoAmenaza.PREFIJO_REGLA.length()).strip();
                if (!regla.isEmpty()) {
                    porRegla.merge(regla, cubeta.cantidad(), Long::sum);
                }
            }
        }
        muestreo.asegurar(porRegla.keySet());
        long conTactica = 0;
        for (var regla : porRegla.entrySet()) {
            Optional<String> tactica = tacticas.tactica(regla.getKey());
            if (tactica.isPresent()) {
                porTipo.merge(tactica.get(), regla.getValue(), Long::sum);
                conTactica += regla.getValue();
            }
        }

        // 3. Lo demás queda sin clasificar.
        long sinEscenario = Math.max(0, recibidas - conEscenario);
        long sinClasificar = Math.max(0, sinEscenario - conTactica);

        List<ConteoPorTipo> lista = porTipo.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey(collator())))
                .map(e -> new ConteoPorTipo(e.getKey(), e.getValue()))
                .toList();
        return new Tipos(lista, sinClasificar);
    }

    // ---------------------------------------------------------------------------------------------------------
    // Concurrencia
    // ---------------------------------------------------------------------------------------------------------

    private static <T> CompletableFuture<T> async(Supplier<T> trabajo) {
        return CompletableFuture.supplyAsync(trabajo, HILOS);
    }

    /** Espera un resultado y relanza la excepción ORIGINAL (por ejemplo, un {@link TheHiveException}). */
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
