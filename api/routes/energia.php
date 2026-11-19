<?php

function manejarRutasEnergia(string $action, string $method, callable $exigirAdministrador): void
{
    if ($action === 'datos_formulario_carga') {
        if ($method !== 'GET') {
            http_response_code(405);
            header('Allow: GET');
            echo json_encode(['status' => 'error', 'message' => 'Esta acción solo acepta solicitudes GET.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $exigirAdministrador();
        $conexionBD = Conexion::conectar();
        $baterias = $conexionBD->query(
            'SELECT codigo_bateria AS codigo FROM baterias ORDER BY codigo_bateria'
        )->fetchAll(PDO::FETCH_ASSOC);
        $estaciones = $conexionBD->query(
            'SELECT codigo_estacion AS codigo, nombre FROM estaciones ORDER BY id_estacion'
        )->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode([
            'status' => 'success',
            'baterias' => $baterias,
            'estaciones' => $estaciones
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'registrar_carga') {
        if ($method !== 'POST') {
            http_response_code(405);
            header('Allow: POST');
            echo json_encode(['status' => 'error', 'message' => 'Esta acción solo acepta solicitudes POST.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $exigirAdministrador();
        $datos = json_decode(file_get_contents('php://input'), true);
        if (!is_array($datos)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'El cuerpo debe ser un objeto JSON válido.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $codigoBateria = $datos['codigo_bateria'] ?? null;
        $codigoEstacion = $datos['codigo_estacion'] ?? null;
        $socInicial = $datos['porcentaje_inicial'] ?? null;
        $socFinal = $datos['porcentaje_final'] ?? null;
        $energia = $datos['energia_consumida'] ?? null;
        $duracion = filter_var($datos['tiempo_carga'] ?? null, FILTER_VALIDATE_INT);
        $estado = $datos['estado_carga'] ?? null;
        $estadosPermitidos = ['Completada', 'En Curso', 'Fallida', 'Interrumpida'];
        $numeroValido = static fn($valor): bool => (is_string($valor) || is_numeric($valor))
            && is_numeric($valor) && is_finite((float) $valor);

        if (!is_string($codigoBateria) || trim($codigoBateria) === '' || mb_strlen($codigoBateria) > 30
            || !is_string($codigoEstacion) || trim($codigoEstacion) === '' || mb_strlen($codigoEstacion) > 20
            || !$numeroValido($socInicial) || (float) $socInicial < 0 || (float) $socInicial > 100
            || !$numeroValido($socFinal) || (float) $socFinal < 0 || (float) $socFinal > 100
            || !$numeroValido($energia) || (float) $energia <= 0 || (float) $energia > 999999.99
            || $duracion === false || $duracion < 1
            || !is_string($estado) || !in_array($estado, $estadosPermitidos, true)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Revisa los datos: batería, estación, porcentajes, energía, duración y estado son obligatorios y deben ser válidos.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $conexionBD = Conexion::conectar();
        $validarBateria = $conexionBD->prepare('SELECT 1 FROM baterias WHERE codigo_bateria = ?');
        $validarBateria->execute([trim($codigoBateria)]);
        $validarEstacion = $conexionBD->prepare('SELECT 1 FROM estaciones WHERE codigo_estacion = ?');
        $validarEstacion->execute([trim($codigoEstacion)]);
        if (!$validarBateria->fetchColumn() || !$validarEstacion->fetchColumn()) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'La batería o estación seleccionada ya no existe.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $insertar = $conexionBD->prepare(
            'INSERT INTO historial_cargas
                (codigo_bateria, codigo_estacion, porcentaje_inicial, porcentaje_final, energia_consumida, tiempo_carga, estado_carga)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $insertar->execute([
            trim($codigoBateria),
            trim($codigoEstacion),
            $socInicial,
            $socFinal,
            $energia,
            $duracion,
            $estado
        ]);

        http_response_code(201);
        echo json_encode([
            'status' => 'success',
            'message' => 'La sesión de carga se registró correctamente.',
            'id_historial' => (int) $conexionBD->lastInsertId()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

if ($action === 'registrar_energia') {
        if ($method !== 'POST') {
            http_response_code(405);
            header('Allow: POST');
            echo json_encode([
                'status' => 'error',
                'message' => 'Esta acción solo acepta solicitudes POST.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $exigirAdministrador();
        $datos = json_decode(file_get_contents('php://input'), true);
        if (!is_array($datos)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'El cuerpo de la solicitud debe ser un objeto JSON válido.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $idEstacion = filter_var($datos['id_estacion'] ?? null, FILTER_VALIDATE_INT);
        $consumo = $datos['consumo_kwh'] ?? null;
        $tarifa = $datos['tarifa_cop_kwh'] ?? null;
        $periodo = $datos['periodo_auditoria'] ?? null;
        if ($idEstacion === false || $idEstacion === null
            || !is_numeric($consumo) || !is_finite((float) $consumo)
            || (float) $consumo <= 0 || (float) $consumo > 99999999.99
            || !is_numeric($tarifa) || !is_finite((float) $tarifa)
            || (float) $tarifa <= 0 || (float) $tarifa > 999.999
            || (float) $consumo * (float) $tarifa > 99999999.99
            || !is_string($periodo) || trim($periodo) === '' || mb_strlen(trim($periodo)) > 50) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Los datos del registro son inválidos.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $conexionBD = Conexion::conectar();
        $consultaEstacion = $conexionBD->prepare(
            'SELECT codigo_estacion FROM estaciones WHERE id_estacion = :id_estacion'
        );
        $consultaEstacion->execute(['id_estacion' => $idEstacion]);
        $codigoEstacion = $consultaEstacion->fetchColumn();
        if ($codigoEstacion === false) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'La estación seleccionada no existe.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $insertarRegistro = $conexionBD->prepare(
            'INSERT INTO registro_energia (codigo_estacion, cantidad_kwh, costo_kwh, tipo_operac, fecha_registro)
            VALUES (:codigo_estacion, :cantidad_kwh, :costo_kwh, :tipo_operac, NOW())'
        );
        $insertarRegistro->execute([
            'codigo_estacion' => $codigoEstacion,
            'cantidad_kwh' => $consumo,
            'costo_kwh' => $tarifa,
            'tipo_operac' => trim($periodo)
        ]);

        echo json_encode([
            'status' => 'success',
            'message' => 'Registro guardado exitosamente.',
            'id_registro' => (int) $conexionBD->lastInsertId()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'obtener_registro_energia') {
        $exigirAdministrador();
        $conexionBD = Conexion::conectar();
        $registros = obtenerLibroRegistroEnergia($conexionBD);
        echo json_encode([
            'status' => 'success',
            'total' => count($registros),
            'data' => $registros
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'obtener_alertas') {
        $exigirAdministrador();
        $conexionBD = Conexion::conectar();
        $alertas = obtenerAlertasRecientes($conexionBD);
        echo json_encode([
            'status' => 'success',
            'total' => count($alertas),
            'data' => $alertas
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Historial de sesiones de carga
    if (($action === 'listar_cargas' || $action === 'historial_cargas' || $action === 'cargas') && $method === 'GET') {
        $exigirAdministrador();
        $conexionBD = Conexion::conectar();
        $cargas = obtenerHistorialCargas($conexionBD);
        echo json_encode([
            'status' => 'success',
            'total' => count($cargas),
            'cargas' => $cargas,
            'data' => $cargas
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
