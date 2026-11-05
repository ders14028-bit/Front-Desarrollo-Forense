package co.edu.escuelaing.dashboard.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

class LimitesTheHiveTest {

    @Test
    void sinValoresUsaLosAcordados() {
        var limites = new LimitesTheHive(null, null, null, null);

        assertThat(limites.timeoutConexion()).isEqualTo(Duration.ofSeconds(5));
        assertThat(limites.timeoutLectura()).isEqualTo(Duration.ofSeconds(15));
        assertThat(limites.maxRespuesta()).isEqualTo(DataSize.ofMegabytes(20));
        assertThat(limites.maxConsultasSimultaneas()).isEqualTo(4);
    }

    @Test
    void rechazaValoresAbsurdos() {
        assertThatThrownBy(() -> new LimitesTheHive(Duration.ZERO, null, null, null)).isInstanceOf(ConfiguracionInvalidaException.class);
        assertThatThrownBy(() -> new LimitesTheHive(null, Duration.ofSeconds(-1), null, null)).isInstanceOf(ConfiguracionInvalidaException.class);
        assertThatThrownBy(() -> new LimitesTheHive(null, null, DataSize.ofBytes(0), null)).isInstanceOf(ConfiguracionInvalidaException.class);
        assertThatThrownBy(() -> new LimitesTheHive(null, null, DataSize.ofGigabytes(3), null)).isInstanceOf(ConfiguracionInvalidaException.class);
        assertThatThrownBy(() -> new LimitesTheHive(null, null, null, 0)).isInstanceOf(ConfiguracionInvalidaException.class);
        assertThatThrownBy(() -> new LimitesTheHive(null, null, null, 33)).isInstanceOf(ConfiguracionInvalidaException.class);
    }
}
