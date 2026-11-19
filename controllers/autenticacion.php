<?php
// controllers/autenticacion.php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Inicia sesión devolviendo el perfil y permisos según el rol.
 */
function iniciarSesionUsuario($conexion, $email, $password) {
    if (!$conexion instanceof PDO) {
        return ['status' => 'error', 'message' => 'Sin conexión a la base de datos'];
    }

    if (!is_string($email) || !is_string($password) || $email === '' || $password === '') {
        return ['status' => 'error', 'message' => 'Credenciales incorrectas'];
    }

    $consulta = $conexion->prepare(
        'SELECT id, nombre, email, rol, password FROM usuarios WHERE email = :email LIMIT 1'
    );
    $consulta->execute(['email' => $email]);
    $usuario = $consulta->fetch();

    if (!$usuario) {
        return ['status' => 'error', 'message' => 'Credenciales incorrectas'];
    }

    $passwordAlmacenada = $usuario['password'];
    $passwordValida = password_verify($password, $passwordAlmacenada);
    $passwordLegada = !$passwordValida && hash_equals($passwordAlmacenada, $password);

    if (!$passwordValida && !$passwordLegada) {
        return ['status' => 'error', 'message' => 'Credenciales incorrectas'];
    }

    if ($passwordLegada) {
        $actualizarPassword = $conexion->prepare(
            'UPDATE usuarios SET password = :password WHERE id = :id'
        );
        $actualizarPassword->execute([
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'id' => $usuario['id']
        ]);
    }

    session_regenerate_id(true);
    $_SESSION['usuario_id'] = $usuario['id'];
    $_SESSION['usuario_nombre'] = $usuario['nombre'];
    $_SESSION['usuario_rol'] = $usuario['rol'];

    return [
        'status' => 'success',
        'message' => 'Inicio de sesión exitoso',
        'usuario' => [
            'id' => $usuario['id'],
            'nombre' => $usuario['nombre'],
            'email' => $usuario['email'],
            'rol' => $usuario['rol']
        ]
    ];
}

/**
 * Obtiene el rol activo en la sesión actual.
 */
function obtenerRolActual() {
    $rol = $_SESSION['usuario_rol'] ?? 'cliente';

    return in_array($rol, ['administrador', 'cliente'], true) ? $rol : 'cliente';
}
