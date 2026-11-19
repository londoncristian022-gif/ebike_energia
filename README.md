# E-Bike Energy

Sistema web para la gestión y analítica de flota E-Bike Energy.

## Estructura del proyecto

- `api/api.php`: API JSON.
- `config/conexion.php`: conexión PDO a `E_Bike_Bateria`.
- `controllers/`: autenticación, operaciones y alta de baterías.
- `public/`: interfaz HTML, CSS y JavaScript; las librerías de gráficas y PDF están en `public/js/vendor/`.
- `ems_base.sql`: esquema SQL con tablas, datos de demostración y procedimientos almacenados.
- `docs/`: manuales de usuario y técnico.

## Ejecución local

1. Configure Apache/PHP y MySQL o MariaDB en XAMPP, Laragon u otro entorno compatible.
2. Importe `ems_base.sql`.
3. Revise el host, la base de datos, el usuario y la contraseña en `config/conexion.php`.
4. Sirva la carpeta del proyecto y abra `http://localhost/ebike_energia/`. `index.php` redirige a `public/index.html`.

## Notas

- Las credenciales iniciales de demostración se encuentran en `ems_base.sql` y `public/index.html`. No las use en producción.
- El rol operador no está implementado; los roles actuales son administrador y cliente.
- Consulte `docs/manual_usuario_por_roles.md` y `docs/manual_instalacion_y_tecnico.md` para permisos, API y limitaciones conocidas.
