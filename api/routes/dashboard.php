<?php

function manejarRutasDashboard(string $action, string $method, callable $exigirAdministrador): void
{
// Endpoint para el resumen del dashboard
    if ($action === 'resumen') {
        $exigirAdministrador();
        $conexionBD = Conexion::conectar();
        $resumen = obtenerResumenEnergia($conexionBD);
        echo json_encode([
            'status' => 'success',
            'data' => $resumen
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
