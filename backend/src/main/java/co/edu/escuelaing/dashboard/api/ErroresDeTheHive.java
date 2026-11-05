package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.refresco.DatosNoDisponiblesException;
import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Si TheHive falla y no hay datos que ofrecer, el frontend recibe un 503 SIN cuerpo (solo usa el código y muestra su
 * propio mensaje en español). El detalle ya quedó en el log, sin cabeceras ni key.
 *
 * <p>Resumen y lista se sirven desde memoria: si TheHive cae después de haber respondido una vez, se sigue dando el
 * último dato bueno con {@code thehive.respondio = false} (200). El 503 sale solo si nunca hubo datos, o en el detalle
 * de una alerta, que sí consulta a TheHive en el momento.
 */
@RestControllerAdvice
public class ErroresDeTheHive {

    @ExceptionHandler({TheHiveException.class, DatosNoDisponiblesException.class})
    public ResponseEntity<Void> theHiveNoDisponible() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
    }
}
