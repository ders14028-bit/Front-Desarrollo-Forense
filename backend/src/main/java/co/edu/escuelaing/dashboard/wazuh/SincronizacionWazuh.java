package co.edu.escuelaing.dashboard.wazuh;

import co.edu.escuelaing.dashboard.dominio.Alerta;
import co.edu.escuelaing.dashboard.dominio.DiasBogota;
import co.edu.escuelaing.dashboard.resumen.ResumenGerencial.EstadoTheHive;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.ConsultaTheHive;
import co.edu.escuelaing.dashboard.thehive.cliente.Filtro;
import co.edu.escuelaing.dashboard.thehive.cliente.Orden;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveException;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Mantiene en memoria las alertas de Wazuh de los últimos N días (7) para calcular las métricas que salen del bloque
 * JSON de cada una (MITRE, cumplimiento, IP, usuario…), porque no se pueden releer miles de alertas en cada refresco.
 *
 * <ul>
 *   <li><b>Carga inicial</b> en segundo plano: páginas de {@code tamanoPagina} ordenadas por {@code _createdAt}
 *       ascendente, avanzando con un cursor (el último {@code _createdAt} visto). Reporta el progreso (cargadas / total
 *       contado al empezar). Si TheHive falla a mitad, el siguiente intento CONTINÚA desde el cursor.</li>
 *   <li><b>Incremental</b> cada 30 s: solo las creadas desde la última vista menos un solape de 60 s; las repetidas se
 *       descartan por {@code _id}.</li>
 *   <li>Se excluyen las simulaciones; lo que sale de la ventana se descarta.</li>
 *   <li>Una alerta sin bloque o con JSON roto se guarda como "sin bloque" y no rompe nada.</li>
 *   <li>Solo lectura: consultas {@code listAlert} con filtro, orden y página.</li>
 * </ul>
 */
@Component
public class SincronizacionWazuh {

    private static final Logger log = LoggerFactory.getLogger(SincronizacionWazuh.class);

    private final TheHiveClient thehive;
    private final ConsultasDashboard consultas;
    private final ConfiguracionWazuh configuracion;
    private final Clock reloj;

    private final Map<String, AlertaWazuh> almacen = new ConcurrentHashMap<>();

    // Estado de la sincronización: solo lo toca sincronizar(), que es synchronized.
    private boolean cargaInicialCompleta;
    private long cursor;
    private long ultimoCreado;

    // Lo que leen las peticiones.
    private volatile MetricasWazuh ultimasMetricas;
    private volatile Integer progreso;
    private volatile boolean hayIntento;
    private volatile boolean ultimoIntentoBueno = true;
    private volatile long ultimoIntentoMs;

    public SincronizacionWazuh(TheHiveClient thehive, ConsultasDashboard consultas, ConfiguracionWazuh configuracion, Clock reloj) {
        this.thehive = thehive;
        this.consultas = consultas;
        this.configuracion = configuracion;
        this.reloj = reloj;
    }

    /** Se programa con el refresco (cada 30 s, sin solaparse). Nunca lanza: un fallo se anota y se reintenta. */
    @Scheduled(fixedDelayString = "${dashboard.refresco.intervalo:30s}", initialDelay = 0)
    public void sincronizarEnSegundoPlano() {
        try {
            sincronizar();
        } catch (TheHiveException e) {
            marcarIntento(false);
            log.warn("Wazuh: no se pudo sincronizar ({}); {}", e.getMessage(),
                    cargaInicialCompleta ? "se sigue sirviendo lo último." : "la carga inicial continuará desde donde quedó.");
        } catch (RuntimeException e) {
            marcarIntento(false);
            log.error("Wazuh: error inesperado al sincronizar ({}).", e.getClass().getSimpleName());
        }
    }

