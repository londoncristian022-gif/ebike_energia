<?php

function manejarRutasBaterias(string $action, string $method, callable $exigirAdministrador): void
{
if ($method === 'POST' && !in_array($action, ['guardar_bateria', 'registrar_energia', 'registrar_carga'], true)) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Acci?n no encontrada.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'POST' && $action === 'guardar_bateria') {
        if (obtenerRolActual() !== 'administrador') {
            http_response_code(isset($_SESSION['usuario_id']) ? 403 : 401);
            echo json_encode([
                'status' => 'error',
                'message' => 'Acceso denegado: solo los administradores pueden registrar baterías.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $datos = json_decode(file_get_contents('php://input'), true);
        if (!is_array($datos)) {
            $datos = $_POST;
        }
        if (!is_array($datos) || $datos === []) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'El cuerpo de la solicitud debe ser un objeto JSON válido.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $conexionBD = Conexion::conectar();
        $resultado = registrarBateria($conexionBD, $datos);
        if (isset($resultado['http_code'])) {
            http_response_code($resultado['http_code']);
            unset($resultado['http_code']);
        } else {
            http_response_code(201);
        }
        echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method !== 'GET' && !($method === 'POST' && in_array($action, ['registrar_energia', 'registrar_carga'], true))) {
        http_response_code(405);
        header('Allow: GET, POST');
        echo json_encode([
            'status' => 'error',
            'message' => 'Método HTTP no permitido.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'bateria_cliente') {
        if (!isset($_SESSION['usuario_id'])) {
            http_response_code(401);
            echo json_encode([
                'status' => 'error',
                'message' => 'Debes iniciar sesión para consultar la batería asignada.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (obtenerRolActual() !== 'cliente') {
            http_response_code(403);
            echo json_encode([
                'status' => 'error',
                'message' => 'Este recurso está disponible únicamente para cuentas de cliente.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $conexionBD = Conexion::conectar();
        $bateria = obtenerBateriaCliente($conexionBD, (int) $_SESSION['usuario_id']);
        echo json_encode([
            'status' => 'success',
            'data' => $bateria
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Endpoint para el formulario modal de registro de baterías
    if ($action === 'datos_formulario_bateria') {
        $exigirAdministrador();
        $conexionBD = Conexion::conectar();
        $siguienteCodigo = generarCodigoBateria($conexionBD);
        $bicicletasDisponibles = obtenerBicicletasDisponibles($conexionBD);

        echo json_encode([
            'status' => 'success',
            'data' => [
                'siguiente_codigo' => $siguienteCodigo,
                'bicicletas_disponibles' => $bicicletasDisponibles
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Inventario de baterías
    if (($action === 'listar_baterias' || $action === 'baterias' || $action === '') && $method === 'GET') {
        $exigirAdministrador();
        $conexionBD = Conexion::conectar();
        $listaBaterias = obtenerListaBaterias($conexionBD);
        echo json_encode([
            'status' => 'success',
            'total' => count($listaBaterias),
            'baterias' => $listaBaterias,
            'data' => $listaBaterias
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
