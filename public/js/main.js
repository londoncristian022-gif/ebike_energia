let miGraficoReporte = null;
let datosReporteActual = [];
let listaRegistrosEnergia = [];

document.addEventListener('DOMContentLoaded', () => {
    inicializarSimuladorEnergia();
    configurarRangoUltimoMesReporte();

    document.getElementById('selectTipoReporte')?.addEventListener('change', renderizarReporteSeleccionado);
    document.getElementById('btnFiltrarReporte')?.addEventListener('click', renderizarReporteSeleccionado);
    document.getElementById('btnExportarReporte')?.addEventListener('click', exportarReportePDF);
    document.getElementById('form-registrar-carga')?.addEventListener('submit', guardarNuevaCarga);

    const formBateria = document.getElementById('form-registrar-bateria');
    if (!formBateria) return;

    formBateria.addEventListener('submit', async (event) => {
        event.preventDefault();

        const datos = {
            codigo_bateria: document.getElementById('bateria-codigo').value,
            bicicleta_asignada: document.getElementById('bateriaBicicleta').value,
            codigo_qr: document.getElementById('bateria-qr').value,
            soc: document.getElementById('bateria-soc').value || 100,
            soh: document.getElementById('bateria-soh').value || 100
        };

        const resultado = await guardarBateriaAPI(datos);
        if (!resultado || resultado.status !== 'success') {
            const mensaje = resultado?.message || 'Error al guardar en la base de datos.';
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al guardar',
                    text: mensaje,
                    confirmButtonColor: '#dc3545'
                });
            } else {
                alert(mensaje);
            }
            return;
        }

        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'success',
                title: '¡Batería registrada!',
                text: resultado.message,
                confirmButtonColor: '#198754'
            });
        } else {
            alert(resultado.message);
        }

        if (window.UI) {
            UI.cerrarModalBateria();
        }
        formBateria.reset();
        await cargarInventarioBaterias();
        await cargarResumenDashboard();
    });
});

async function guardarNuevaCarga(event) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const boton = document.getElementById('btnGuardarCarga');
    const error = document.getElementById('carga-error');
    if (error) {
        error.hidden = true;
        error.textContent = '';
    }

    const datos = {
        codigo_bateria: document.getElementById('carga-bateria')?.value || '',
        codigo_estacion: document.getElementById('carga-estacion')?.value || '',
        porcentaje_inicial: document.getElementById('carga-soc-inic')?.value,
        porcentaje_final: document.getElementById('carga-soc-fin')?.value,
        tiempo_carga: document.getElementById('carga-duracion')?.value,
        energia_consumida: document.getElementById('carga-energia')?.value,
        estado_carga: document.getElementById('carga-estado')?.value || 'Completada'
    };

    if (boton) {
        boton.disabled = true;
        boton.textContent = 'Guardando...';
    }

    try {
        const respuesta = await fetch('../api/api.php?action=registrar_carga', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok || resultado.status !== 'success') {
            throw new Error(resultado.message || resultado.mensaje || 'No se pudo registrar la carga.');
        }

        formulario.reset();
        UI.cerrarModalCarga();
        await Promise.allSettled([
            cargarTablaHistorialCargas(),
            renderizarReporteSeleccionado()
        ]);
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'success',
                title: 'Carga registrada',
                text: resultado.message || 'La sesión quedó guardada en el historial.',
                confirmButtonColor: '#059669'
            });
        }
    } catch (errorCarga) {
        console.error('Error al registrar la sesión de carga:', errorCarga);
        if (error) {
            error.textContent = errorCarga.message;
            error.hidden = false;
        } else {
            alert(errorCarga.message);
        }
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Registrar Carga';
        }
    }
}

function inicializarDatosAplicacion(rol) {
    if (rol !== 'administrador') {
        return Promise.resolve([]);
    }

    return Promise.all([
        cargarResumenDashboard(),
        cargarInventarioBaterias(),
        cargarTablaHistorialCargas(),
        cargarLibroRegistro(),
        cargarAlertasRecientes(),
        renderizarReporteSeleccionado()
    ]);
}

function obtenerTotalRegistrosReporte(tipo, registros) {
    if (tipo !== 'consumo') return registros.length;
    const total = registros.reduce((suma, fila) => {
        const cantidad = Number(fila.total_registros);
        return suma + (Number.isFinite(cantidad) ? cantidad : 0);
    }, 0);
    return total || registros.length;
}

function configurarRangoUltimoMesReporte() {
    const fechaInicio = document.getElementById('fechaInicioReporte');
    const fechaFin = document.getElementById('fechaFinReporte');
    if (!fechaInicio || !fechaFin) return;

    const hoy = new Date();
    const primerDiaMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDiaMesAnterior = new Date(primerDiaMesActual.getTime() - 24 * 60 * 60 * 1000);
    const primerDiaMesAnterior = new Date(
        ultimoDiaMesAnterior.getFullYear(),
        ultimoDiaMesAnterior.getMonth(),
        1
    );
    const formatoFechaLocal = (fecha) => [
        fecha.getFullYear().toString().padStart(4, '0'),
        (fecha.getMonth() + 1).toString().padStart(2, '0'),
        fecha.getDate().toString().padStart(2, '0')
    ].join('-');

    fechaInicio.value = formatoFechaLocal(primerDiaMesAnterior);
    fechaFin.value = formatoFechaLocal(ultimoDiaMesAnterior);
}

function obtenerRangoFechasReporte() {
    const inicio = document.getElementById('fechaInicioReporte')?.value || '';
    const fin = document.getElementById('fechaFinReporte')?.value || '';
    if (!inicio || !fin || inicio > fin) {
        throw new Error('Selecciona un rango válido: la fecha inicial debe ser anterior o igual a la fecha final.');
    }
    return { inicio, fin };
}

