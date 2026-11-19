CREATE DATABASE IF NOT EXISTS e_bike_bateria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE e_bike_bateria;

CREATE TABLE IF NOT EXISTS estaciones (
    id_estacion INT AUTO_INCREMENT PRIMARY KEY,
    codigo_estacion VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO estaciones (id_estacion, codigo_estacion, nombre) VALUES
    (1, 'EST-01', 'Estación Central Poblado'),
    (2, 'EST-02', 'Estación Unicentro'),
    (3, 'EST-03', 'Estación Laureles'),
    (4, 'EST-04', 'Plaza Mayor');

CREATE TABLE IF NOT EXISTS baterias (
    id_bateria INT AUTO_INCREMENT PRIMARY KEY,
    codigo_bateria VARCHAR(30) UNIQUE NOT NULL,
    codigo_bicicleta VARCHAR(30) NULL,
    codigo_qr VARCHAR(50) NULL,
    capacidad_wh INT DEFAULT 720,
    fecha_instalacion DATE NULL,
    nivel_carga DECIMAL(5,2) DEFAULT 100.00,
    soh DECIMAL(5,2) DEFAULT 98.00,
    temperatura DECIMAL(5,2) DEFAULT 25.00,
    vida_util VARCHAR(30) DEFAULT 'Óptima',
    estado ENUM('Operativa', 'En Carga', 'Cargada', 'Mantenimiento', 'Inactiva') DEFAULT 'Operativa'
) ENGINE=InnoDB;

INSERT IGNORE INTO baterias
    (codigo_bateria, codigo_bicicleta, codigo_qr, capacidad_wh, fecha_instalacion, nivel_carga, soh, temperatura, vida_util, estado)
VALUES
    ('BAT-004', 'BK-101', 'QR-BAT-004', 720, CURRENT_DATE, 100.00, 99.00, 25.00, 'Óptima', 'Operativa'),
    ('BAT-005', 'BK-102', 'QR-BAT-005', 720, CURRENT_DATE, 84.50, 96.50, 27.20, 'Óptima', 'Operativa'),
    ('BAT-089', 'BK-156', 'QR-BAT-089', 720, CURRENT_DATE, 18.00, 81.00, 52.40, 'En revisión', 'Mantenimiento');

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol ENUM('administrador', 'cliente') NOT NULL DEFAULT 'cliente',
    bateria_asignada_id INT NULL DEFAULT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_bateria_asignada FOREIGN KEY (bateria_asignada_id)
        REFERENCES baterias (id_bateria) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Claves iniciales de demostración; autenticacion.php las convierte a password_hash al primer acceso.
INSERT IGNORE INTO usuarios (nombre, email, password, rol, bateria_asignada_id)
VALUES ('Administrador Flota', 'admin@ebike.com', '$2y$10$ZFKmd3Up1R3A2QX6lHLiy.p.e2s4s139ad/j.M/YnwttWOx47zYH.', 'administrador', NULL);
INSERT IGNORE INTO usuarios (nombre, email, password, rol, bateria_asignada_id)
SELECT 'Cliente E-Bike', 'cliente@ebike.com', '$2y$10$ZFKmd3Up1R3A2QX6lHLiy.p.e2s4s139ad/j.M/YnwttWOx47zYH.', 'cliente', id_bateria
FROM baterias WHERE codigo_bateria = 'BAT-005' LIMIT 1;

CREATE TABLE IF NOT EXISTS historial_cargas (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    codigo_bateria VARCHAR(30) NOT NULL,
    codigo_estacion VARCHAR(20) NOT NULL,
    porcentaje_inicial DECIMAL(5,2) NOT NULL,
    porcentaje_final DECIMAL(5,2) NOT NULL,
    energia_consumida DECIMAL(8,2) NOT NULL,
    tiempo_carga INT NOT NULL,
    estado_carga ENUM('Completada', 'En Curso', 'Fallida', 'Interrumpida') DEFAULT 'Completada',
    fecha_carga TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO historial_cargas (codigo_bateria, codigo_estacion, porcentaje_inicial, porcentaje_final, energia_consumida, tiempo_carga, estado_carga)
SELECT 'BAT-004', 'EST-01', 20.00, 100.00, 0.58, 45, 'Completada'
WHERE NOT EXISTS (SELECT 1 FROM historial_cargas WHERE codigo_bateria = 'BAT-004' AND codigo_estacion = 'EST-01');

CREATE TABLE IF NOT EXISTS registro_energia (
    id_registro INT AUTO_INCREMENT PRIMARY KEY,
    codigo_estacion VARCHAR(20) NOT NULL,
    cantidad_kwh DECIMAL(10,2) NOT NULL,
    costo_kwh DECIMAL(8,3) NOT NULL,
    total_costo DECIMAL(12,2) GENERATED ALWAYS AS (cantidad_kwh * costo_kwh) STORED,
    tipo_operac VARCHAR(50) DEFAULT 'Consumo',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO registro_energia (codigo_estacion, cantidad_kwh, costo_kwh, tipo_operac, fecha_registro)
SELECT 'EST-01', 120.50, 850.000, 'Consumo', NOW() - INTERVAL 1 DAY
WHERE NOT EXISTS (SELECT 1 FROM registro_energia WHERE codigo_estacion = 'EST-01' AND cantidad_kwh = 120.50 AND tipo_operac = 'Consumo');
INSERT INTO registro_energia (codigo_estacion, cantidad_kwh, costo_kwh, tipo_operac, fecha_registro)
SELECT 'EST-02', 95.00, 850.000, 'Consumo', NOW() - INTERVAL 2 DAY
WHERE NOT EXISTS (SELECT 1 FROM registro_energia WHERE codigo_estacion = 'EST-02' AND cantidad_kwh = 95.00 AND tipo_operac = 'Consumo');
INSERT INTO registro_energia (codigo_estacion, cantidad_kwh, costo_kwh, tipo_operac, fecha_registro)
SELECT 'EST-03', 210.00, 820.000, 'Consumo Valle', NOW() - INTERVAL 3 DAY
WHERE NOT EXISTS (SELECT 1 FROM registro_energia WHERE codigo_estacion = 'EST-03' AND cantidad_kwh = 210.00 AND tipo_operac = 'Consumo Valle');

CREATE TABLE IF NOT EXISTS alertas (
    id_alerta INT AUTO_INCREMENT PRIMARY KEY,
    codigo_bateria VARCHAR(30) NOT NULL,
    tipo_alerta VARCHAR(100) NOT NULL,
    nivel_riesgo ENUM('INFORMACION', 'ADVERTENCIA', 'CRITICA') NOT NULL DEFAULT 'ADVERTENCIA',
    mensaje TEXT NOT NULL,
    estado ENUM('Activa', 'Resuelta') DEFAULT 'Activa',
    fecha_alerta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO alertas (codigo_bateria, tipo_alerta, nivel_riesgo, mensaje, estado)
SELECT 'BAT-089', 'Desbalance crítico de celda', 'CRITICA', 'Temperatura de módulo: 52.4 °C. Diferencia de 410 mV respecto a celda base.', 'Activa'
WHERE NOT EXISTS (SELECT 1 FROM alertas WHERE codigo_bateria = 'BAT-089' AND tipo_alerta = 'Desbalance crítico de celda');
INSERT INTO alertas (codigo_bateria, tipo_alerta, nivel_riesgo, mensaje, estado)
SELECT 'BAT-005', 'Temperatura elevada en carga', 'ADVERTENCIA', 'Incremento térmico moderado durante ciclo rápido en EST-02.', 'Activa'
WHERE NOT EXISTS (SELECT 1 FROM alertas WHERE codigo_bateria = 'BAT-005' AND tipo_alerta = 'Temperatura elevada en carga');

DELIMITER //
DROP PROCEDURE IF EXISTS sp_reporte_consumo_estaciones //
CREATE PROCEDURE sp_reporte_consumo_estaciones(IN p_inicio DATE, IN p_fin DATE)
BEGIN
    SELECT r.codigo_estacion, COALESCE(e.nombre, r.codigo_estacion) AS nombre_estacion,
           COUNT(r.id_registro) AS total_registros, SUM(r.cantidad_kwh) AS total_kwh,
           SUM(r.total_costo) AS total_costo_cop
    FROM registro_energia r LEFT JOIN estaciones e ON e.codigo_estacion = r.codigo_estacion
    WHERE (p_inicio IS NULL OR DATE(r.fecha_registro) >= p_inicio)
      AND (p_fin IS NULL OR DATE(r.fecha_registro) <= p_fin)
    GROUP BY r.codigo_estacion, e.nombre ORDER BY total_kwh DESC;
END //
DROP PROCEDURE IF EXISTS sp_reporte_alertas_seguridad //
CREATE PROCEDURE sp_reporte_alertas_seguridad(IN p_nivel VARCHAR(20))
BEGIN
    SELECT id_alerta, codigo_bateria, tipo_alerta, nivel_riesgo, mensaje, estado, fecha_alerta
    FROM alertas WHERE (p_nivel IS NULL OR nivel_riesgo = p_nivel) ORDER BY fecha_alerta DESC;
END //
DROP PROCEDURE IF EXISTS sp_reporte_estado_flota //
CREATE PROCEDURE sp_reporte_estado_flota()
BEGIN
    SELECT estado, COUNT(*) AS cantidad_baterias, ROUND(AVG(nivel_carga), 1) AS soc_promedio,
           ROUND(AVG(temperatura), 1) AS temperatura_promedio
    FROM baterias GROUP BY estado ORDER BY cantidad_baterias DESC;
END //
DROP PROCEDURE IF EXISTS sp_reporte_sesiones_carga //
CREATE PROCEDURE sp_reporte_sesiones_carga(IN p_estado VARCHAR(20))
BEGIN
    SELECT id_historial, codigo_bateria, codigo_estacion, porcentaje_inicial, porcentaje_final,
           energia_consumida, tiempo_carga, estado_carga, fecha_carga
    FROM historial_cargas WHERE (p_estado IS NULL OR estado_carga = p_estado) ORDER BY fecha_carga DESC;
END //
DELIMITER ;
