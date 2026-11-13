package co.edu.escuelaing.dashboard.activos;

import static org.assertj.core.api.Assertions.assertThat;

import co.edu.escuelaing.dashboard.activos.ActivosAtacados.Activo;
import co.edu.escuelaing.dashboard.activos.ActivosAtacados.AtaqueReciente;
import co.edu.escuelaing.dashboard.activos.ActivosAtacados.ConteoComponente;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos.Componente;
import co.edu.escuelaing.dashboard.activos.ConfiguracionActivos.Entrada;
import co.edu.escuelaing.dashboard.dominio.FixturesTheHive;
import co.edu.escuelaing.dashboard.wazuh.AlertaWazuh;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class CalculoActivosTest {

    /** La misma tabla que application.yml (ActivosControllerTest comprueba que el archivo la trae igual). */
    public static final List<Componente> COMPONENTES = List.of(
            new Componente("base-de-datos", List.of("mariadb_lab", "mysql", "mssql", "postgresql"), null),
            new Componente("servidor-web", List.of("web_server_lab", "lab_webserver", "apache", "nginx", "web"), null),
            new Componente("ssh", List.of("sshd"), null),
            new Componente("inicio-sesion-windows", List.of("windows_security"), null),
            new Componente("procesos-windows", List.of("sysmon"), List.of("sysmon_")),
            new Componente("sistema-windows", List.of("windows_application", "windows_system", "WEF", "win_evt_channel"), null),
            new Componente("cuentas-permisos", List.of("pam", "sudo", "adduser"), null),
            new Componente("auditoria", List.of("audit", "audit_selinux", "audit_configuration", "apparmor"), null),
            new Componente("vulnerabilidades", List.of("vulnerability-detector", "dpkg"), null),
            new Componente("integridad", List.of("rootcheck", "syscheck"), null),
            new Componente("monitoreo-wazuh", List.of("ossec"), null));
    public static final List<String> GENERICOS = List.of("syslog", "authentication_failed", "invalid_login", "authentication_success",
            "authentication_failures", "config_changed", "access_control", "local", "system_error", "time_changed", "stats", "errors");

    static ConfiguracionActivos config(Entrada... inventario) {
        return new ConfiguracionActivos(List.of(inventario), COMPONENTES, GENERICOS);
    }

    private static AlertaWazuh alerta(String id, String agenteId, String agente, int severidad, String ubicacion, String... grupos) {
        return new AlertaWazuh(id, 1L, true, "1", 3, "x", List.of(), List.of(), Map.of(), "192.0.2.9", "usuario-09", agente,
                new AlertaWazuh.Activo("wazuh", agenteId, null, ubicacion, List.of(grupos), severidad));
    }

    private static Activo activo(CalculoActivos.Resultado r, String equipo) {
        return r.activos().stream().filter(a -> equipo.equals(a.equipo())).findFirst().orElseThrow();
    }

    // ---- componentes ----

    @Test
    void ganaElPrimerComponenteDeLaTablaNoElPrimerGrupoDeLaAlerta() {
        var c = config();
        assertThat(CalculoActivos.componenteDe(List.of("sshd", "mariadb_lab"), c)).isEqualTo("base-de-datos");
        assertThat(CalculoActivos.componenteDe(List.of("pam", "windows_security"), c)).isEqualTo("inicio-sesion-windows");
        assertThat(CalculoActivos.componenteDe(List.of("ossec", "syscheck"), c)).isEqualTo("integridad");
        assertThat(CalculoActivos.componenteDe(List.of("windows", "sysmon_event1"), c)).isEqualTo("procesos-windows");
        assertThat(CalculoActivos.componenteDe(List.of("windows", " WEF"), c)).isEqualTo("sistema-windows");
    }

    @Test
    void losGruposGenericosNoDefinenComponente() {
        var c = config();
        assertThat(CalculoActivos.componenteDe(List.of("syslog", "authentication_failed", "invalid_login"), c)).isEqualTo("otros");
        assertThat(CalculoActivos.componenteDe(List.of("syslog", "sshd", "authentication_failed"), c)).isEqualTo("ssh");
        assertThat(CalculoActivos.componenteDe(List.of(), c)).isEqualTo("otros");
        // aunque alguien ponga un genérico en la tabla, no cuenta
        var mal = new ConfiguracionActivos(List.of(), List.of(new Componente("x", List.of("syslog"), null)), GENERICOS);
        assertThat(CalculoActivos.componenteDe(List.of("syslog"), mal)).isEqualTo("otros");
    }

    // ---- activos ----

    @Test
    void conLosFixturesAnonimizados() {
        List<AlertaWazuh> alertas = FixturesTheHive.alertas().stream()
                .filter(a -> "wazuh".equals(a.tipo())).map(AlertaWazuh::de).toList();
        var c = config(new Entrada("000", "equipo-03", "monitoreo", "Servidor de monitoreo (Wazuh)", "Linux"));

        var r = CalculoActivos.calcular(alertas, c);

        Activo monitoreo = activo(r, "equipo-03");
        assertThat(monitoreo.nombreVisible()).isEqualTo("Servidor de monitoreo (Wazuh)");
        assertThat(monitoreo.tipo()).isEqualTo("monitoreo");
        assertThat(monitoreo.componentes()).extracting(ConteoComponente::clave).contains("ssh", "cuentas-permisos");

        // 005 / equipo-02 no está en el inventario: sale igual, sin clasificar y con el sistema deducido (EventChannel)
        Activo desconocido = activo(r, "equipo-02");
        assertThat(desconocido.agenteId()).isEqualTo("005");
        assertThat(desconocido.tipo()).isEqualTo("sin-clasificar");
        assertThat(desconocido.nombreVisible()).isEqualTo("equipo-02");
        assertThat(desconocido.sistema()).isEqualTo("Windows");
        assertThat(desconocido.componentes()).extracting(ConteoComponente::clave)
                .contains("inicio-sesion-windows", "sistema-windows", "monitoreo-wazuh");

        int total = r.activos().stream().mapToInt(Activo::alertas).sum();
        assertThat(total + r.alertasSinActivo()).isEqualTo(alertas.size());
        for (Activo a : r.activos()) {
            assertThat(a.componentes().stream().mapToInt(ConteoComponente::alertas).sum()).isEqualTo(a.alertas());
            assertThat(a.componentes().stream().mapToInt(ConteoComponente::altasYCriticas).sum()).isEqualTo(a.altasYCriticas());
        }
    }

    @Test
    void sumaDeComponentesIgualALasAlertasYPrincipalElMayor() {
        var c = config(new Entrada("003", "srv-db", "base-de-datos", "Servidor de base de datos", "Linux"));
        var r = CalculoActivos.calcular(List.of(
                alerta("1", "003", "srv-db", 4, "journald", "mariadb_lab", "syslog"),
                alerta("2", "003", "srv-db", 3, "journald", "mariadb_lab"),
                alerta("3", "003", "srv-db", 2, "journald", "sshd", "authentication_failed"),
                alerta("4", "003", "srv-db", 1, "journald", "syslog")), c);

        Activo db = r.activos().get(0);
        assertThat(db.alertas()).isEqualTo(4);
        assertThat(db.altasYCriticas()).isEqualTo(2);
        assertThat(db.componentePrincipal()).isEqualTo("base-de-datos");
        assertThat(db.componentes()).containsExactly(
                new ConteoComponente("base-de-datos", 2, 2), new ConteoComponente("ssh", 1, 0), new ConteoComponente("otros", 1, 0));
    }

    @Test
    void reconocePorIdYComoRespaldoPorNombre() {
        var c = config(new Entrada("004", "Srv-Web", "web", "Servidor web", "Linux"));
        var r = CalculoActivos.calcular(List.of(
                alerta("1", "004", "otro-nombre", 2, "x", "web"),
                alerta("2", null, "srv-web", 2, "x", "web"),       // sin id: por nombre, sin distinguir mayúsculas
                alerta("3", "999", "SRV-WEB", 2, "x", "web")), c);  // id desconocido: por nombre

        assertThat(r.activos()).hasSize(1);
        Activo web = r.activos().get(0);
        assertThat(web.alertas()).isEqualTo(3);
        assertThat(web.agenteId()).isEqualTo("004");
        assertThat(web.equipo()).isEqualTo("Srv-Web");
        assertThat(web.nombreVisible()).isEqualTo("Servidor web");
    }

    @Test
    void agenteDesconocidoSinClasificarYSistemaDeducido() {
        var r = CalculoActivos.calcular(List.of(
                alerta("1", "010", "nuevo-linux", 3, "journald", "sshd"),
                alerta("2", "011", "NUEVO-WIN", 2, "x", "windows", "windows_security"),
                alerta("3", null, null, 4, "x", "sshd")), config());

        assertThat(r.alertasSinActivo()).isEqualTo(1);
        assertThat(activo(r, "nuevo-linux")).extracting(Activo::tipo, Activo::sistema, Activo::nombreVisible)
                .containsExactly("sin-clasificar", "Linux", "nuevo-linux");
        assertThat(activo(r, "NUEVO-WIN").sistema()).isEqualTo("Windows");
    }

    @Test
    void losDelInventarioSalenAunqueNoTenganAlertasYElOrdenEsPorAlertas() {
        var c = config(
                new Entrada("001", "cliente", "estacion", "Estación de trabajo Linux", "Linux"),
                new Entrada("004", "web", "web", "Servidor web", "Linux"));
        var r = CalculoActivos.calcular(List.of(alerta("1", "004", "web", 1, "x", "web")), c);

        assertThat(r.activos()).extracting(Activo::nombreVisible).containsExactly("Servidor web", "Estación de trabajo Linux");
        Activo vacio = r.activos().get(1);
        assertThat(vacio.alertas()).isZero();
        assertThat(vacio.componentePrincipal()).isNull();
        assertThat(vacio.componentes()).isEmpty();
    }

    // ---- ataques recientes y último ataque ----

    private static AlertaWazuh ataque(String id, String agenteId, String agente, int severidad, long creadaEn, String reglaId,
                                      String descripcion, String... grupos) {
        return new AlertaWazuh(id, creadaEn, true, reglaId, 10, descripcion, List.of(), List.of(), Map.of(), "192.0.2.9", "usuario-09",
                agente, new AlertaWazuh.Activo("wazuh", agenteId, null, "journald", List.of(grupos), severidad));
    }

    @Test
    void agrupaPorActivoYReglaConCantidadPrimeraUltimaYSeveridadMaxima() {
        var c = config(new Entrada("004", "web", "web", "Servidor web", "Linux"));
        var r = CalculoActivos.calcular(List.of(
                ataque("1", "004", "web", 3, 1000, "5712", "sshd: brute force", "sshd"),
                ataque("2", "004", "web", 4, 3000, "5712", "sshd: brute force", "sshd"),
                ataque("3", "004", "web", 3, 2000, "5712", "sshd: brute force", "sshd"),
                ataque("4", "004", "web", 3, 2500, "31151", "Web attack", "web_server_lab")), c);

        assertThat(r.ataquesRecientes()).hasSize(2);
        AtaqueReciente ssh = r.ataquesRecientes().get(0);
        assertThat(ssh).extracting(AtaqueReciente::agenteId, AtaqueReciente::equipo, AtaqueReciente::nombreVisible, AtaqueReciente::tipo,
                AtaqueReciente::componente, AtaqueReciente::reglaId, AtaqueReciente::nivelWazuh, AtaqueReciente::descripcion,
                AtaqueReciente::severidad, AtaqueReciente::cantidad, AtaqueReciente::primeraEn, AtaqueReciente::ultimaEn)
                .containsExactly("004", "web", "Servidor web", "web", "ssh", "5712", 10, "sshd: brute force", 4, 3, 1000L, 3000L);
        AtaqueReciente web = r.ataquesRecientes().get(1);
        assertThat(web).extracting(AtaqueReciente::reglaId, AtaqueReciente::componente, AtaqueReciente::cantidad, AtaqueReciente::severidad)
                .containsExactly("31151", "servidor-web", 1, 3);
    }

    @Test
    void laMismaReglaEnDosActivosSonDosGrupos() {
        var r = CalculoActivos.calcular(List.of(
                ataque("1", "010", "uno", 3, 1000, "5712", "x", "sshd"),
                ataque("2", "011", "dos", 3, 2000, "5712", "x", "sshd")), config());

        assertThat(r.ataquesRecientes()).extracting(AtaqueReciente::equipo).containsExactly("dos", "uno");
    }

    @Test
    void ordenaPorUltimaEnDeLaMasRecienteALaMasAntigua() {
        var r = CalculoActivos.calcular(List.of(
                ataque("1", "010", "a", 3, 1000, "r1", "x"),
                ataque("2", "010", "a", 3, 9000, "r2", "x"),
                ataque("3", "010", "a", 4, 5000, "r3", "x"),
                ataque("4", "010", "a", 3, 6000, "r1", "x")), config());

        assertThat(r.ataquesRecientes()).extracting(AtaqueReciente::reglaId).containsExactly("r2", "r1", "r3");
        assertThat(r.ataquesRecientes()).extracting(AtaqueReciente::ultimaEn).containsExactly(9000L, 6000L, 5000L);
    }

    @Test
    void soloCuentanLasSeveridades3y4() {
        var r = CalculoActivos.calcular(List.of(
                ataque("1", "010", "a", 1, 9000, "baja", "x"),
                ataque("2", "010", "a", 2, 8000, "media", "x"),
                ataque("3", "010", "a", 3, 1000, "alta", "x")), config());

        assertThat(r.ataquesRecientes()).extracting(AtaqueReciente::reglaId).containsExactly("alta");
        assertThat(r.ataquesRecientes().get(0).cantidad()).isEqualTo(1);
        // las de severidad baja y media siguen contando como alertas del activo
        assertThat(activo(r, "a").alertas()).isEqualTo(3);
        assertThat(activo(r, "a").altasYCriticas()).isEqualTo(1);
    }

    @Test
    void conAlertasSoloBajasONadaNoHayAtaquesPeroLaListaNoEsNull() {
        assertThat(CalculoActivos.calcular(List.of(ataque("1", "010", "a", 2, 1000, "r", "x")), config()).ataquesRecientes()).isEmpty();
        assertThat(CalculoActivos.calcular(List.of(), config()).ataquesRecientes()).isEmpty();
    }

    @Test
    void tieneUnTopeDe20GruposPorActivo() {
        List<AlertaWazuh> alertas = new ArrayList<>();
        for (int i = 1; i <= 25; i++) {
            alertas.add(ataque("a" + i, "010", "a", 3, i * 1000L, "regla-" + i, "x"));
        }
        var r = CalculoActivos.calcular(alertas, config());

        assertThat(ActivosAtacados.MAX_ATAQUES_POR_ACTIVO).isEqualTo(20);
        assertThat(r.ataquesRecientes()).hasSize(20);
        assertThat(r.ataquesRecientes().get(0).reglaId()).isEqualTo("regla-25");
        assertThat(r.ataquesRecientes().get(19).reglaId()).isEqualTo("regla-6");   // las 5 más viejas de ESE activo quedan fuera
    }

    @Test
    void elTopeEsPorActivoUnActivoConAtaquesViejosApareceAunqueOtrosTenganMuchosMasRecientes() {
        List<AlertaWazuh> alertas = new ArrayList<>();
        for (int i = 1; i <= 30; i++) {   // el activo "ruidoso": 30 reglas, todas más recientes que las del otro
            alertas.add(ataque("r" + i, "010", "ruidoso", 4, 1_000_000L + i * 1000L, "regla-" + i, "x"));
        }
        alertas.add(ataque("v1", "011", "tranquilo", 3, 1000L, "vieja-1", "x"));
        alertas.add(ataque("v2", "011", "tranquilo", 3, 2000L, "vieja-2", "x"));
        var r = CalculoActivos.calcular(alertas, config());

        assertThat(r.ataquesRecientes()).hasSize(22);   // 20 del ruidoso + 2 del tranquilo
        assertThat(r.ataquesRecientes().stream().filter(a -> "ruidoso".equals(a.equipo())).count()).isEqualTo(20);
        assertThat(r.ataquesRecientes().stream().filter(a -> "tranquilo".equals(a.equipo()))).extracting(AtaqueReciente::reglaId)
                .containsExactly("vieja-2", "vieja-1");
        // el orden global sigue siendo por ultimaEn descendente
        assertThat(r.ataquesRecientes()).extracting(AtaqueReciente::ultimaEn).isSortedAccordingTo(java.util.Comparator.reverseOrder());
    }

    @Test
    void laDescripcionSaneaLasIpsYNoSaleNingunUsuario() {
        var r = CalculoActivos.calcular(List.of(
                ataque("1", "010", "a", 3, 1000, "5712", "Login from 203.0.113.7 and fe80::1:2 failed", "sshd"),
                ataque("2", "010", "a", 3, 2000, "999", "  ", "sshd")), config());

        assertThat(r.ataquesRecientes().get(1).descripcion()).isEqualTo("Login from <ip> and <ip> failed");
        assertThat(r.ataquesRecientes().get(0).descripcion()).isNull();   // en blanco: no se inventa
        assertThat(r.ataquesRecientes().toString()).doesNotContain("203.0.113.7").doesNotContain("192.0.2.9").doesNotContain("usuario-09");
    }

    @Test
    void ultimoAtaqueEnEsLaAlertaAltaOCriticaMasRecienteONull() {
        var c = config(new Entrada("004", "web", "web", "Servidor web", "Linux"), new Entrada("001", "cliente", "estacion", "Estación", "Linux"));
        var r = CalculoActivos.calcular(List.of(
                ataque("1", "004", "web", 3, 1000, "r1", "x"),
                ataque("2", "004", "web", 4, 4000, "r2", "x"),
                ataque("3", "004", "web", 1, 9000, "r3", "x"),    // más reciente pero baja: no cuenta
                ataque("4", "001", "cliente", 2, 5000, "r4", "x")), c);

        assertThat(activo(r, "web").ultimoAtaqueEn()).isEqualTo(4000L);
        assertThat(activo(r, "cliente").ultimoAtaqueEn()).isNull();
    }
}
