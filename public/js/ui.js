function navegarSeccion() {
    const secciones = ['dashboard', 'baterias', 'cargas', 'energia', 'alertas'];
    const hashSolicitado = window.location.hash.slice(1);
    const rolActual = document.getElementById('lblUsuarioRol')?.textContent?.trim().toLowerCase() || 'cliente';
    const seccionesSoloAdministrador = ['baterias', 'cargas', 'energia', 'alertas'];
    let seccionActiva = secciones.includes(hashSolicitado) ? hashSolicitado : 'dashboard';
    if (
        rolActual !== 'administrador' &&
        seccionesSoloAdministrador.includes(seccionActiva)
    ) {
        seccionActiva = 'dashboard';
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#dashboard`);
    }

    secciones.forEach((id) => {
        const seccion = document.getElementById(id);
        if (seccion) {
            seccion.style.display = id === seccionActiva && !seccion.hidden ? 'block' : 'none';
        }
    });

    document.querySelectorAll('.sidebar .nav-link[data-section]').forEach((enlace) => {
        const activo = enlace.dataset.section === seccionActiva;
        enlace.classList.toggle('active', activo);
        if (activo) {
            enlace.setAttribute('aria-current', 'page');
        } else {
            enlace.removeAttribute('aria-current');
        }
    });

    const aplicacionActiva = !document.querySelector('.main-content')?.inert;
    if (aplicacionActiva && seccionActiva === 'baterias' && typeof cargarInventarioBaterias === 'function') {
        cargarInventarioBaterias();
    }
    if (aplicacionActiva && seccionActiva === 'cargas' && typeof cargarTablaHistorialCargas === 'function') {
        cargarTablaHistorialCargas();
    }
    if (aplicacionActiva && seccionActiva === 'energia' && typeof cargarLibroRegistro === 'function') {
        cargarLibroRegistro();
    }
    if (aplicacionActiva && seccionActiva === 'alertas' && typeof cargarAlertasRecientes === 'function') {
        cargarAlertasRecientes();
    }
    cerrarMenuMovil();
}

function abrirMenuMovil() {
    const sidebar = document.getElementById('sidebarPrincipal');
    const overlay = document.getElementById('sidebarOverlay');
    const boton = document.getElementById('btnAbrirMenu');
    if (!sidebar || !overlay || window.matchMedia('(min-width: 1025px)').matches) return;
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    boton?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-movil-abierto');
    document.getElementById('btnCerrarMenu')?.focus();
}

function cerrarMenuMovil() {
    const sidebar = document.getElementById('sidebarPrincipal');
    const overlay = document.getElementById('sidebarOverlay');
    const boton = document.getElementById('btnAbrirMenu');
    if (!sidebar || !overlay) return;
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    boton?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-movil-abierto');
}

function aplicarPermisosPorRol(rol) {
    const rolValido = ['administrador', 'cliente'].includes(rol) ? rol : 'cliente';
    const esAdmin = rolValido === 'administrador';
    const accionesAdministrador = [
        '[data-role-required="administrador"]',
        '.admin-only',
        '[data-bs-target="#modalBateria"]',
        '#btnRegistrarBateria',
        '.btn-registrar-bateria',
        '#vistaCargas .btn-success',
        '.btn-nueva-carga',
        '.columna-acciones-admin',
        '.btn-admin-only'
    ].join(', ');

    document.body.dataset.perfilVista = rolValido;
    document.querySelectorAll(accionesAdministrador).forEach((elemento) => {
        elemento.hidden = !esAdmin;
        if (esAdmin) {
            elemento.style.removeProperty('display');
        } else {
            elemento.style.setProperty('display', 'none', 'important');
        }
    });

    if (!esAdmin) {
        window.UI?.cerrarModalBateria();
    }

    navegarSeccion();
    console.info(`Vista previa de permisos aplicada para el rol: ${rolValido}`);
}

