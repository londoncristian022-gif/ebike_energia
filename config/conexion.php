<?php
class Conexion {
    private static $host = "localhost";
    private static $db   = "e_bike_bateria";
    private static $user = "root";
    private static $pass = "";

    public static function conectar() {
        try {
            $conexion = new PDO(
                "mysql:host=" . self::$host . ";dbname=" . self::$db . ";charset=utf8mb4",
                self::$user,
                self::$pass,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                ]
            );
            return $conexion;
        } catch (PDOException $e) {
            die(json_encode(["status" => "error", "mensaje" => "Error de conexión: " . $e->getMessage()]));
        }
    }
}
?>
