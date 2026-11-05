package co.edu.escuelaing.dashboard.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ConfiguracionTheHiveTest {

    private static final String CLAVE = "CLAVE-SECRETA-QUE-NO-DEBE-SALIR";

    @Test
    void laClaveNuncaApareceEnToString() {
        var cfg = new ConfiguracionTheHive("https://servidor.prueba.invalid", CLAVE, "escuelaing");

        assertThat(cfg.toString()).doesNotContain(CLAVE).contains("apiKey=********").contains("escuelaing");
        assertThat(("" + cfg)).doesNotContain(CLAVE);
        assertThat(String.format("%s", cfg)).doesNotContain(CLAVE);
    }

    @Test
    void siNoHayClaveLoDiceSinInventarNada() {
        assertThat(new ConfiguracionTheHive("https://x.invalid", null, "escuelaing").toString()).contains("(sin definir)");
        assertThat(new ConfiguracionTheHive("https://x.invalid", "  ", "escuelaing").hayClave()).isFalse();
        assertThat(new ConfiguracionTheHive("https://x.invalid", CLAVE, "escuelaing").hayClave()).isTrue();
    }
}
