<?php
// controllers/registrobicicleta.php

/**
 * Genera el siguiente código consecutivo de batería (Ej: BAT-005)
 */
function generarCodigoBateria($conexion) {
    $sql = "SELECT MAX(CAST(SUBSTRING(codigo_bateria, 5) AS UNSIGNED))
            FROM baterias
            WHERE codigo_bateria REGEXP '^BAT-[0-9]+$'";
    $numeroActual = (int) $conexion->query($sql)->fetchColumn();

    return 'BAT-' . str_pad($numeroActual + 1, 3, '0', STR_PAD_LEFT);
}

/**
 * Obtiene los códigos de bicicleta asociados a baterías registradas.
 */
function obtenerBicicletasDisponibles($conexion) {
    $sql = "SELECT DISTINCT codigo_bicicleta
            FROM baterias
            WHERE codigo_bicicleta IS NOT NULL
              AND codigo_bicicleta <> ''
            ORDER BY codigo_bicicleta ASC";
    $filas = $conexion->query($sql)->fetchAll();

    return array_map(static function ($fila) {
        return [
            'id' => $fila['codigo_bicicleta'],
            'codigo_unico' => $fila['codigo_bicicleta'],
            'modelo' => 'Bicicleta E-Bike'
        ];
    }, $filas);
}

/**
 * Devuelve el inventario de baterías según el esquema E_Bike_Bateria.
 */
function obtenerBaterias($conexion) {
    $sql = "SELECT
                codigo_bateria AS codigo,
                codigo_bicicleta AS modelo,
                nivel_carga AS nivel_bateria,
                temperatura,
                estado
            FROM baterias
            ORDER BY id_bateria DESC";

    return $conexion->query($sql)->fetchAll();
}

/**
 * Registra una batería usando las columnas de E_Bike_Bateria.baterias.
 */
function registrarBateria($conexion, array $datos) {
    $codigoBateria = trim((string) ($datos['codigo_bateria'] ?? ''));
    $codigoBicicleta = trim((string) ($datos['bicicleta_asignada'] ?? ''));
    $nivelCarga = filter_var($datos['soc'] ?? 100, FILTER_VALIDATE_FLOAT);

    if (
        $codigoBateria === '' ||
        $nivelCarga === false ||
        $nivelCarga < 0 ||
        $nivelCarga > 100
    ) {
        return [
            'status' => 'error',
            'http_code' => 400,
            'message' => 'El código de batería es obligatorio y el nivel de carga debe estar entre 0 y 100.'
        ];
    }

    $sql = "INSERT INTO baterias
                (codigo_bateria, codigo_bicicleta, nivel_carga, temperatura, estado, fecha_instalacion)
            VALUES
                (:codigo_bateria, :codigo_bicicleta, :nivel_carga, 25.00, 'Operativa', CURDATE())";
    $consulta = $conexion->prepare($sql);
    $consulta->execute([
        'codigo_bateria' => $codigoBateria,
        'codigo_bicicleta' => $codigoBicicleta !== '' ? $codigoBicicleta : null,
        'nivel_carga' => $nivelCarga
    ]);

    return [
        'status' => 'success',
        'message' => 'Batería registrada correctamente en E_Bike_Bateria.',
        'codigo_generado' => $codigoBateria
    ];
}
