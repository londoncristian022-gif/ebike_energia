<?php

/**
 * Ejecuta una consulta de reporte y libera su cursor para llamadas posteriores.
 */
function ejecutarReporte(PDO $conexion, string $sql, array $parametros = []): array {
    $consulta = $conexion->prepare($sql);
    $consulta->execute($parametros);

    try {
        return $consulta->fetchAll(PDO::FETCH_ASSOC);
    } finally {
        $consulta->closeCursor();
    }
}

function filtrosRangoReporte(string $columnaFecha, ?string $fechaInicio, ?string $fechaFin, array &$parametros): array {
    $filtros = [];
    if ($fechaInicio !== null) {
        $filtros[] = "$columnaFecha >= ?";
        $parametros[] = $fechaInicio . ' 00:00:00';
    }
    if ($fechaFin !== null) {
        $filtros[] = "$columnaFecha < DATE_ADD(?, INTERVAL 1 DAY)";
        $parametros[] = $fechaFin;
    }
    return $filtros;
}

function obtenerReporteConsumoEstaciones(PDO $conexion, ?string $fechaInicio, ?string $fechaFin): array {
    $parametros = [];
    $filtros = filtrosRangoReporte('r.fecha_registro', $fechaInicio, $fechaFin, $parametros);
    $where = $filtros ? 'WHERE ' . implode(' AND ', $filtros) : '';
    return ejecutarReporte(
        $conexion,
        "SELECT r.codigo_estacion, COALESCE(e.nombre, r.codigo_estacion) AS nombre_estacion,
                COUNT(r.id_registro) AS total_registros, SUM(r.cantidad_kwh) AS total_kwh,
                SUM(r.total_costo) AS total_costo_cop
         FROM registro_energia r
         LEFT JOIN estaciones e ON e.codigo_estacion = r.codigo_estacion
         $where
         GROUP BY r.codigo_estacion, e.nombre
         ORDER BY total_kwh DESC",
        $parametros
    );
}

function obtenerReporteAlertasSeguridad(PDO $conexion, ?string $nivelRiesgo, ?string $fechaInicio, ?string $fechaFin): array {
    $columnas = obtenerColumnasTabla($conexion, 'alertas');
    $columnaEstado = in_array('estado', $columnas, true) ? 'estado' : 'NULL AS estado';
    $parametros = [];
    $filtros = [];
    if ($nivelRiesgo !== null) {
        $filtros[] = 'nivel_riesgo = ?';
        $parametros[] = $nivelRiesgo;
    }
    $filtros = array_merge($filtros, filtrosRangoReporte('fecha_alerta', $fechaInicio, $fechaFin, $parametros));
    $where = $filtros ? 'WHERE ' . implode(' AND ', $filtros) : '';
    return ejecutarReporte(
        $conexion,
        "SELECT id_alerta, codigo_bateria, tipo_alerta, nivel_riesgo, mensaje, $columnaEstado, fecha_alerta
         FROM alertas $where ORDER BY fecha_alerta DESC",
        $parametros
    );
}

function obtenerReporteEstadoFlota(PDO $conexion): array {
    return ejecutarReporte($conexion, 'CALL sp_reporte_estado_flota()');
}

function obtenerReporteSesionesCarga(PDO $conexion, ?string $estadoCarga, ?string $fechaInicio, ?string $fechaFin): array {
    $parametros = [];
    $filtros = [];
    if ($estadoCarga !== null) {
        $filtros[] = 'estado_carga = ?';
        $parametros[] = $estadoCarga;
    }
    $filtros = array_merge($filtros, filtrosRangoReporte('fecha_carga', $fechaInicio, $fechaFin, $parametros));
    $where = $filtros ? 'WHERE ' . implode(' AND ', $filtros) : '';
    return ejecutarReporte(
        $conexion,
        "SELECT id_historial, codigo_bateria, codigo_estacion, porcentaje_inicial, porcentaje_final,
                energia_consumida, tiempo_carga, estado_carga, fecha_carga
         FROM historial_cargas $where ORDER BY fecha_carga DESC",
        $parametros
    );
}