function actualizarInterfazSegunRol(usuario) {
    const rol = ['administrador', 'cliente'].includes(usuario?.rol) ? usuario.rol : 'cliente';
    const usuarioActual = usuario && ['administrador', 'cliente'].includes(usuario.rol)
        ? { ...usuario, rol }
        : null;
    const etiquetaRol = document.getElementById('lblUsuarioRol');
    const panelCliente = document.getElementById('infoClienteRenta');
    const panelAdministrador = document.getElementById('panelAdminDashboard');
    const tituloDashboard = document.getElementById('dashboard-title');
    const etiquetaNavegacionPrincipal = document.getElementById('navPrincipalLabel');
    const etiquetaRolHeader = document.getElementById('lblUsuarioRolHeader');
    const etiquetaRolMovil = document.getElementById('lblUsuarioRolMobile');

    actualizarUsuarioSidebar(usuarioActual);
    if (etiquetaRol) {
        etiquetaRol.className = `sidebar-user-role badge ${rol === 'administrador' ? 'bg-danger' : 'bg-primary'}`;
        etiquetaRol.textContent = rol.toUpperCase();
    }
    if (etiquetaRolHeader) {
        etiquetaRolHeader.className = `sidebar-role-badge ${rol === 'administrador' ? 'bg-danger' : 'bg-primary'}`;
        etiquetaRolHeader.textContent = rol.toUpperCase();
    }
    if (etiquetaRolMovil) {
        etiquetaRolMovil.className = `mobile-role-badge ${rol === 'administrador' ? 'bg-danger' : 'bg-primary'}`;
        etiquetaRolMovil.textContent = rol.toUpperCase();
    }
    if (panelCliente) {
        panelCliente.hidden = rol !== 'cliente';
    }
    if (panelAdministrador) {
        panelAdministrador.hidden = rol !== 'administrador';
    }
    if (tituloDashboard) {
        tituloDashboard.textContent = rol === 'cliente' ? 'Mi vehículo' : 'Panel general';
    }
    if (etiquetaNavegacionPrincipal) {
        etiquetaNavegacionPrincipal.textContent = rol === 'cliente' ? 'Mi vehículo' : 'Panel general';
    }
    aplicarPermisosPorRol(rol);
    if (rol === 'cliente' && usuarioActual) {
        cargarDatosBateriaCliente();
    }
}

async function cargarDatosBateriaCliente() {
    const elementos = {
        bicicleta: document.getElementById('cliCodigoVehiculo'),
        estadoAlquiler: document.getElementById('cliEstadoAlquiler'),
        soc: document.getElementById('cliNivelBateria'),
        autonomia: document.getElementById('cliAutonomia'),
        codigo: document.getElementById('cliCodigoBateria'),
        estado: document.getElementById('cliEstadoBateria'),
        detalles: document.getElementById('cliDetallesBateria')
    };

    try {
        const response = await fetch('../api/api.php?action=bateria_cliente');
        const resultado = await response.json();
        if (!response.ok || resultado.status !== 'success') {
            throw new Error(resultado.message || `Error HTTP al consultar la batería: ${response.status}`);
        }

        const bateria = resultado.data;
        if (!bateria) {
            if (elementos.bicicleta) elementos.bicicleta.textContent = 'No tienes una batería asignada';
            if (elementos.estadoAlquiler) elementos.estadoAlquiler.textContent = 'Sin alquiler activo';
            if (elementos.soc) elementos.soc.textContent = '—';
            if (elementos.autonomia) elementos.autonomia.textContent = 'No disponible';
            if (elementos.codigo) elementos.codigo.textContent = 'No asignada';
            if (elementos.estado) elementos.estado.textContent = 'No disponible';
            if (elementos.detalles) elementos.detalles.textContent = 'Sin datos de batería asignada';
            return;
        }

        if (elementos.bicicleta) {
            elementos.bicicleta.textContent = bateria.bicicleta || 'Vehículo no especificado';
        }
        if (elementos.estadoAlquiler) elementos.estadoAlquiler.textContent = 'Alquiler activo';
        if (elementos.soc) elementos.soc.textContent = bateria.soc === null ? '—' : `${bateria.soc}%`;
        if (elementos.autonomia) {
            elementos.autonomia.textContent = bateria.autonomia_km === null
                ? 'No disponible'
                : `~ ${bateria.autonomia_km} km`;
        }
        if (elementos.codigo) elementos.codigo.textContent = bateria.codigo;
        if (elementos.estado) {
            elementos.estado.textContent = bateria.estado || 'Sin estado reportado';
        }
        if (elementos.detalles) {
            const temperatura = bateria.temperatura === null
                ? 'Temperatura no reportada'
                : `${bateria.temperatura} °C`;
            const soh = bateria.soh === null ? 'SOH no reportado' : `SOH ${bateria.soh}%`;
            elementos.detalles.textContent = `${temperatura} · ${soh}`;
        }
    } catch (error) {
        console.error('Error al cargar la batería asignada al cliente:', error);
        if (elementos.bicicleta) elementos.bicicleta.textContent = 'No se pudo cargar la asignación';
        if (elementos.estadoAlquiler) elementos.estadoAlquiler.textContent = 'Error de consulta';
        if (elementos.detalles) elementos.detalles.textContent = 'Intenta sincronizar más tarde.';
    }
}

