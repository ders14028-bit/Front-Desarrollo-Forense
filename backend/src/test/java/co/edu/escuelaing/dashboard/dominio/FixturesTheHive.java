package co.edu.escuelaing.dashboard.dominio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/** Carga las alertas anonimizadas de {@code src/test/resources/thehive/alertas.json}. */
public final class FixturesTheHive {

    private static final ObjectMapper JSON = new ObjectMapper();

    private FixturesTheHive() {
    }

    public static List<JsonNode> alertasCrudas() {
        try (InputStream entrada = FixturesTheHive.class.getResourceAsStream("/thehive/alertas.json")) {
            List<JsonNode> alertas = new ArrayList<>();
            JSON.readTree(entrada).forEach(alertas::add);
            return alertas;
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer el fixture de alertas", e);
        }
    }

    public static List<Alerta> alertas() {
        return alertasCrudas().stream().map(Alerta::desde).toList();
    }

    /** La alerta de Wazuh con esa regla (tag {@code regla:<id>}). */
    public static Alerta deRegla(String reglaId) {
        return alertas().stream()
                .filter(a -> a.etiquetas().contains("regla:" + reglaId))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("El fixture no tiene la regla " + reglaId));
    }

    public static JsonNode json(String texto) {
        try {
            return JSON.readTree(texto);
        } catch (IOException e) {
            throw new IllegalArgumentException(e);
        }
    }
}