async function renderizarReporteSeleccionado() {
    const tipo = document.getElementById('selectTipoReporte')?.value || 'consumo';
    const acciones = {
        consumo: 'reporte_consumo',
        alertas: 'reporte_alertas',
        flota: 'reporte_estado_flota',
        sesiones: 'reporte_sesiones_carga'
    };
    const estado = document.getElementById('estadoReporte');
    const total = document.getElementById('repTotalRegistros');
    const metrica = document.getElementById('repMetricaDestacada');
    if (!acciones[tipo]) return false;

    if (estado) estado.textContent = 'Cargando reporte...';
    try {
        const rango = obtenerRangoFechasReporte();
        const parametros = new URLSearchParams({ action: acciones[tipo], inicio: rango.inicio, fin: rango.fin });
        const respuesta = await fetch(`../api/api.php?${parametros.toString()}`, {
            credentials: 'same-origin'
        });
        const resultado = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
            throw new Error(resultado.message || resultado.mensaje || `Error HTTP al cargar el reporte: ${respuesta.status}`);
        }
        if (resultado.status !== 'success' || !Array.isArray(resultado.reporte)) {
            throw new Error(resultado.message || resultado.mensaje || 'La API devolvió un reporte no válido.');
        }

        datosReporteActual = resultado.reporte;
        if (total) total.textContent = String(obtenerTotalRegistrosReporte(tipo, datosReporteActual));
        const graficaCreada = dibujarGrafica(tipo, datosReporteActual);
        if (estado && graficaCreada) {
            estado.textContent = datosReporteActual.length
                ? ''
                : 'No hay datos disponibles para este reporte.';
        }
        return true;
    } catch (error) {
        console.error('Error al cargar reporte:', error);
        datosReporteActual = [];
        if (total) total.textContent = '0';
        if (metrica) metrica.textContent = '—';
        miGraficoReporte?.destroy();
        miGraficoReporte = null;
        if (estado) estado.textContent = error.message.startsWith('Selecciona un rango')
            ? error.message
            : 'No se pudo cargar el reporte. Verifica la sesión de administrador e inténtalo de nuevo.';
        return false;
    }
}