function establecerAccesoAplicacion(autenticado) {
    const pantallaLogin = document.getElementById('pantallaLogin');
    if (autenticado && pantallaLogin?.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    document.querySelectorAll('.sidebar, .main-content').forEach((elemento) => {
        elemento.inert = !autenticado;
    });
    if (pantallaLogin) {
        pantallaLogin.hidden = autenticado;
        if (autenticado) {
            pantallaLogin.style.setProperty('display', 'none', 'important');
        } else {
            pantallaLogin.style.removeProperty('display');
        }
        pantallaLogin.setAttribute('aria-hidden', autenticado ? 'true' : 'false');
    }

    if (!autenticado) {
        document.getElementById('txtEmail')?.focus();
    }
}

async function cargarRolDeSesion() {
    await cerrarSesionAPI();
    const datos = await obtenerSesionActualAPI();
    if (!datos || datos.status !== 'success') {
        throw new Error(datos?.message || 'No se pudo consultar la sesión.');
    }

    const usuario = datos.autenticado ? datos.usuario : null;
    const rol = ['administrador', 'cliente'].includes(usuario?.rol) ? usuario.rol : 'cliente';
    return { usuario, rol };
}

function actualizarUsuarioSidebar(usuario) {
    const nombre = document.getElementById('lblUsuarioNombre');
    const rol = document.getElementById('lblUsuarioRol');
    const cambiarUsuario = document.getElementById('btnCambiarUsuario');
    const cerrarSesion = document.getElementById('btnCerrarSesion');
    const autenticado = Boolean(usuario);

    if (nombre) {
        nombre.textContent = autenticado ? usuario.nombre : 'Invitado';
    }
    if (rol) {
        rol.textContent = autenticado ? usuario.rol : 'cliente';
    }
    if (cambiarUsuario) {
        cambiarUsuario.textContent = autenticado ? 'Cambiar' : 'Iniciar sesión';
    }
    if (cerrarSesion) {
        cerrarSesion.hidden = !autenticado;
    }
}

function mostrarErrorLogin(mensaje) {
    const error = document.getElementById('loginError');
    if (error) {
        error.textContent = mensaje;
        error.hidden = false;
    }
}

function abrirModalLogin() {
    const modal = document.getElementById('modalLogin');
    const error = document.getElementById('loginError');
    if (!modal) {
        throw new Error('No se encontró el formulario de inicio de sesión.');
    }

    if (error) {
        error.hidden = true;
        error.textContent = '';
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('loginEmail')?.focus();
}

function cerrarModalLogin() {
    const modal = document.getElementById('modalLogin');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.getElementById('btnCambiarUsuario')?.focus();
    }
}

async function iniciarSesionDesdeFormulario(event) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const boton = document.getElementById('btnEnviarLogin');
    const datosFormulario = new FormData(formulario);
    const datos = Object.fromEntries(datosFormulario.entries());
    if (boton) {
        boton.disabled = true;
    }

    try {
        const resultado = await loginAPI(datos.email, datos.password);
        if (resultado.status !== 'success' || !resultado.usuario) {
            throw new Error(resultado.message || 'No se pudo iniciar sesión.');
        }

        const usuario = resultado.usuario;
        const selectorRol = document.getElementById('selectRolSistema');
        if (selectorRol) {
            selectorRol.value = usuario.rol;
        }
        actualizarInterfazSegunRol(usuario);
        establecerAccesoAplicacion(true);
        cerrarModalLogin();
        formulario.reset();
        if (typeof inicializarDatosAplicacion === 'function') {
            inicializarDatosAplicacion(usuario.rol);
        }
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `Sesión iniciada: ${usuario.rol.toUpperCase()}`,
                showConfirmButton: false,
                timer: 1800
            });
        }
    } catch (error) {
        mostrarErrorLogin(error.message || 'No se pudo conectar con el servidor.');
    } finally {
        if (boton) {
            boton.disabled = false;
        }
    }
}

async function iniciarSesionDesdePantalla(event) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const boton = document.getElementById('btnIngresarSistema');
    const error = document.getElementById('loginPantallaError');
    const datos = Object.fromEntries(new FormData(formulario).entries());
    if (boton) {
        boton.disabled = true;
    }
    if (error) {
        error.hidden = true;
        error.textContent = '';
    }

    try {
        const resultado = await loginAPI(datos.email, datos.password);
        if (resultado.status !== 'success' || !resultado.usuario) {
            throw new Error(resultado.message || 'No se pudo iniciar sesión.');
        }

        const usuario = resultado.usuario;
        const selectorRol = document.getElementById('selectRolSistema');
        if (selectorRol) {
            selectorRol.value = usuario.rol;
        }
        actualizarInterfazSegunRol(usuario);
        establecerAccesoAplicacion(true);
        formulario.reset();
        if (typeof inicializarDatosAplicacion === 'function') {
            inicializarDatosAplicacion(usuario.rol);
        }
    } catch (errorAutenticacion) {
        if (error) {
            error.textContent = errorAutenticacion.message || 'No se pudo conectar con el servidor.';
            error.hidden = false;
        }
    } finally {
        if (boton) {
            boton.disabled = false;
        }
    }
}

