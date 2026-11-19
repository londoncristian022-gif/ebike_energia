<?php

function manejarRutasReportes(string $action, string $method, callable $exigirAdministrador): void
{
    $accionesReporte = [
        'reporte_consumo',
        'reporte_alertas',
        'reporte_estado_flota',
        'reporte_sesiones_carga'
    ];
    if (!in_array($action, $accionesReporte, true)) {
        return;
    }

    if ($method !== 'GET') {
        http_response_code(405);
        header('Allow: GET');
        echo json_encode([
            'status' => 'error',
            'message' => 'Estos reportes solo aceptan solicitudes GET.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $exigirAdministrador();

    $parametroEsFechaValida = static function ($fecha): bool {
        if (!is_string($fecha) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) !== 1) {
            return false;
        }

        [$anio, $mes, $dia] = array_map('intval', explode('-', $fecha));
        return checkdate($mes, $dia, $anio);
    };
    $responderParametroInvalido = static function (string $mensaje): void {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => $mensaje
        ], JSON_UNESCAPED_UNICODE);
    };

    $accionesConFechas = ['reporte_consumo', 'reporte_alertas', 'reporte_sesiones_carga'];
    $fechaInicio = $_GET['inicio'] ?? null;
    $fechaFin = $_GET['fin'] ?? null;
    $fechaInicio = $fechaInicio === '' ? null : $fechaInicio;
    $fechaFin = $fechaFin === '' ? null : $fechaFin;
    if (in_array($action, $accionesConFechas, true) && (
        ($fechaInicio !== null && !$parametroEsFechaValida($fechaInicio))
        || ($fechaFin !== null && !$parametroEsFechaValida($fechaFin))
    )) {
        $responderParametroInvalido('Las fechas inicio y fin deben ser válidas y tener el formato YYYY-MM-DD.');
        exit;
    }
    if (in_array($action, $accionesConFechas, true) && $fechaInicio !== null && $fechaFin !== null && $fechaInicio > $fechaFin) {
        $responderParametroInvalido('La fecha de inicio no puede ser posterior a la fecha fin.');
        exit;
    }

    if ($action === 'reporte_consumo') {
        $reporte = obtenerReporteConsumoEstaciones(Conexion::conectar(), $fechaInicio, $fechaFin);
    } elseif ($action === 'reporte_alertas') {
        $nivel = $_GET['nivel'] ?? null;
        if ($nivel !== null && (!is_string($nivel) || !in_array($nivel, ['', 'INFORMACION', 'ADVERTENCIA', 'CRITICA'], true))) {
            $responderParametroInvalido('El nivel debe ser INFORMACION, ADVERTENCIA o CRITICA.');
            exit;
        }

        $reporte = obtenerReporteAlertasSeguridad(Conexion::conectar(), $nivel === '' ? null : $nivel, $fechaInicio, $fechaFin);
    } elseif ($action === 'reporte_estado_flota') {
        $reporte = obtenerReporteEstadoFlota(Conexion::conectar());
    } else {
        $estado = $_GET['estado'] ?? null;
        if ($estado !== null && (!is_string($estado) || !in_array($estado, ['', 'Completada', 'En Curso', 'Fallida', 'Interrumpida'], true))) {
            $responderParametroInvalido('El estado debe ser Completada, En Curso, Fallida o Interrumpida.');
            exit;
        }

        $reporte = obtenerReporteSesionesCarga(Conexion::conectar(), $estado === '' ? null : $estado, $fechaInicio, $fechaFin);
    }

    echo json_encode([
        'status' => 'success',
        'reporte' => $reporte
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
