package co.edu.escuelaing.dashboard.thehive.cliente;

/**
 * Error al hablar con TheHive. Los mensajes son FIJOS y seguros: nunca incluyen la API key, cabeceras ni el cuerpo de
 * la consulta. A propósito no se encadena la excepción original (la de la librería HTTP podría traer detalles de la
 * petición); el resumen de la causa se registra aparte, solo con nombres de clases.
 */
public abstract class TheHiveException extends RuntimeException {

    protected TheHiveException(String mensaje) {
        super(mensaje);
    }
}
