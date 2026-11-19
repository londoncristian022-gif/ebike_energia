<?php

/**
 * Obtiene el inventario en el formato compartido por ambos esquemas.
 */
function obtenerListaBaterias($conexion) {
    $columnasBateria = obtenerColumnasTabla($conexion, 'baterias');
    $esquemaEBike = in_array('codigo_bateria', $columnasBateria, true)
        && in_array('id_bateria', $columnasBateria, true);

    if ($esquemaEBike) {
        $codigo = 'b.codigo_bateria';
        $id = 'b.id_bateria';
        $bicicleta = in_array('codigo_bicicleta', $columnasBateria, true)
            ? "COALESCE(b.codigo_bicicleta, 'Sin Asignar')"
            : "'Sin Asignar'";
        $soc = in_array('nivel_carga', $columnasBateria, true) ? 'b.nivel_carga' : '0';
        $soh = in_array('soh', $columnasBateria, true) ? 'b.soh' : '95.00';
        $qr = in_array('codigo_qr', $columnasBateria, true) ? 'b.codigo_qr' : 'b.codigo_bateria';
        $temperatura = in_array('temperatura', $columnasBateria, true) ? 'b.temperatura' : '0';
        $estado = in_array('estado', $columnasBateria, true) ? 'b.estado' : "'Sin estado'";
        $vidaUtil = in_array('vida_util', $columnasBateria, true) ? 'b.vida_util' : "'Óptima'";

        $sql = "SELECT
                    $id AS id,
                    $codigo AS codigo,
                    $bicicleta AS bicicleta,
                    $qr AS codigo_qr,
                    $soc AS soc,
                    $soh AS soh,
                    $temperatura AS temperatura,
                    $vidaUtil AS vida_util,
                    $estado AS estado
                FROM baterias b
                ORDER BY $id DESC";
    } else {
        $columnasRequeridas = ['id', 'codigo', 'bicicleta_id', 'soc'];
        if (array_diff($columnasRequeridas, $columnasBateria)) {
            throw new RuntimeException('La tabla baterias no coincide con un esquema soportado.');
        }

        $columnasBicicleta = obtenerColumnasTabla($conexion, 'bicicletas');
        if (!in_array('id', $columnasBicicleta, true) || !in_array('codigo_unico', $columnasBicicleta, true)) {
            throw new RuntimeException('La tabla bicicletas no contiene las columnas requeridas.');
        }

        $qr = in_array('codigo_qr', $columnasBateria, true) ? 'b.codigo_qr' : "CONCAT('QR-', b.codigo)";
        $soh = in_array('soh', $columnasBateria, true) ? 'b.soh' : '95.00';
        $temperatura = in_array('temperatura', $columnasBateria, true) ? 'b.temperatura' : '25.00';
        $estado = in_array('estado_salud', $columnasBateria, true)
            ? 'b.estado_salud'
            : (in_array('estado', $columnasBateria, true) ? 'b.estado' : "'Sin estado'");

        $sql = "SELECT
                    b.id AS id,
                    b.codigo AS codigo,
                    COALESCE(bc.codigo_unico, 'Sin Asignar') AS bicicleta,
                    $qr AS codigo_qr,
                    b.soc AS soc,
                    $soh AS soh,
                    $temperatura AS temperatura,
                    'Óptima' AS vida_util,
                    $estado AS estado
                FROM baterias b
                LEFT JOIN bicicletas bc ON b.bicicleta_id = bc.id
                ORDER BY b.id DESC";
    }

    return $conexion->query($sql)->fetchAll();
}

/**
 * Obtiene únicamente la batería vinculada al usuario autenticado.
 */
function obtenerBateriaCliente(PDO $conexion, int $usuarioId): ?array {
    if ($usuarioId < 1) {
        throw new InvalidArgumentException('El identificador del usuario no es válido.');
    }

    $columnasUsuario = obtenerColumnasTabla($conexion, 'usuarios');
    if (!in_array('bateria_asignada_id', $columnasUsuario, true)) {
        throw new RuntimeException('Falta aplicar la migración de asignación de baterías a usuarios.');
    }

    $columnasBateria = obtenerColumnasTabla($conexion, 'baterias');
    foreach (['id_bateria', 'codigo_bateria', 'nivel_carga', 'estado'] as $columna) {
        if (!in_array($columna, $columnasBateria, true)) {
            throw new RuntimeException("La columna requerida `$columna` no existe en la tabla baterias.");
        }
    }

    $bicicleta = in_array('codigo_bicicleta', $columnasBateria, true)
        ? 'b.codigo_bicicleta'
        : 'NULL';
    $soh = in_array('soh', $columnasBateria, true) ? 'b.soh' : 'NULL';
    $temperatura = in_array('temperatura', $columnasBateria, true)
        ? 'b.temperatura'
        : 'NULL';

    $consulta = $conexion->prepare(
        "SELECT
            b.codigo_bateria AS codigo,
            $bicicleta AS bicicleta,
            b.nivel_carga AS soc,
            $soh AS soh,
            $temperatura AS temperatura,
            b.estado AS estado
        FROM usuarios u
        INNER JOIN baterias b ON b.id_bateria = u.bateria_asignada_id
        WHERE u.id = :usuario_id AND u.rol = 'cliente'
        LIMIT 1"
    );
    $consulta->execute(['usuario_id' => $usuarioId]);
    $bateria = $consulta->fetch(PDO::FETCH_ASSOC);

    if (!$bateria) {
        return null;
    }

    $soc = $bateria['soc'] === null ? null : (float) $bateria['soc'];

    return [
        'codigo' => $bateria['codigo'],
        'bicicleta' => $bateria['bicicleta'],
        'soc' => $soc,
        'soh' => $bateria['soh'] === null ? null : (float) $bateria['soh'],
        'temperatura' => $bateria['temperatura'] === null ? null : (float) $bateria['temperatura'],
        'autonomia_km' => $soc === null ? null : round($soc * 0.4, 1),
        'estado' => $bateria['estado']
    ];
}