function prepararDatosGrafica(tipo, datos) {
    const colores = ['#059669', '#2563eb', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#64748b'];
    let labels = [];
    let valores = [];
    let etiqueta = '';
    let tipoGrafica = 'bar';
    let metrica = '—';

    if (tipo === 'consumo') {
        labels = datos.map((fila) => fila.nombre_estacion || fila.codigo_estacion || 'Estación');
        valores = datos.map((fila) => Number(fila.total_kwh ?? fila.total_consumo_kwh) || 0);
        etiqueta = 'Consumo total (kWh)';
        metrica = `${valores.reduce((suma, valor) => suma + valor, 0).toLocaleString('es-CO', {
            maximumFractionDigits: 1
        })} kWh`;
    } else if (tipo === 'alertas') {
        const conteo = new Map([
            ['CRITICA', 0],
            ['ADVERTENCIA', 0],
            ['INFORMACION', 0]
        ]);
        datos.forEach((fila) => {
            const riesgo = String(fila.nivel_riesgo || 'SIN CLASIFICAR').toUpperCase();
            conteo.set(riesgo, (conteo.get(riesgo) || 0) + 1);
        });
        labels = [...conteo.keys()].filter((riesgo) => conteo.get(riesgo) > 0);
        valores = labels.map((riesgo) => conteo.get(riesgo));
        etiqueta = 'Cantidad de alertas';
        tipoGrafica = 'doughnut';
        metrica = `${conteo.get('CRITICA')} críticas`;
    } else if (tipo === 'flota') {
        const conteo = new Map();
        datos.forEach((fila) => {
            const estado = String(fila.estado || 'Sin estado');
            conteo.set(estado, (conteo.get(estado) || 0) + 1);
        });
        labels = [...conteo.keys()];
        valores = labels.map((estado) => conteo.get(estado));
        etiqueta = 'Baterías por estado';
        tipoGrafica = 'pie';
        metrica = `${datos.reduce((suma, fila) => suma + (Number(fila.cantidad_baterias) || 0), 0)} módulos`;
    } else if (tipo === 'baterias') {
        labels = datos.map((fila) => fila.codigo || `Batería ${fila.id}`);
        valores = datos.map((fila) => fila.soh === null || fila.soh === undefined || fila.soh === ''
            ? null
            : Number(fila.soh));
        etiqueta = 'Salud de batería (SOH %)';
        const valoresConDato = valores.filter((valor) => Number.isFinite(valor));
        const promedio = valoresConDato.length
            ? valoresConDato.reduce((suma, valor) => suma + valor, 0) / valoresConDato.length
            : null;
        metrica = `SOH promedio: ${promedio === null ? 'sin dato' : `${promedio.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`}`;
    } else {
        const conteo = new Map();
        datos.forEach((fila) => {
            const estado = String(fila.estado_carga || 'Sin estado');
            conteo.set(estado, (conteo.get(estado) || 0) + 1);
        });
        labels = [...conteo.keys()];
        valores = labels.map((estado) => conteo.get(estado));
        etiqueta = 'Sesiones por estado';
        metrica = `${conteo.get('Completada') || 0} completadas`;
    }

    return { labels, valores, etiqueta, tipoGrafica, colores, metrica };
}

function dibujarGrafica(tipo, datos) {
    const canvas = document.getElementById('graficaReportes');
    const metrica = document.getElementById('repMetricaDestacada');
    if (!canvas || !metrica) return false;

    miGraficoReporte?.destroy();
    miGraficoReporte = null;

    const configuracion = prepararDatosGrafica(tipo, datos);
    metrica.textContent = configuracion.metrica;

    if (typeof Chart !== 'function') {
        document.getElementById('estadoReporte').textContent = 'No se pudo cargar Chart.js; los datos siguen disponibles para exportar.';
        return false;
    }

    miGraficoReporte = new Chart(canvas, {
        type: configuracion.tipoGrafica,
        data: {
            labels: configuracion.labels,
            datasets: [{
                label: configuracion.etiqueta,
                data: configuracion.valores,
                backgroundColor: configuracion.labels.map((_, indice) => configuracion.colores[indice % configuracion.colores.length]),
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: configuracion.tipoGrafica === 'bar' ? {
                y: { beginAtZero: true }
            } : undefined
        }
    });
    return true;
}

function generarImagenGraficoTemporal(tipo, datos) {
    if (typeof Chart !== 'function' || datos.length === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 390;
    const contexto = canvas.getContext('2d');
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    const configuracion = prepararDatosGrafica(tipo, datos);
    const grafico = new Chart(canvas, {
        type: configuracion.tipoGrafica,
        data: {
            labels: configuracion.labels,
            datasets: [{
                label: configuracion.etiqueta,
                data: configuracion.valores,
                backgroundColor: configuracion.labels.map((_, indice) => configuracion.colores[indice % configuracion.colores.length]),
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            animation: false,
            responsive: false,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: configuracion.tipoGrafica === 'bar' ? { y: { beginAtZero: true } } : undefined
        }
    });
    const imagen = canvas.toDataURL('image/png', 1);
    grafico.destroy();
    return { data: imagen, width: canvas.width, height: canvas.height };
}

function crearAnalisisOperativo(tipo, registros) {
    const numero = (valor) => {
        if (valor === null || valor === undefined || valor === '') return null;
        const resultado = Number(valor);
        return Number.isFinite(resultado) ? resultado : null;
    };
    const formato = (valor, decimales = 1) => Number(valor).toLocaleString('es-CO', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
    const conteoPor = (campo) => registros.reduce((conteos, fila) => {
        const clave = String(fila[campo] || 'Sin dato').trim();
        conteos[clave] = (conteos[clave] || 0) + 1;
        return conteos;
    }, {});
    const esperadoSinMeta = (indicadores) =>
        `No hay metas cuantitativas configuradas para ${indicadores}. Este informe presenta una línea base descriptiva y no declara cumplimiento o desviación.`;

    if (tipo === 'sesiones') {
        const estados = conteoPor('estado_carga');
        const obtenerConteo = (estado) => Number(estados[estado] || estados[estado.toLowerCase()] || 0);
        const completadas = obtenerConteo('Completada');
        const enCurso = obtenerConteo('En Curso');
        const fallidas = obtenerConteo('Fallida');
        const interrumpidas = obtenerConteo('Interrumpida');
        const duraciones = registros.map((fila) => numero(fila.tiempo_carga)).filter((valor) => valor !== null);
        const variacionesSoc = registros.map((fila) => {
            const inicial = numero(fila.porcentaje_inicial);
            const final = numero(fila.porcentaje_final);
            return inicial === null || final === null ? null : final - inicial;
        }).filter((valor) => valor !== null);
        const duracionPromedio = duraciones.length
            ? `${formato(duraciones.reduce((suma, valor) => suma + valor, 0) / duraciones.length)} min`
            : 'sin datos de duración';
        const variacionPromedio = variacionesSoc.length
            ? `${formato(variacionesSoc.reduce((suma, valor) => suma + valor, 0) / variacionesSoc.length)} puntos porcentuales`
            : 'sin datos de SOC inicial/final';
        const mejoras = [];
        if (fallidas + interrumpidas > 0) {
            mejoras.push(`Revisar las ${fallidas} sesiones fallidas y ${interrumpidas} interrumpidas; la base no registra sus causas y este informe no atribuye el resultado a una estación o componente.`);
        } else {
            mejoras.push('No aparecen sesiones fallidas ni interrumpidas en estos datos; mantener el seguimiento y definir una meta de continuidad.');
        }
        const sinAumentoSoc = variacionesSoc.filter((valor) => valor <= 0).length;
        if (sinAumentoSoc > 0) {
            mejoras.push(`Validar los datos de SOC inicial y final en ${sinAumentoSoc} sesiones sin aumento de carga.`);
        }
        if (enCurso > 0) mejoras.push(`Verificar el cierre y la duración final de las ${enCurso} sesiones que siguen en curso.`);
        return [
            ['Metas', esperadoSinMeta('SOC final, duración y porcentaje de sesiones completadas')],
            ['Avances', `${registros.length} sesiones: ${completadas} completadas (${formato(registros.length ? completadas * 100 / registros.length : 0)} %), ${enCurso} en curso, ${fallidas} fallidas y ${interrumpidas} interrumpidas. Variación media de SOC: ${variacionPromedio}; duración media: ${duracionPromedio}.`],
            ['Acciones de mejora', mejoras.join(' ')]
        ];
    }

    if (tipo === 'consumo') {
        const filasConsumo = registros.map((fila) => ({
            fila,
            kwh: numero(fila.total_kwh ?? fila.total_consumo_kwh)
        })).filter((item) => item.kwh !== null);
        const total = filasConsumo.reduce((suma, item) => suma + item.kwh, 0);
        const principal = [...filasConsumo].sort((a, b) => b.kwh - a.kwh)[0];
        const nombreMayor = principal
            ? principal.fila.nombre_estacion || principal.fila.codigo_estacion || 'Sin identificar'
            : 'Sin datos';
        const participacion = principal && total > 0 ? principal.kwh * 100 / total : 0;
        const totalCosto = registros.reduce((suma, fila) => suma + (numero(fila.total_costo_cop) || 0), 0);
        const cantidadRegistros = obtenerTotalRegistrosReporte('consumo', registros);
        const costoTexto = registros.some((fila) => numero(fila.total_costo_cop) !== null)
            ? `COP ${formato(totalCosto, 0)}`
            : 'sin datos de costo';
        return [
            ['Metas', esperadoSinMeta('presupuesto, consumo y distribución porcentual por estación')],
            ['Avances', `${cantidadRegistros} registros en ${filasConsumo.length} estaciones: ${formato(total, 2)} kWh y ${costoTexto}. Mayor participación: ${nombreMayor}, ${formato(participacion)} % del consumo.`],
            ['Acciones de mejora', `Usar la distribución por estación como línea base, acordar metas y presupuestos con el equipo de operación, y revisar los nodos de mayor participación (${nombreMayor}: ${formato(participacion)} %). No se clasifica como exceso sin un límite configurado.`]
        ];
    }

    if (tipo === 'alertas') {
        const niveles = conteoPor('nivel_riesgo');
        const estados = conteoPor('estado');
        const criticas = Number(niveles.CRITICA || niveles.Critica || 0);
        const activas = Number(estados.Activa || estados.activa || 0);
        const recomendacion = criticas || activas
            ? `Priorizar la revisión de las ${criticas} alertas críticas y dar seguimiento a las ${activas} alertas activas; validar su resolución en operación.`
            : 'Mantener el seguimiento periódico y acordar niveles objetivo de alertas por riesgo.';
        return [
            ['Metas', esperadoSinMeta('cantidad de alertas por nivel de riesgo ni tiempos de resolución')],
            ['Avances', `${registros.length} alertas: ${criticas} críticas, ${Number(niveles.ADVERTENCIA || 0)} advertencias y ${Number(niveles.INFORMACION || 0)} informativas; ${activas} activas.`],
            ['Acciones de mejora', recomendacion]
        ];
    }

    if (tipo === 'baterias') {
        const valoresSoh = registros.map((fila) => numero(fila.soh)).filter((valor) => valor !== null);
        const valoresSoc = registros.map((fila) => numero(fila.soc)).filter((valor) => valor !== null);
        const promedio = (valores) => valores.length
            ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length
            : null;
        const promedioSoh = promedio(valoresSoh);
        const promedioSoc = promedio(valoresSoc);
        const estados = conteoPor('estado');
        const sinSoh = registros.length - valoresSoh.length;
        return [
            ['Metas', esperadoSinMeta('SOH, SOC y criterios de mantenimiento de las baterías')],
            ['Avances', `${registros.length} baterías inventariadas. SOH promedio: ${promedioSoh === null ? 'sin dato' : `${formato(promedioSoh)} %`}; SOC promedio: ${promedioSoc === null ? 'sin dato' : `${formato(promedioSoc)} %`}. Sin valor SOH: ${sinSoh}. Estados: ${Object.entries(estados).map(([estado, cantidad]) => `${estado}: ${cantidad}`).join(', ') || 'sin datos'}.`],
            ['Acciones de mejora', `Definir umbrales de SOH y reglas de mantenimiento con el equipo técnico; completar el SOH de las baterías que no tienen valor antes de evaluar su condición.`]
        ];
    }

    const unidades = registros.reduce((suma, fila) => suma + (numero(fila.cantidad_baterias) || 0), 0);
    const promedioPonderado = (campo) => {
        const pares = registros.map((fila) => ({
            valor: numero(fila[campo]),
            peso: numero(fila.cantidad_baterias) || 0
        })).filter((par) => par.valor !== null && par.peso > 0);
        const peso = pares.reduce((suma, par) => suma + par.peso, 0);
        return peso ? pares.reduce((suma, par) => suma + par.valor * par.peso, 0) / peso : null;
    };
    const grupos = registros.map((fila) => `${fila.estado || 'Sin estado'}: ${numero(fila.cantidad_baterias) || 0}`).join(', ');
    const promedioSoc = promedioPonderado('soc_promedio');
    const promedioTemperatura = promedioPonderado('temperatura_promedio');
    const estadosCriticos = registros.filter((fila) => /mantenimiento|inactiva/i.test(String(fila.estado || '')));
    return [
        ['Metas', esperadoSinMeta('distribución por estado, SOC promedio ni temperatura promedio de la flota')],
        ['Avances', `${unidades} baterías en ${registros.length} grupos de estado (${grupos || 'sin datos'}). SOC promedio ponderado: ${promedioSoc === null ? 'sin dato' : `${formato(promedioSoc)} %`}; temperatura ponderada: ${promedioTemperatura === null ? 'sin dato' : `${formato(promedioTemperatura)} °C`}.`],
        ['Acciones de mejora', estadosCriticos.length
            ? `Revisar los grupos ${estadosCriticos.map((fila) => fila.estado).join(', ')} y definir criterios de atención y metas de SOC y temperatura.`
            : 'Mantener la revisión periódica por estado y definir límites de SOC y temperatura para evaluar desviaciones.']
    ];
}

async function exportarReportePDF() {
    const boton = document.getElementById("btnExportarReporte");
    if (!boton) return;

    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Generando informe consolidado...";

    const reportes = [
        { tipo: "consumo", accion: "reporte_consumo", titulo: "Consumo por Estación" },
        { tipo: "sesiones", accion: "reporte_sesiones_carga", titulo: "Sesiones de Carga" },
        { tipo: "flota", accion: "reporte_estado_flota", titulo: "Estado de la Flota" },
        { tipo: "alertas", accion: "reporte_alertas", titulo: "Alertas de Seguridad" },
        { tipo: "baterias", accion: "listar_baterias", titulo: "Estado de Baterías y SOH" }
    ];

    try {
        const rango = obtenerRangoFechasReporte();
        const jsPDF = window.jspdf?.jsPDF;
        if (typeof jsPDF !== "function") {
            throw new Error("No se pudo cargar la librería local de PDF.");
        }

        const reportesConDatos = await Promise.all(reportes.map(async (reporte) => {
            const parametros = new URLSearchParams({ action: reporte.accion });
            if (["reporte_consumo", "reporte_sesiones_carga", "reporte_alertas"].includes(reporte.accion)) {
                parametros.set("inicio", rango.inicio);
                parametros.set("fin", rango.fin);
            }
            const respuesta = await fetch("../api/api.php?" + parametros.toString(), {
                credentials: "same-origin"
            });
            if (!respuesta.ok) {
                throw new Error("Falló la consulta de " + reporte.titulo + " (HTTP " + respuesta.status + ").");
            }

            const resultado = await respuesta.json();
            const datos = reporte.tipo === "baterias"
                ? (resultado.baterias || resultado.data)
                : resultado.reporte;
            if (resultado.status !== "success" || !Array.isArray(datos)) {
                throw new Error("La API no devolvió datos válidos para " + reporte.titulo + ".");
            }
            return { ...reporte, datos };
        }));

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const anchoPagina = doc.internal.pageSize.getWidth();
        const altoPagina = doc.internal.pageSize.getHeight();
        const fecha = new Intl.DateTimeFormat("es-CO", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Bogota"
        }).format(new Date());
        const nombresCampos = {
            id: "ID",
            codigo: "Código",
            bicicleta: "Bicicleta",
            codigo_qr: "Código QR",
            soc: "SOC (%)",
            soh: "SOH (%)",
            temperatura: "Temperatura (°C)",
            vida_util: "Vida útil",
            codigo_estacion: "Código de estación",
            nombre_estacion: "Estación",
            total_registros: "Registros",
            total_kwh: "Consumo (kWh)",
            total_costo_cop: "Costo total (COP)",
            participacion_pct: "Participación (%)",
            id_alerta: "ID de alerta",
            codigo_bateria: "Batería",
            tipo_alerta: "Tipo de alerta",
            nivel_riesgo: "Nivel de riesgo",
            mensaje: "Mensaje",
            estado: "Estado",
            fecha_alerta: "Fecha de alerta",
            cantidad_baterias: "Cantidad de baterías",
            soc_promedio: "SOC promedio (%)",
            temperatura_promedio: "Temperatura promedio (°C)",
            id_historial: "ID de sesión",
            porcentaje_inicial: "SOC inicial (%)",
            porcentaje_final: "SOC final (%)",
            energia_consumida: "Energía (kWh)",
            tiempo_carga: "Duración (min)",
            estado_carga: "Estado de carga",
            fecha_carga: "Fecha de carga"
        };
        const aTexto = (valor, campo) => {
            if (valor === null || valor === undefined || valor === "") return "—";
            if (campo === "total_costo_cop") {
                return "COP " + Number(valor).toLocaleString("es-CO", { maximumFractionDigits: 0 });
            }
            if (typeof valor === "number") {
                return valor.toLocaleString("es-CO", { maximumFractionDigits: 2 });
            }
            return String(valor);
        };

        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, anchoPagina, 48, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(19);
        doc.text("Informe Ejecutivo Integral de Flota E-Bike", 14, 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Consolidado de operación | Generado: " + fecha, 14, 28);
        doc.setFontSize(9);
        doc.text("Incluye " + reportesConDatos.length + " modulos consultados al generar el documento.", 14, 43);

        doc.text("Período: " + rango.inicio + " al " + rango.fin + " | Base: e_bike_bateria", 14, 36);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Contenido del informe", 14, 61);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        reportesConDatos.forEach((reporte, indice) => {
            doc.text((indice + 1) + ". " + reporte.titulo + " (" + reporte.datos.length + " filas)", 18, 71 + indice * 9);
        });
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Las metas se muestran como no configuradas cuando la base de datos no define un objetivo cuantitativo.", 14, 128, {
            maxWidth: anchoPagina - 28
        });

        for (let indice = 0; indice < reportesConDatos.length; indice += 1) {
            const reporte = reportesConDatos[indice];
            const tipo = reporte.tipo;
            const datos = reporte.datos;
            doc.addPage();

            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, anchoPagina, 25, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text((indice + 1) + ". " + reporte.titulo, 14, 16);

            const configuracionGrafica = prepararDatosGrafica(tipo, datos);
            const totalRegistros = obtenerTotalRegistrosReporte(tipo, datos);
            const metrica = configuracionGrafica.metrica || "—";
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, 31, (anchoPagina - 36) / 2, 20, 2, 2, "F");
            doc.roundedRect(anchoPagina / 2 + 4, 31, (anchoPagina - 36) / 2, 20, 2, 2, "F");
            doc.setTextColor(100, 116, 139);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text("TOTAL DE REGISTROS", 18, 38);
            doc.text("MÉTRICA DESTACADA", anchoPagina / 2 + 8, 38);
            doc.setTextColor(37, 99, 235);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(String(totalRegistros), 18, 47);
            doc.text(doc.splitTextToSize(metrica, (anchoPagina - 48) / 2), anchoPagina / 2 + 8, 47);

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(10);
            doc.text("Metas, avances y acciones de mejora", 14, 61);
            doc.autoTable({
                startY: 65,
                head: [["Dimensión", "Análisis operativo"]],
                body: crearAnalisisOperativo(tipo, datos),
                theme: "striped",
                headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
                columnStyles: { 0: { cellWidth: 36, fontStyle: "bold" } },
                styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { top: 14, right: 14, bottom: 18, left: 14 }
            });

            let posY = (doc.lastAutoTable?.finalY || 65) + 7;
            const imagen = generarImagenGraficoTemporal(tipo, datos);
            if (imagen) {
                const anchoDisponible = anchoPagina - 30;
                const altoDisponible = 62;
                const escala = Math.min(anchoDisponible / imagen.width, altoDisponible / imagen.height);
                const anchoGrafica = imagen.width * escala;
                const altoGrafica = imagen.height * escala;
                if (posY + altoGrafica + 25 > altoPagina - 16) {
                    doc.addPage();
                    posY = 18;
                }
                doc.addImage(imagen.data, "PNG", (anchoPagina - anchoGrafica) / 2, posY, anchoGrafica, altoGrafica);
                posY += altoGrafica + 8;
            } else {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text("No hay datos para representar en una gráfica.", 14, posY + 5);
                posY += 14;
            }

            if (posY > altoPagina - 32) {
                doc.addPage();
                posY = 18;
            }
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("Detalle de registros", 14, posY);
            posY += 4;

            if (datos.length === 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.text("No hay registros para este módulo.", 14, posY + 6);
                continue;
            }

            const columnas = Object.keys(datos[0]);
            const columnasTabla = tipo === "consumo" ? [...columnas, "participacion_pct"] : columnas;
            const totalKwh = tipo === "consumo"
                ? datos.reduce((suma, fila) => suma + (Number(fila.total_kwh ?? fila.total_consumo_kwh) || 0), 0)
                : 0;
            doc.autoTable({
                startY: posY,
                head: [columnasTabla.map((campo) => nombresCampos[campo] || campo.replace(/_/g, " "))],
                body: datos.map((fila) => columnasTabla.map((campo) => {
                    if (campo === "participacion_pct") {
                        const consumoFila = Number(fila.total_kwh ?? fila.total_consumo_kwh) || 0;
                        return totalKwh > 0
                            ? (consumoFila * 100 / totalKwh).toLocaleString("es-CO", { maximumFractionDigits: 2 }) + " %"
                            : "—";
                    }
                    return aTexto(fila[campo], campo);
                })),
                theme: "striped",
                headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
                styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { top: 14, right: 14, bottom: 18, left: 14 },
                horizontalPageBreak: true,
                horizontalPageBreakRepeat: [0]
            });
        }

        const totalPaginas = doc.internal.getNumberOfPages();
        for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
            doc.setPage(pagina);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text("E-Bike Energy | Informe Consolidado | Página " + pagina + " de " + totalPaginas, 14, altoPagina - 8);
        }

        const fechaArchivo = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
        doc.save("informe_consolidado_ebike_" + rango.inicio + "_al_" + rango.fin + "_" + fechaArchivo + ".pdf");
    } catch (error) {
        console.error("Error al generar el informe consolidado:", error);
        alert(error.message || "No se pudo compilar el informe consolidado.");
    } finally {
        boton.disabled = false;
        boton.textContent = textoOriginal;
    }
}

function abrirModalNuevoRegistro() {
    const modal = document.getElementById('modalNuevoRegistro');
    const formulario = document.getElementById('formNuevoRegistro');
    if (!modal || !formulario) return;

    formulario.reset();
    document.getElementById('regTarifaCop').value = '850';
    document.getElementById('errorNuevoRegistro').hidden = true;
    document.getElementById('btnGuardarNuevoRegistro').disabled = false;
    calcularTotalRegistro();
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function cerrarModalNuevoRegistro() {
    const modal = document.getElementById('modalNuevoRegistro');
    if (!modal) return;

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function calcularTotalRegistro() {
    const consumo = Number.parseFloat(document.getElementById('regConsumoKwh')?.value) || 0;
    const tarifa = Number.parseFloat(document.getElementById('regTarifaCop')?.value) || 0;
    const total = document.getElementById('regTotalCop');
    if (total) {
        total.value = `$ ${new Intl.NumberFormat('es-CO', {
            maximumFractionDigits: 2
        }).format(consumo * tarifa)} COP`;
    }
}

async function guardarNuevoRegistro(event) {
    event.preventDefault();
    const boton = document.getElementById('btnGuardarNuevoRegistro');
    const error = document.getElementById('errorNuevoRegistro');
    const datos = {
        id_estacion: Number.parseInt(document.getElementById('regEstacionId').value, 10),
        consumo_kwh: Number.parseFloat(document.getElementById('regConsumoKwh').value),
        tarifa_cop_kwh: Number.parseFloat(document.getElementById('regTarifaCop').value),
        periodo_auditoria: document.getElementById('regPeriodo').value.trim()
    };

    if (!Number.isInteger(datos.id_estacion)
        || !Number.isFinite(datos.consumo_kwh) || datos.consumo_kwh <= 0
        || !Number.isFinite(datos.tarifa_cop_kwh) || datos.tarifa_cop_kwh <= 0
        || !datos.periodo_auditoria) {
        error.textContent = 'Completa todos los campos con valores válidos.';
        error.hidden = false;
        return;
    }

    boton.disabled = true;
    error.hidden = true;
    try {
        const respuesta = await fetch('../api/api.php?action=registrar_energia', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok || resultado.status !== 'success') {
            throw new Error(resultado.message || resultado.mensaje || `Error HTTP ${respuesta.status}`);
        }

        cerrarModalNuevoRegistro();
        const recargaExitosa = await cargarLibroRegistro();
        if (!recargaExitosa) {
            alert('El registro se guardó, pero no se pudo actualizar el libro de registro.');
            return;
        }
        alert(resultado.message || 'Registro guardado exitosamente.');
    } catch (errorGuardado) {
        console.error('Error al registrar consumo:', errorGuardado);
        error.textContent = errorGuardado.message || 'No se pudo guardar el registro.';
        error.hidden = false;
    } finally {
        boton.disabled = false;
    }
}

function descargarBalanceEnergia() {
    if (listaRegistrosEnergia.length === 0) {
        alert('No hay datos en el libro de registro para exportar.');
        return;
    }

    const encabezados = [
        ['id_registro', 'REGISTRO'],
        ['nombre_estacion', 'ESTACIÓN'],
        ['fecha_registro', 'FECHA'],
        ['consumo_kwh', 'CONSUMO (kWh)'],
        ['tarifa_cop_kwh', 'TARIFA (COP/kWh)'],
        ['costo_cop', 'TOTAL (COP)'],
        ['periodo_auditoria', 'ESTADO']
    ];
    const protegerCeldaCSV = (valor) => {
        let texto = valor == null ? '' : String(valor);
        if (/^[\u0000-\u0020]*[=+\-@]/.test(texto)) {
            texto = `'${texto}`;
        }
        return `"${texto.replace(/"/g, '""')}"`;
    };
    const separador = ';';
    const filas = [
        encabezados.map(([, titulo]) => protegerCeldaCSV(titulo)).join(separador),
        ...listaRegistrosEnergia.map((registro) => encabezados
            .map(([campo]) => protegerCeldaCSV(registro[campo]))
            .join(separador))
    ];
    const contenido = `\uFEFF${filas.join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `balance_energia_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Carga las métricas calculadas por la API para el panel general.
 */
async function cargarResumenDashboard() {
    try {
        const response = await fetch('../api/api.php?action=resumen');
        if (!response.ok) {
            throw new Error(`Error HTTP al cargar el resumen: ${response.status}`);
        }

        const respuesta = await response.json();
        if (respuesta.status !== 'success' || !respuesta.data) {
            throw new Error(respuesta.message || respuesta.mensaje || 'La API devolvió un resumen no válido.');
        }

        const datos = respuesta.data;
        const bateriasActivas = Number(datos.baterias_criticas || 0) + Number(datos.baterias_optimas || 0);
        const elBaterias = document.getElementById('metric-baterias-activas');
        const elSoc = document.getElementById('metric-soc-promedio');
        const elEstaciones = document.getElementById('metric-estaciones-activas');

        if (elBaterias) elBaterias.textContent = bateriasActivas;
        if (elSoc) elSoc.textContent = `${Number(datos.soc_promedio || 0).toFixed(1)}%`;
        if (elEstaciones) elEstaciones.textContent = `${Number(datos.flota_activa || 0)} estaciones activas`;
        return true;
    } catch (error) {
        console.error('Error al cargar resumen:', error);
        return false;
    }
}

/**
 * Carga y renderiza el inventario de baterías y su total.
 */
async function cargarInventarioBaterias() {
    const tbody = document.getElementById('tabla-baterias-body');
    if (!tbody) return false;

    try {
        const resultado = await obtenerListaBateriasAPI();
        if (!resultado || resultado.status !== 'success' || !Array.isArray(resultado.data)) {
            throw new Error(resultado?.message || 'La API devolvió una lista de baterías no válida.');
        }

        const baterias = resultado.data;
        const encabezado = document.getElementById('baterias-count');
        if (encabezado) {
            const total = Number.isInteger(resultado.total) ? resultado.total : baterias.length;
            encabezado.textContent = `Inventario de Baterías (${total})`;
        }

        tbody.replaceChildren();
        if (baterias.length === 0) {
            const fila = tbody.insertRow();
            const celda = fila.insertCell();
            celda.colSpan = 8;
            celda.className = 'text-center text-muted py-4';
            celda.textContent = 'No hay baterías registradas en E_Bike_Bateria.';
            return true;
        }

        baterias.forEach((bateria) => {
            const fila = tbody.insertRow();
            const columnas = [
                bateria.codigo,
                bateria.bicicleta || 'Sin asignar',
                bateria.codigo_qr || `QR-${bateria.codigo}`,
                `${bateria.soc}%`,
                `${bateria.soh}%`,
                `${bateria.temperatura} °C`,
                bateria.vida_util || 'N/D',
                bateria.estado
            ];

            columnas.forEach((valor, indice) => {
                const celda = fila.insertCell();
                if (indice === 0) {
                    const codigo = document.createElement('strong');
                    codigo.className = 'text-white';
                    codigo.textContent = valor;
                    celda.appendChild(codigo);
                } else if (indice === 2) {
                    const qr = document.createElement('span');
                    qr.className = 'badge-qr';
                    qr.textContent = valor;
                    celda.appendChild(qr);
                } else if (indice === 3) {
                    const soc = document.createElement('span');
                    soc.className = Number(bateria.soc) <= 40 ? 'badge-soc-warning' : 'badge-soc';
                    soc.textContent = valor;
                    celda.appendChild(soc);
                } else if (indice === 7) {
                    const estado = document.createElement('span');
                    estado.className = 'status-pill';
                    estado.textContent = valor;
                    celda.appendChild(estado);
                } else {
                    celda.textContent = valor;
                }
            });
        });
        return true;
    } catch (error) {
        console.error('Error al cargar inventario:', error);
        tbody.replaceChildren();
        const fila = tbody.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 8;
        celda.className = 'text-center text-danger py-4';
        celda.textContent = 'No se pudo cargar el inventario de baterías.';
        return false;
    }
}

/**
 * Renderiza la tabla de historial de cargas.
 */
async function cargarTablaHistorialCargas() {
    const tbody = document.getElementById('tabla-cargas-body');
    if (!tbody) return false;

    try {
        const respuesta = await fetch('../api/api.php?action=listar_cargas');
        if (!respuesta.ok) {
            throw new Error(`Error HTTP al cargar el historial: ${respuesta.status}`);
        }

        const json = await respuesta.json();
        const cargas = Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.cargas)
                ? json.cargas
                : null;

        if (json?.status !== 'success' || !cargas) {
            throw new Error(json?.message || json?.mensaje || 'La API devolvió un historial de cargas no válido.');
        }

        tbody.replaceChildren();
        if (cargas.length === 0) {
            const fila = tbody.insertRow();
            const celda = fila.insertCell();
            celda.colSpan = 8;
            celda.className = 'text-center py-4 text-muted';
            celda.textContent = 'No hay registros de sesiones de carga';
            return true;
        }

        cargas.forEach((item) => {
            const fila = tbody.insertRow();
            const valores = [
                `CRG-${strPad(item.id, 3)}`,
                item.bateria,
                item.estacion,
                `${item.soc_inicio}%`,
                `${item.soc_fin}%`,
                `${item.duracion_min} min`,
                item.estado,
                `${item.energia_kwh} kWh`
            ];

            valores.forEach((valor, indice) => {
                const celda = fila.insertCell();
                if (indice === 0) {
                    const id = document.createElement('strong');
                    id.textContent = valor;
                    celda.appendChild(id);
                } else if (indice === 3 || indice === 4 || indice === 6) {
                    const badge = document.createElement('span');
                    const clasesEstado = {
                        'Completada': 'badge bg-success',
                        'En Curso': 'badge bg-warning text-dark',
                        'Fallida': 'badge bg-danger',
                        'Interrumpida': 'badge bg-secondary'
                    };
                    badge.className = indice === 3
                        ? 'badge bg-warning text-dark'
                        : indice === 4
                            ? 'badge bg-success'
                            : clasesEstado[item.estado] || 'badge bg-info text-dark';
                    badge.textContent = valor;
                    celda.appendChild(badge);
                } else {
                    celda.textContent = valor == null ? '' : String(valor);
                }
            });
        });
        return true;
    } catch (error) {
        console.error('Error al cargar historial de cargas:', error);
        tbody.replaceChildren();
        const fila = tbody.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 8;
        celda.className = 'text-center py-4 text-danger';
        celda.textContent = 'No se pudo cargar el historial de cargas.';
        return false;
    }
}

async function cargarLibroRegistro() {
    const tbody = document.getElementById('tabla-energia-body');
    if (!tbody) return false;

    try {
        const response = await fetch('../api/api.php?action=obtener_registro_energia');
        if (!response.ok) {
            throw new Error(`Error HTTP al cargar el libro de registro: ${response.status}`);
        }

        const resultado = await response.json();
        if (resultado.status !== 'success' || !Array.isArray(resultado.data)) {
            throw new Error(resultado.message || resultado.mensaje || 'La API devolvió registros de energía no válidos.');
        }

        listaRegistrosEnergia = resultado.data;
        tbody.replaceChildren();
        if (resultado.data.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 7;
            cell.className = 'text-center py-4 text-muted';
            cell.textContent = 'No hay registros de energía.';
            return true;
        }

        const formatoCOP = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        });
        resultado.data.forEach((registro, index) => {
            const row = tbody.insertRow();
            const values = [
                `REG-${1000 + Number(registro.id_registro || index + 1)}`,
                registro.nombre_estacion || registro.estacion_codigo || 'Estación sin nombre',
                registro.fecha_registro || '',
                `${Number(registro.consumo_kwh).toLocaleString('es-CO')} kWh`,
                `${formatoCOP.format(Number(registro.tarifa_cop_kwh))}/kWh`,
                formatoCOP.format(Number(registro.costo_cop)),
                registro.periodo_auditoria || 'Auditado'
            ];

            values.forEach((value, cellIndex) => {
                const cell = row.insertCell();
                cell.textContent = value;
                if (cellIndex === 0 || cellIndex === 5) {
                    cell.classList.add('fw-bold');
                }
                if (cellIndex === 5) {
                    cell.classList.add('text-success');
                }
            });
        });
        return true;
    } catch (error) {
        console.error('Error al cargar el libro de registro:', error);
        tbody.replaceChildren();
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.className = 'text-center py-4 text-danger';
        cell.textContent = 'No se pudo cargar el libro de registro.';
        return false;
    }
}

async function cargarAlertasRecientes() {
    const contenedor = document.getElementById('lista-alertas-container');
    if (!contenedor) return false;

    try {
        const response = await fetch('../api/api.php?action=obtener_alertas');
        if (!response.ok) {
            throw new Error(`Error HTTP al cargar las alertas: ${response.status}`);
        }

        const resultado = await response.json();
        if (resultado.status !== 'success' || !Array.isArray(resultado.data)) {
            throw new Error(resultado.message || resultado.mensaje || 'La API devolvió alertas no válidas.');
        }

        contenedor.replaceChildren();
        if (resultado.data.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'card-subtitle';
            empty.textContent = 'No hay alertas registradas.';
            contenedor.appendChild(empty);
            return true;
        }

        resultado.data.forEach((alerta) => {
            const item = document.createElement('article');
            item.className = 'alerta-item';
            const info = document.createElement('div');
            info.className = 'alerta-info-box';
            const icon = document.createElement('span');
            const riesgo = String(alerta.nivel_riesgo || '').toUpperCase();
            const critica = riesgo === 'CRITICA' || riesgo === 'CRÍTICA';
            icon.className = `alerta-icon ${critica ? 'icon-critica' : riesgo === 'ADVERTENCIA' ? 'icon-alta' : 'icon-media'}`;
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = critica ? '!' : riesgo === 'ADVERTENCIA' ? '⚠' : 'i';

            const detail = document.createElement('div');
            const heading = document.createElement('strong');
            heading.textContent = `${alerta.codigo_bateria || 'Batería'} · ${alerta.tipo_alerta || 'Alerta'}`;
            const message = document.createElement('p');
            message.className = 'card-subtitle';
            message.textContent = alerta.mensaje || '';
            const badge = document.createElement('span');
            badge.className = critica ? 'badge-critica' : riesgo === 'ADVERTENCIA' ? 'badge-alta' : 'badge-media';
            badge.textContent = riesgo || 'SIN CLASIFICAR';
            detail.append(heading, message, badge);
            info.append(icon, detail);

            const date = document.createElement('small');
            date.className = 'text-muted';
            date.textContent = alerta.fecha_alerta || '';
            item.append(info, date);
            contenedor.appendChild(item);
        });

        const totalCriticas = resultado.data.filter((alerta) => {
            const riesgo = String(alerta.nivel_riesgo || '').toUpperCase();
            return riesgo === 'CRITICA' || riesgo === 'CRÍTICA';
        }).length;
        const activas = document.getElementById('kpi-alertas-activas');
        const criticas = document.getElementById('kpi-alertas-criticas');
        if (activas) activas.textContent = String(resultado.data.length);
        if (criticas) criticas.textContent = String(totalCriticas);
        return true;
    } catch (error) {
        console.error('Error al cargar alertas:', error);
        contenedor.replaceChildren();
        const message = document.createElement('p');
        message.className = 'text-danger';
        message.textContent = 'No se pudieron cargar las alertas.';
        contenedor.appendChild(message);
        return false;
    }
}

function strPad(num, size) {
    return String(num).padStart(size, '0');
}

/**
 * Formatea un número como Peso Colombiano (COP).
 */
function formatearCOP(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(valor) + ' COP';
}

/**
 * Inicializa el simulador de ahorro usando la tarifa estimada en COP.
 */
function inicializarSimuladorEnergia() {
    const inputConsumo = document.getElementById('sim-kwh');
    const rangeValle = document.getElementById('sim-porcentaje');
    const txtPorcentaje = document.getElementById('lbl-desplazamiento');
    const txtAhorro = document.getElementById('sim-ahorro');

    function calcular() {
        const kwh = Math.max(0, Number.parseFloat(inputConsumo?.value) || 0);
        const porcentaje = Math.min(100, Math.max(0, Number.parseFloat(rangeValle?.value) || 0));

        if (txtPorcentaje) {
            txtPorcentaje.textContent = `${porcentaje}%`;
        }

        const tarifaBaseCOP = 850;
        const porcentajeAhorroValle = 0.25;
        const ahorroCalculado = kwh * (porcentaje / 100) * (tarifaBaseCOP * porcentajeAhorroValle);

        if (txtAhorro) {
            txtAhorro.textContent = formatearCOP(ahorroCalculado);
        }
    }

    if (!inputConsumo && !rangeValle) return;
    inputConsumo?.addEventListener('input', calcular);
    rangeValle?.addEventListener('input', calcular);
    calcular();
}
