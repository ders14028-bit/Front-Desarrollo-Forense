package co.edu.escuelaing.dashboard.resumen;

import co.edu.escuelaing.dashboard.dominio.Alerta;
import co.edu.escuelaing.dashboard.dominio.TipoAmenaza;
import co.edu.escuelaing.dashboard.thehive.ConsultasDashboard;
import co.edu.escuelaing.dashboard.thehive.cliente.Filtro;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveClient;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Averigua la táctica MITRE de cada regla de Wazuh pidiendo UNA alerta de muestra por regla y la guarda en
 * {@link TacticasPorRegla}. La regla fija su MITRE, así que no hace falta leer miles de alertas.
 */
@Component
public class MuestreoDeTacticas {

    private static final Logger log = LoggerFactory.getLogger(MuestreoDeTacticas.class);
    private static final ExecutorService HILOS = Executors.newVirtualThreadPerTaskExecutor();

    /**
     * Máximo de reglas que se muestrean en una pasada (las demás, en la siguiente). Es alto a propósito: en el arranque en
     * frío se quiere muestrear TODAS las reglas de una vez para que "Sin clasificar" no cambie de un refresco a otro.
     */
    static final int MAX_MUESTRAS_POR_PASADA = 300;
    /** Alertas que se miran por regla hasta encontrar una con bloque de Wazuh legible. */
    private static final int ALERTAS_POR_MUESTRA = 3;

    private final TheHiveClient thehive;
    private final ConsultasDashboard consultas;
    private final TacticasPorRegla tacticas;

    public MuestreoDeTacticas(TheHiveClient thehive, ConsultasDashboard consultas, TacticasPorRegla tacticas) {
        this.thehive = thehive;
        this.consultas = consultas;
        this.tacticas = tacticas;
    }

    /** Muestrea las reglas cuya táctica no se conoce (hasta {@value #MAX_MUESTRAS_POR_PASADA} por pasada). */
    public void asegurar(Collection<String> reglasVistas) {
        List<String> pendientes = new ArrayList<>();
        for (String regla : reglasVistas) {
            if (!tacticas.sabe(regla)) {
                pendientes.add(regla);
            }
        }
        if (pendientes.isEmpty()) {
            return;
        }
        if (pendientes.size() > MAX_MUESTRAS_POR_PASADA) {
            log.info("{} reglas sin táctica conocida: se muestrean {} ahora y el resto en los siguientes refrescos.",
                    pendientes.size(), MAX_MUESTRAS_POR_PASADA);
            pendientes = pendientes.subList(0, MAX_MUESTRAS_POR_PASADA);
        }
        List<CompletableFuture<Void>> tareas = pendientes.stream()
                .map(regla -> CompletableFuture.runAsync(() -> muestrear(regla), HILOS))
                .toList();
        for (CompletableFuture<Void> tarea : tareas) {
            try {
                tarea.join();
            } catch (CompletionException e) {
                if (e.getCause() instanceof RuntimeException causa) {
                    throw causa;
                }
                throw e;
            }
        }
    }

    private void muestrear(String regla) {
        try {
            List<JsonNode> muestra = thehive.listar(
                    consultas.alertas(Filtro.eq("tags", TipoAmenaza.PREFIJO_REGLA + regla)).page(0, ALERTAS_POR_MUESTRA));
            if (muestra.isEmpty()) {
                return; // la regla no tiene alertas (carrera con el recuento): se reintenta en el próximo refresco
            }
            // La primera muestra que traiga un bloque de Wazuh legible manda; si ninguna lo trae, la regla no tiene táctica.
            Optional<String> tactica = Optional.empty();
            for (JsonNode nodo : muestra) {
                tactica = TipoAmenaza.tacticaDe(Alerta.desde(nodo).descripcion());
                if (tactica.isPresent()) {
                    break;
                }
            }
            if (tactica.isEmpty()) {
                // Si antes se supo la táctica y esta muestra no trae el bloque, se conserva la anterior: la regla no cambió.
                tactica = tacticas.tactica(regla);
            }
            tacticas.guardar(regla, tactica);
        } catch (TheHiveException e) {
            // Una muestra fallida no tumba el resumen: la regla queda sin dato y se reintenta en el próximo refresco.
            log.warn("No se pudo muestrear la regla {}: {}", regla, e.getMessage());
        }
    }
}
