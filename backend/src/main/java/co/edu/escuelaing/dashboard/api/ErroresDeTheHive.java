package co.edu.escuelaing.dashboard.api;

import co.edu.escuelaing.dashboard.thehive.cliente.TheHiveException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Si TheHive falla y no hay datos que ofrecer, el frontend recibe un 503 SIN cuerpo (solo usa el código y muestra su
 * propio mensaje en español). El detalle ya quedó en el log, sin cabeceras ni key.
 *
 * <p>Paso 6: con la caché de respaldo se responderá 200 con los últimos datos y {@code thehive.respondio = false}.
 */
@RestControllerAdvice
public class ErroresDeTheHive {

    @ExceptionHandler(TheHiveException.class)
    public ResponseEntity<Void> theHiveNoDisponible() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
    }
}
