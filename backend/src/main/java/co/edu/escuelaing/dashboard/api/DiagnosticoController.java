package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.activos.CalculoActivos;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos;
import co.edu.escuelaing.dashboard.wazuh.DiagnosticoActivos;
import co.edu.escuelaing.dashboard.wazuh.SincronizacionWazuh;
import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * {@code GET /diagnostico/wazuh/activos}: qué datos de activos hay en la caché de Wazuh (solo nombres y conteos).
 *
 * <ul>
 *   <li>Apagado por defecto: solo existe con {@code dashboard.diagnostico=true}.</li>
 *   <li>Solo responde a peticiones desde la propia máquina (127.0.0.1 / ::1); a cualquier otra, 404.</li>
 *   <li>Fuera de {@code /api/**}: no tiene CORS, así que el frontend no lo puede leer desde el navegador.</li>
 * </ul>
 */
@RestController
@ConditionalOnProperty(name = "dashboard.diagnostico", havingValue = "true")
public class DiagnosticoController {

    private final SincronizacionWazuh sincronizacion;
    private final ConfiguracionActivos activos;

    public DiagnosticoController(SincronizacionWazuh sincronizacion, ConfiguracionActivos activos) {
        this.sincronizacion = sincronizacion;
        this.activos = activos;
    }

    @GetMapping("/diagnostico/wazuh/activos")
    public DiagnosticoActivos activos(HttpServletRequest peticion) {
        if (!esLocal(peticion.getRemoteAddr())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return DiagnosticoActivos.calcular(sincronizacion.instantanea(), sincronizacion.cargaInicialLista(),
                a -> ConfiguracionActivos.OTROS.equals(CalculoActivos.componenteDe(a.activo().grupos(), activos)),
                Set.copyOf(activos.gruposGenericos()));
    }

    /** Solo literales de loopback; nunca se resuelve un nombre por DNS. */
    static boolean esLocal(String direccion) {
        if (direccion == null || direccion.isBlank() || !direccion.matches("[0-9a-fA-F:.]+")) {
            return false;
        }
        try {
            return InetAddress.getByName(direccion).isLoopbackAddress();
        } catch (UnknownHostException e) {
            return false;
        }
    }
}