async function cerrarSesionActual() {
    const boton = document.getElementById('btnCerrarSesion');
    if (boton) {
        boton.disabled = true;
    }

    try {
        await cerrarSesionAPI();

        const selectorRol = document.getElementById('selectRolSistema');
        if (selectorRol) {
            selectorRol.value = 'cliente';
        }
        actualizarInterfazSegunRol(null);
        establecerAccesoAplicacion(false);
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'error', title: 'Error al cerrar sesión', text: error.message });
        } else {
            alert(error.message);
        }
    } finally {
        if (boton) {
            boton.disabled = false;
        }
    }
}

function alternarModoVisual(event) {
    event?.preventDefault();

    document.body.classList.toggle('dark-mode');
    const esOscuro = document.body.classList.contains('dark-mode');
    localStorage.setItem('tema_visual', esOscuro ? 'dark' : 'light');

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: esOscuro ? 'Modo oscuro activado' : 'Modo claro activado',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
    }
}

async function ejecutarSincronizacion(event) {
    event?.preventDefault();

    if (document.getElementById('lblUsuarioRol')?.textContent?.trim().toLowerCase() !== 'administrador') {
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'info',
                title: 'Sincronización no disponible',
                text: 'No hay telemetría de alquiler asignada a esta cuenta.'
            });
        }
        return;
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Sincronizando con la base de datos...',
            text: 'Consultando los datos más recientes.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
    }

    try {
        const resultados = await Promise.all([
            cargarResumenDashboard(),
            cargarInventarioBaterias(),
            cargarTablaHistorialCargas()
        ]);
        if (resultados.some((resultado) => resultado !== true)) {
            throw new Error('No se pudieron actualizar todos los datos.');
        }

        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'success',
                title: 'Sincronización exitosa',
                text: 'La información se actualizó desde la base de datos.',
                timer: 1800,
                showConfirmButton: false
            });
        } else {
            alert('Sincronización exitosa. La información se actualizó desde la base de datos.');
        }
    } catch (error) {
        console.error('Error al sincronizar los datos:', error);
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'error',
                title: 'Error de sincronización',
                text: 'No se pudieron actualizar todos los datos desde la API.'
            });
        } else {
            alert('No se pudieron actualizar todos los datos desde la API.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('hashchange', navegarSeccion);
    if (localStorage.getItem('tema_visual') === 'dark') {
        document.body.classList.add('dark-mode');
    }
    (document.getElementById('btnModoVisual') || document.querySelector('.btn-modo-visual'))
        ?.addEventListener('click', alternarModoVisual);
    (document.getElementById('btnSincronizar') || document.querySelector('.btn-sincronizar'))
        ?.addEventListener('click', ejecutarSincronizacion);
    const selectorRol = document.getElementById('selectRolSistema');
    if (selectorRol) {
        selectorRol.addEventListener('change', () => {
            aplicarPermisosPorRol(selectorRol.value);
            if (typeof cargarInventarioBaterias === 'function') {
                cargarInventarioBaterias();
            }
        });
    }
    document.getElementById('btnCambiarUsuario')?.addEventListener('click', abrirModalLogin);
    document.getElementById('btnAbrirMenu')?.addEventListener('click', abrirMenuMovil);
    document.getElementById('btnCerrarMenu')?.addEventListener('click', cerrarMenuMovil);
    document.getElementById('sidebarOverlay')?.addEventListener('click', cerrarMenuMovil);
    document.getElementById('btnCerrarSesion')?.addEventListener('click', cerrarSesionActual);
    document.getElementById('btnCerrarModalLogin')?.addEventListener('click', cerrarModalLogin);
    document.getElementById('btnCancelarLogin')?.addEventListener('click', cerrarModalLogin);
    document.getElementById('formLogin')?.addEventListener('submit', iniciarSesionDesdeFormulario);
    document.getElementById('formLoginPantalla')?.addEventListener('submit', iniciarSesionDesdePantalla);
    document.getElementById('modalLogin')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
            cerrarModalLogin();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarModalLogin();
            cerrarMenuMovil();
        }
    });
    window.matchMedia('(min-width: 1025px)').addEventListener('change', cerrarMenuMovil);
    navegarSeccion();
    establecerAccesoAplicacion(false);
    actualizarInterfazSegunRol(null);
    if (selectorRol) {
        selectorRol.value = 'cliente';
    }
    cargarRolDeSesion()
        .then(({ usuario, rol }) => {
            if (selectorRol) {
                selectorRol.value = rol;
            }
            actualizarInterfazSegunRol(usuario);
            establecerAccesoAplicacion(Boolean(usuario));
        })
        .catch((error) => {
            console.error('Error al cargar el rol de la sesión:', error);
            actualizarInterfazSegunRol(null);
            establecerAccesoAplicacion(false);
            if (selectorRol) {
                selectorRol.value = 'cliente';
            }
        });
});

