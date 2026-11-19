<?php
// api/api.php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/conexion.php';
require_once __DIR__ . '/../controllers/registrobicicleta.php';
require_once __DIR__ . '/../controllers/operaciones.php';
require_once __DIR__ . '/../controllers/autenticacion.php';
require_once __DIR__ . '/routes/autenticacion.php';
require_once __DIR__ . '/routes/baterias.php';
require_once __DIR__ . '/routes/dashboard.php';
require_once __DIR__ . '/routes/reportes.php';
require_once __DIR__ . '/routes/energia.php';

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $cuerpoJson = json_decode(file_get_contents('php://input'), true);
    $action = $_GET['action'] ?? $_POST['action'] ?? (is_array($cuerpoJson) ? ($cuerpoJson['action'] ?? '') : '');
    $exigirAdministrador = static function (): void {
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode([
                'status' => 'error',
                'message' => 'Debes iniciar sesión para consultar estos datos.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (obtenerRolActual() !== 'administrador') {
            http_response_code(403);
            echo json_encode([
                'status' => 'error',
                'message' => 'Acceso restringido: estos datos son exclusivos de administración.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    };

    manejarRutasAutenticacion($action, $method);
    manejarRutasBaterias($action, $method, $exigirAdministrador);
    manejarRutasDashboard($action, $method, $exigirAdministrador);
    manejarRutasReportes($action, $method, $exigirAdministrador);
    manejarRutasEnergia($action, $method, $exigirAdministrador);

    http_response_code(404);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'Acción no encontrada.'
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'mensaje' => 'Error al procesar la solicitud de la API.',
        'detalle' => $error->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
