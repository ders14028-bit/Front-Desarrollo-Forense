package co.edu.escuelaing.dashboard.thehive.cliente;

import co.edu.escuelaing.dashboard.config.ConfiguracionTheHive;
import co.edu.escuelaing.dashboard.config.LimitesTheHive;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** Cliente de TheHive enlazado a un servidor SIMULADO: las pruebas nunca llaman al TheHive real. */
final class ClienteDePrueba {

    static final String CLAVE = "CLAVE-SECRETA-QUE-NO-DEBE-SALIR";
    static final String URL = "https://thehive.prueba.invalid:8445";
    static final String ORGANIZACION = "escuelaing-prueba";
    static final String RUTA = URL + "/api/v1/query";

    final MockRestServiceServer servidor;
    final TheHiveClient cliente;

    private ClienteDePrueba(MockRestServiceServer servidor, TheHiveClient cliente) {
        this.servidor = servidor;
        this.cliente = cliente;
    }

    static ClienteDePrueba conLimitesPorDefecto() {
        return con(new LimitesTheHive(null, null, null, null));
    }

    static ClienteDePrueba con(LimitesTheHive limites) {
        return con(limites, RestClient.builder());
    }

    /** Permite partir de un constructor con cabeceras por defecto "hostiles" para probar que se sobreescriben. */
    static ClienteDePrueba con(LimitesTheHive limites, RestClient.Builder constructor) {
        MockRestServiceServer servidor = MockRestServiceServer.bindTo(constructor).ignoreExpectOrder(true).build();
        var cliente = new TheHiveClient(new ConfiguracionTheHive(URL, CLAVE, ORGANIZACION), limites, new ObjectMapper(), constructor);
        return new ClienteDePrueba(servidor, cliente);
    }

    static TheHiveClient contraServidorReal(String url, LimitesTheHive limites) {
        return new TheHiveClient(new ConfiguracionTheHive(url, CLAVE, ORGANIZACION), limites, new ObjectMapper());
    }
}