window.UI = {
    navegarSeccion,
    async abrirModalBateria() {
        const modal = document.getElementById('modal-bateria');
        const codigo = document.getElementById('bateria-codigo');
        const codigoQr = document.getElementById('bateria-qr');
        const selectBicicleta = document.getElementById('bateriaBicicleta');

        if (!modal || !codigo || !codigoQr || !selectBicicleta) {
            throw new Error('No se encontró el formulario del modal de batería.');
        }

        modal.style.display = 'flex';
        codigo.value = '';
        codigoQr.value = '';
        selectBicicleta.innerHTML = '<option value="">Cargando bicicletas...</option>';

        try {
            const respuesta = await obtenerDatosFormularioBateria();
            if (!respuesta || respuesta.status !== 'success' || !respuesta.data) {
                throw new Error('La API no devolvió los datos del formulario.');
            }

            const { siguiente_codigo, bicicletas_disponibles } = respuesta.data;
            codigo.value = siguiente_codigo;
            codigo.readOnly = true;
            codigoQr.value = `QR-${siguiente_codigo}`;

            selectBicicleta.innerHTML = '<option value="">Sin bicicleta asignada</option>';
            bicicletas_disponibles.forEach((bicicleta) => {
                const option = document.createElement('option');
                option.value = bicicleta.id;
                option.textContent = `${bicicleta.codigo_unico} - ${bicicleta.modelo}`;
                selectBicicleta.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar el modal de batería:', error);
            selectBicicleta.innerHTML = '<option value="">No se pudieron cargar los datos</option>';
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de servidor',
                    text: error.message
                });
            } else {
                alert(error.message);
            }
        }
    },

    cerrarModalBateria() {
        const modal = document.getElementById('modal-bateria');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    async abrirModalCarga() {
        const modal = document.getElementById('modal-carga');
        const selectBateria = document.getElementById('carga-bateria');
        const selectEstacion = document.getElementById('carga-estacion');
        const error = document.getElementById('carga-error');
        if (!modal || !selectBateria || !selectEstacion) {
            throw new Error('No se encontró el formulario de nueva carga.');
        }

        if (error) {
            error.hidden = true;
            error.textContent = '';
        }
        document.getElementById('form-registrar-carga')?.reset();
        modal.style.display = 'flex';
        selectBateria.innerHTML = '<option value="">Cargando baterías...</option>';
        selectEstacion.innerHTML = '<option value="">Cargando estaciones...</option>';

        try {
            const respuesta = await fetch('../api/api.php?action=datos_formulario_carga', {
                credentials: 'same-origin'
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok || resultado.status !== 'success'
                || !Array.isArray(resultado.baterias) || !Array.isArray(resultado.estaciones)) {
                throw new Error(resultado.message || resultado.mensaje || 'No se pudieron cargar baterías y estaciones.');
            }

            selectBateria.replaceChildren(new Option('Seleccione una batería...', ''));
            resultado.baterias.forEach((bateria) => {
                selectBateria.add(new Option(bateria.codigo, bateria.codigo));
            });
            selectEstacion.replaceChildren(new Option('Seleccione una estación...', ''));
            resultado.estaciones.forEach((estacion) => {
                selectEstacion.add(new Option(`${estacion.codigo} · ${estacion.nombre}`, estacion.codigo));
            });
            if (resultado.baterias.length === 0 || resultado.estaciones.length === 0) {
                throw new Error('Registra al menos una batería y una estación antes de crear una carga.');
            }
        } catch (errorCarga) {
            console.error('Error al cargar las opciones de nueva carga:', errorCarga);
            if (error) {
                error.textContent = errorCarga.message;
                error.hidden = false;
            }
        }
    },

    cerrarModalCarga() {
        const modal = document.getElementById('modal-carga');
        if (modal) modal.style.display = 'none';
    }
};
