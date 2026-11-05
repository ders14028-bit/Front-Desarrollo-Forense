package co.edu.escuelaing.dashboard.thehive.cliente;

/**
 * La consulta usa algo que el backend no permite (una operación fuera de la lista blanca, un operador de filtro no
 * admitido, una agregación sin tamaño…). Se lanza ANTES de enviar nada a TheHive: es un error de programación.
 */
public class ConsultaNoPermitidaException extends IllegalArgumentException {

    public ConsultaNoPermitidaException(String mensaje) {
        super(mensaje);
    }
}
