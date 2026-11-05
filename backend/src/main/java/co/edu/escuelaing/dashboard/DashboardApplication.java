package co.edu.escuelaing.dashboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Backend del Dashboard SOC. Es el ÚNICO que habla con TheHive y lo hace en modo SOLO LECTURA.
 * La API key de TheHive solo sale de la variable de entorno THEHIVE_API_KEY.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class DashboardApplication {

    public static void main(String[] args) {
        SpringApplication.run(DashboardApplication.class, args);
    }
}
