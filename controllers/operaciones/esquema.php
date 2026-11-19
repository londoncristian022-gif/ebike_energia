<?php

/**
 * Returns a table's column names for selecting the supported database schema.
 */
function obtenerColumnasTabla($conexion, string $tabla) {
    $tablasPermitidas = [
        'baterias',
        'bicicletas',
        'estaciones',
        'usuarios',
        'historial_cargas',
        'registro_energia',
        'alertas'
    ];
    if (!in_array($tabla, $tablasPermitidas, true)) {
        throw new InvalidArgumentException('Tabla no permitida.');
    }

    $consulta = $conexion->query("SHOW COLUMNS FROM `$tabla`");
    return array_column($consulta->fetchAll(), 'Field');
}
