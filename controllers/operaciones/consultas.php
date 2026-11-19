<?php

/**
 * Obtiene indicadores del dashboard usando las columnas del esquema detectado.
 */
function obtenerResumenEnergia($conexion) {
    $columnasBateria = obtenerColumnasTabla($conexion, 'baterias');
    $columnaCarga = in_array('nivel_carga', $columnasBateria, true)
        ? 'nivel_carga'
        : (in_array('soc', $columnasBateria, true) ? 'soc' : null);

    if ($columnaCarga === null) {
        throw new RuntimeException('La tabla baterias no contiene nivel_carga ni soc.');
    }

    $sql = "SELECT
                COALESCE(SUM(CASE WHEN `$columnaCarga` <= 20 THEN 1 ELSE 0 END), 0) AS baterias_criticas,
                COALESCE(SUM(CASE WHEN `$columnaCarga` > 20 THEN 1 ELSE 0 END), 0) AS baterias_optimas,
                COALESCE(ROUND(AVG(`$columnaCarga`), 1), 0) AS soc_promedio
            FROM baterias";
    $resumen = $conexion->query($sql)->fetch();

    $tablas = $conexion->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    if (in_array('estaciones', $tablas, true)) {
        $resumen['flota_activa'] = (int) $conexion
            ->query("SELECT COUNT(*) FROM estaciones")
            ->fetchColumn();
    } elseif (in_array('codigo_bicicleta', $columnasBateria, true)) {
        $resumen['flota_activa'] = (int) $conexion
            ->query("SELECT COUNT(DISTINCT codigo_bicicleta) FROM baterias WHERE codigo_bicicleta IS NOT NULL AND codigo_bicicleta <> ''")
            ->fetchColumn();
    } elseif (in_array('bicicleta_id', $columnasBateria, true)) {
        $resumen['flota_activa'] = (int) $conexion
            ->query("SELECT COUNT(DISTINCT bicicleta_id) FROM baterias WHERE bicicleta_id IS NOT NULL")
            ->fetchColumn();
    } else {
        $resumen['flota_activa'] = 0;
    }

    return [
        'baterias_criticas' => (int) $resumen['baterias_criticas'],
        'baterias_optimas' => (int) $resumen['baterias_optimas'],
        'soc_promedio' => (float) $resumen['soc_promedio'],
        'flota_activa' => $resumen['flota_activa']
    ];
}

/**
 * Mantiene compatibilidad con las llamadas existentes al resumen.
 */
function obtenerResumen($conexion) {
    return obtenerResumenEnergia($conexion);
}

/**
 * Obtiene el historial de sesiones de carga.
 */
function obtenerHistorialCargas($conexion) {
    $columnas = obtenerColumnasTabla($conexion, 'historial_cargas');
    $estado = in_array('estado_carga', $columnas, true)
        ? 'estado_carga'
        : "'Completada'";
    $sql = "SELECT
                id_historial AS id,
                codigo_bateria AS bateria,
                codigo_estacion AS estacion,
                porcentaje_inicial AS soc_inicio,
                porcentaje_final AS soc_fin,
                tiempo_carga AS duracion_min,
                energia_consumida AS energia_kwh,
                $estado AS estado
            FROM historial_cargas
            ORDER BY id_historial DESC";

    return $conexion->query($sql)->fetchAll();
}

/**
 * Obtiene el libro de registro de consumo en el esquema energético existente.
 */
function obtenerLibroRegistroEnergia($conexion) {
    $columnas = obtenerColumnasTabla($conexion, 'registro_energia');
    foreach (['id_registro', 'codigo_estacion', 'cantidad_kwh', 'costo_kwh', 'total_costo', 'tipo_operac', 'fecha_registro'] as $columna) {
        if (!in_array($columna, $columnas, true)) {
            throw new RuntimeException("La columna requerida `$columna` no existe en registro_energia.");
        }
    }

    $consulta = $conexion->query(
        "SELECT
            r.id_registro,
            r.codigo_estacion AS estacion_codigo,
            COALESCE(e.nombre, r.codigo_estacion) AS nombre_estacion,
            r.fecha_registro,
            r.cantidad_kwh AS consumo_kwh,
            r.costo_kwh AS tarifa_cop_kwh,
            r.total_costo AS costo_cop,
            r.tipo_operac AS periodo_auditoria
        FROM registro_energia r
        LEFT JOIN estaciones e ON e.codigo_estacion = r.codigo_estacion
        ORDER BY r.fecha_registro DESC, r.id_registro DESC"
    );

    return $consulta->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Obtiene las alertas más recientes para el centro de administración.
 */
function obtenerAlertasRecientes($conexion) {
    $columnas = obtenerColumnasTabla($conexion, 'alertas');
    foreach (['id_alerta', 'codigo_bateria', 'tipo_alerta', 'nivel_riesgo', 'mensaje', 'fecha_alerta'] as $columna) {
        if (!in_array($columna, $columnas, true)) {
            throw new RuntimeException("La columna requerida `$columna` no existe en alertas.");
        }
    }

    return $conexion->query(
        'SELECT id_alerta, codigo_bateria, tipo_alerta, nivel_riesgo, mensaje, fecha_alerta
        FROM alertas
        ORDER BY fecha_alerta DESC, id_alerta DESC
        LIMIT 100'
    )->fetchAll(PDO::FETCH_ASSOC);
}
