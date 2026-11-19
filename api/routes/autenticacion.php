<?php

function manejarRutasAutenticacion(string $action, string $method): void
{
if ($action === 'sesion_actual') {
        if ($method !== 'GET') {
            http_response_code(405);
            header('Allow: GET');
            echo json_encode([
                'status' => 'error',
                'message' => 'Este endpoint solo acepta solicitudes GET.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $autenticado = isset($_SESSION['usuario_id']);
        echo json_encode([
            'status' => 'success',
            'autenticado' => $autenticado,
            'usuario' => $autenticado ? [
                'id' => $_SESSION['usuario_id'],
                'nombre' => $_SESSION['usuario_nombre'] ?? '',
                'rol' => obtenerRolActual()
            ] : null
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'login') {
        if ($method !== 'POST') {
            http_response_code(405);
            header('Allow: POST');
            echo json_encode([
                'status' => 'error',
                'message' => 'Este endpoint solo acepta solicitudes POST.'
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
        $resultado = iniciarSesionUsuario(
            $conexionBD,
            $datos['email'] ?? '',
            $datos['password'] ?? ''
        );
        if ($resultado['status'] !== 'success') {
            http_response_code(401);
        }
        echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'cerrar_sesion') {
        if ($method !== 'POST') {
            http_response_code(405);
            header('Allow: POST');
            echo json_encode([
                'status' => 'error',
                'message' => 'Este endpoint solo acepta solicitudes POST.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $parametrosCookie = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $parametrosCookie['path'],
                $parametrosCookie['domain'],
                $parametrosCookie['secure'],
                $parametrosCookie['httponly']
            );
        }
        session_destroy();

        echo json_encode([
            'status' => 'success',
            'message' => 'Sesión cerrada correctamente.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