    /** Una pasada: carga inicial (o su continuación) o incremental. Público para las pruebas. */
    public synchronized void sincronizar() {
        final long ahora = reloj.millis();
        final LocalDate primerDia = DiasBogota.ultimos(ahora, configuracion.diasVentana()).get(0);
        final long desde = DiasBogota.inicio(primerDia);
        final long hasta = ahora + 1;   // todas las páginas de esta pasada miran el mismo conjunto

        almacen.values().removeIf(a -> a.creadaEn() < desde);

        if (!cargaInicialCompleta) {
            long total = thehive.contar(alertasDeWazuh(Filtro.gte("_createdAt", desde), Filtro.lt("_createdAt", hasta)).count());
            if (cursor < desde) {
                cursor = desde;
            }
            traer(cursor, hasta, total);
            cargaInicialCompleta = true;
            log.info("Wazuh: carga inicial lista, {} alertas de los últimos {} días.", almacen.size(), configuracion.diasVentana());
        } else {
            long inicio = Math.max(desde, ultimoCreado - configuracion.solape().toMillis());
            traer(inicio, hasta, -1);
        }

        marcarIntento(true);
        ultimasMetricas = CalculoMetricasWazuh.calcular(almacen.values(), ahora, new EstadoTheHive(true, ahora),
                configuracion.diasVentana(), primerDia.toString(), configuracion.topN());
    }

    /**
     * Pide páginas ascendentes desde {@code desde} hasta agotarlas. El cursor avanza al último {@code _createdAt} visto
     * (las alertas con ese mismo instante se vuelven a pedir y se descartan por id). Si una página llena trae solo alertas
     * del instante del cursor (más alertas en el mismo milisegundo que el tamaño de página), avanza el desplazamiento dentro
     * de ese instante en vez del cursor: no se pierde ninguna ni se entra en un bucle.
     */
    private void traer(long desde, long hasta, long totalEsperado) {
        long cur = desde;
        int desplazamiento = 0;
        int tamano = configuracion.tamanoPagina();
        while (true) {
            List<JsonNode> pagina = thehive.listar(
                    alertasDeWazuh(Filtro.gte("_createdAt", cur), Filtro.lt("_createdAt", hasta))
                            .sort("_createdAt", Orden.ASCENDENTE).page(desplazamiento, desplazamiento + tamano));
            long maximo = cur;
            for (JsonNode nodo : pagina) {
                Alerta alerta = Alerta.desde(nodo);
                if (alerta.id().isEmpty()) {
                    continue;
                }
                maximo = Math.max(maximo, alerta.creadaEn());
                ultimoCreado = Math.max(ultimoCreado, alerta.creadaEn());
                almacen.putIfAbsent(alerta.id(), AlertaWazuh.de(alerta));
            }
            if (totalEsperado > 0) {
                actualizarProgreso(totalEsperado);
            }
            if (pagina.size() < tamano) {
                cursor = Math.max(cursor, maximo);
                return;
            }
            if (maximo <= cur) {
                desplazamiento += tamano;   // toda la página es del mismo instante: seguir dentro de él
            } else {
                cur = maximo;
                desplazamiento = 0;
            }
            cursor = cur;
        }
    }

    private void actualizarProgreso(long total) {
        long porcentaje = Math.min(99, almacen.size() * 100L / total);
        progreso = porcentaje >= 1 ? (int) porcentaje : null;   // nunca "0 %": mientras no llegue a 1 no se informa
    }

    private ConsultaTheHive alertasDeWazuh(Filtro... filtros) {
        Filtro[] todos = new Filtro[filtros.length + 1];
        todos[0] = Filtro.eq("type", configuracion.tipoAlerta());
        System.arraycopy(filtros, 0, todos, 1, filtros.length);
        return consultas.alertas(todos);
    }

    private void marcarIntento(boolean bueno) {
        hayIntento = true;
        ultimoIntentoBueno = bueno;
        ultimoIntentoMs = reloj.millis();
    }

    // ---------------------------------------------------------------------------------------------------------
    // Lo que se sirve
    // ---------------------------------------------------------------------------------------------------------

    /** Las métricas, o el estado "cargando" con su progreso mientras la carga inicial no termina. */
    public MetricasWazuh actual() {
        long ahora = reloj.millis();
        EstadoTheHive estado = new EstadoTheHive(!hayIntento || ultimoIntentoBueno, hayIntento ? ultimoIntentoMs : ahora);
        MetricasWazuh metricas = ultimasMetricas;
        if (metricas != null) {
            return metricas.conEstado(estado);
        }
        LocalDate primerDia = DiasBogota.ultimos(ahora, configuracion.diasVentana()).get(0);
        return MetricasWazuh.cargando(ahora, progreso, estado, configuracion.diasVentana(), primerDia.toString());
    }

    int alertasGuardadas() {
        return almacen.size();
    }
}
