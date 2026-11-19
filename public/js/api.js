const API_URL = '../api/api.php';

/**
 * Envía credenciales a la API para iniciar sesión.
 */
async function loginAPI(email, password) {
    try {
        const response = await fetch(`${API_URL}?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const resultado = await response.json();

        if (!response.ok && resultado.status === 'success') {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        return resultado;
    } catch (error) {
        console.error('Error durante el inicio de sesión:', error);
        return {
            status: 'error',
            message: error.message || 'No se pudo conectar con el servidor de autenticación.'
        };
    }
}

/**
 * Obtiene el estado de la sesión y el rol guardado en PHP.
 */
async function obtenerSesionActualAPI() {
    try {
        const response = await fetch(`${API_URL}?action=sesion_actual`);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error al consultar la sesión actual:', error);
        return null;
    }
}

/**
 * Cierra la sesión PHP activa.
 */
async function cerrarSesionAPI() {
    const response = await fetch(`${API_URL}?action=cerrar_sesion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    });
    const resultado = await response.json();

    if (!response.ok || resultado.status !== 'success') {
        throw new Error(resultado.message || `Error HTTP al cerrar sesión: ${response.status}`);
    }

    return resultado;
}

// Obtener datos iniciales para el modal (Código autogenerado y bicicletas)
async function obtenerDatosModalBateria() {
    try {
        const res = await fetch(`${API_URL}?action=datos_formulario_bateria`);
        return await res.json();
    } catch (error) {
        console.error('Error al obtener datos del modal:', error);
        return { status: 'error' };
    }
}

// Obtener inventario para la tabla
async function obtenerBaterias() {
    try {
        const res = await fetch(`${API_URL}?action=listar_baterias`);
        return await res.json();
    } catch (error) {
        console.error('Error al obtener inventario:', error);
        return { status: 'error', data: [] };
    }
}

/**
 * Consulta la lista completa de baterías desde la API
 */
async function obtenerListaBateriasAPI() {
    try {
        const response = await fetch(`${API_URL}?action=listar_baterias`);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const respuesta = await response.json();
        const filas = Array.isArray(respuesta.data)
            ? respuesta.data
            : Array.isArray(respuesta.data?.baterias)
                ? respuesta.data.baterias
                : Array.isArray(respuesta.baterias)
                    ? respuesta.baterias
                    : null;

        if (respuesta.status !== 'success' || !filas) {
            throw new Error(respuesta.message || respuesta.mensaje || 'Formato de respuesta de inventario no válido.');
        }

        const totalRecibido = respuesta.total ?? respuesta.data?.total;
        return {
            ...respuesta,
            total: Number.isInteger(Number(totalRecibido)) ? Number(totalRecibido) : filas.length,
            data: filas.map((bateria) => ({
                ...bateria,
                codigo: bateria.codigo ?? bateria.codigo_bateria,
                bicicleta: bateria.bicicleta ?? bateria.codigo_bicicleta,
                soc: bateria.soc ?? bateria.nivel_carga
            }))
        };
    } catch (error) {
        console.error('Error en obtenerListaBateriasAPI:', error);
        return null;
    }
}

// Registrar batería en BD
async function registrarNuevaBateria(datos) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        return await res.json();
    } catch (error) {
        console.error('Error al guardar batería:', error);
        return { status: 'error', message: 'Error de conexión con el servidor' };
    }
}

// public/js/api.js

/**
 * Obtiene los datos del backend para inicializar el modal de batería
 */
async function obtenerDatosFormularioBateria() {
    try {
        const response = await fetch('../api/api.php?action=datos_formulario_bateria');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error al conectar con la API:', error);
        return null;
    }
}

/**
 * Envía el formulario de la nueva batería al backend
 */
async function guardarBateriaAPI(datosFormulario) {
    try {
        const response = await fetch(`${API_URL}?action=guardar_bateria`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datosFormulario)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error al guardar la batería:', error);
        return { status: 'error', message: 'No se pudo conectar con el servidor.' };
    }
}