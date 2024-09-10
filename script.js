document.addEventListener('DOMContentLoaded', handleFile);

let data = [];
let totalDiurnasSeconds = 0;
let totalNocturnasSeconds = 0;
let registroHoras = {};
let totals = {
    aprobadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
    rechazadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
    pendientes: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 }
};
const feriados = [
    '01-01', '29-03', '30-03', '01-05', '21-05', '09-06', '20-06', '29-06',
    '16-07', '15-08', '18-09', '19-09', '20-09', '12-10', '27-10', '31-10',
    '01-11', '08-12', '25-12'
];
function handleFile() {
    fetch('Data.dat')
        .then(response => response.text())
        .then(content => {
            parseData(content);
        })
        .catch(error => console.error('Error al cargar el archivo:', error));
}
function parseData(content) {
    const lines = content.split('\n');
    data = lines.map(line => {
        const splitLine = line.trim().split('\t');
        if (splitLine.length < 6) {
            return null;
        }
        const [id, timestamp, field1, field2, eventCode, field3] = splitLine;
        return {
            id: parseInt(id.trim()),
            timestamp: new Date(timestamp.trim()),
            field1: field1 ? field1.trim() : null,
            field2: field2 ? field2.trim() : null,
            eventCode: parseInt(eventCode ? eventCode.trim() : '0'),
            field3: field3 ? field3.trim() : null
        };
    }).filter(item => item !== null);

    
}
function filterData() {
    resetTotals();  // Resetear los totales antes de generar un nuevo reporte

    const idInput = parseInt(document.getElementById('idInput').value.trim());
    const monthInput = parseInt(document.getElementById('monthInput').value.trim()) - 1;
    const yearInput = parseInt(document.getElementById('yearInput').value.trim());

    const filteredData = data.filter(item => {
        const itemDate = new Date(item.timestamp);
        return (
            item.id === idInput &&
            itemDate.getMonth() === monthInput &&
            itemDate.getFullYear() === yearInput
        );
    });

    generateReport(filteredData);
}
function esFeriado(fecha) {
    const day = fecha.getDay(); // Obtener el día de la semana (0 es domingo, 6 es sábado)
    const formattedDate = `${("0" + fecha.getDate()).slice(-2)}-${("0" + (fecha.getMonth() + 1)).slice(-2)}`;

    // Agregar un console.log para depuración
    //console.log("Fecha:", fecha, "Día:", day, "¿Es feriado?", feriados.includes(formattedDate), "¿Es fin de semana?", (day === 0 || day === 6));

    // Verificar si es fin de semana o está en la lista de feriados
    return day === 0 || day === 6 || feriados.includes(formattedDate);
}
function calcularHorasExtras(startTime, endTime) {
    // Definir horarios del día laboral (de 08:33 a 17:33)
    const startOfWorkDay = new Date(startTime);
    startOfWorkDay.setHours(8, 33, 0, 0);

    const endOfWorkDay = new Date(startTime);
    endOfWorkDay.setHours(17, 33, 0, 0);

    const startOfDiurnalOvertime = new Date(startTime);
    startOfDiurnalOvertime.setHours(17, 34, 0, 0);

    const endOfDiurnalOvertime = new Date(startTime);
    endOfDiurnalOvertime.setHours(20, 59, 59, 999);

    const startOfNocturnalOvertime = new Date(startTime);
    startOfNocturnalOvertime.setHours(21, 0, 0, 0);

    let diurnalOvertimeSeconds = 0;
    let nocturnalOvertimeSeconds = 0;
    let workSeconds = 0;

    if (esFeriado(startTime)) {
        nocturnalOvertimeSeconds = (endTime - startTime) / 1000;
    } else {
        if (startTime < startOfWorkDay) {
            startTime = startOfWorkDay;
        }

        if (endTime <= endOfWorkDay) {
            workSeconds = (endTime - startTime) / 1000;
        } else {
            workSeconds = (endOfWorkDay - startTime) / 1000;

            if (endTime > endOfWorkDay && endTime <= endOfDiurnalOvertime) {
                diurnalOvertimeSeconds = (endTime - endOfWorkDay) / 1000;
            } else if (endTime > endOfDiurnalOvertime) {
                diurnalOvertimeSeconds = (endOfDiurnalOvertime - endOfWorkDay) / 1000;
                nocturnalOvertimeSeconds = (endTime - startOfNocturnalOvertime) / 1000;
            }
        }
    }

    // Agregar depuración
    //console.log("Diurnas:", diurnalOvertimeSeconds, "Nocturnas:", nocturnalOvertimeSeconds, "Laborales:", workSeconds);

    return {
        diurnalSeconds: Math.round(diurnalOvertimeSeconds),
        nocturnalSeconds: Math.round(nocturnalOvertimeSeconds),
        workSeconds: Math.round(workSeconds)
    };
}
function actualizarTotales(totals, status, horasExtrasDiurnas, horasExtrasNocturnas, restar = false) {
    const diurnasPartes = horasExtrasDiurnas.split(':');
    const nocturnasPartes = horasExtrasNocturnas.split(':');

    const segundosDiurnas = parseInt(diurnasPartes[0]) * 3600 + parseInt(diurnasPartes[1]) * 60 + parseInt(diurnasPartes[2]);
    const segundosNocturnas = parseInt(nocturnasPartes[0]) * 3600 + parseInt(nocturnasPartes[1]) * 60 + parseInt(nocturnasPartes[2]);

    // Factor determina si restamos o sumamos
    const factor = restar ? -1 : 1;

    if (status === "AUTORIZADO") {
        totals.aprobadas["25%"] += segundosDiurnas * factor;
        totals.aprobadas["50%"] += segundosNocturnas * factor;
    } else if (status === "RECHAZADO") {
        totals.rechazadas["25%"] += segundosDiurnas * factor;
        totals.rechazadas["50%"] += segundosNocturnas * factor;
    } else if (status === "PENDIENTE") {
        totals.pendientes["25%"] += segundosDiurnas * factor;
        totals.pendientes["50%"] += segundosNocturnas * factor;
    }
}
function mostrarResumen() {
    // Totales individuales por estado
    const totalAprobadasDiurnas = totals.aprobadas["25%"];
    const totalAprobadasNocturnas = totals.aprobadas["50%"];
    const totalRechazadasDiurnas = totals.rechazadas["25%"];
    const totalRechazadasNocturnas = totals.rechazadas["50%"];
    const totalPendientesDiurnas = totals.pendientes["25%"];
    const totalPendientesNocturnas = totals.pendientes["50%"];

    // Sumar todos los totales sin restar entre estados
    const totalDiurnas = totalAprobadasDiurnas + totalRechazadasDiurnas + totalPendientesDiurnas;
    const totalNocturnas = totalAprobadasNocturnas + totalRechazadasNocturnas + totalPendientesNocturnas;

    // Formatear los totales para mostrarlos en hh:mm:ss
    const totalDiurnasFormatted = formatTime(totalDiurnas);
    const totalNocturnasFormatted = formatTime(totalNocturnas);
    const totalAprobadasDiurnasFormatted = formatTime(totalAprobadasDiurnas);
    const totalAprobadasNocturnasFormatted = formatTime(totalAprobadasNocturnas);
    const totalRechazadasDiurnasFormatted = formatTime(totalRechazadasDiurnas);
    const totalRechazadasNocturnasFormatted = formatTime(totalRechazadasNocturnas);
    const totalPendientesDiurnasFormatted = formatTime(totalPendientesDiurnas);
    const totalPendientesNocturnasFormatted = formatTime(totalPendientesNocturnas);

    // Mostrar el resumen en el contenedor HTML
    document.getElementById('resumen-container').innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <h3>Total H.E. Aprobadas</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Diurnas al 25%:</td><td>${totalAprobadasDiurnasFormatted}</td></tr>
                        <tr><td>Total H. E. Nocturnas al 50%:</td><td>${totalAprobadasNocturnasFormatted}</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-4">
                <h3>Total H.E. Rechazadas</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Diurnas al 25%:</td><td>${totalRechazadasDiurnasFormatted}</td></tr>
                        <tr><td>Total H. E. Nocturnas al 50%:</td><td>${totalRechazadasNocturnasFormatted}</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-4">
                <h3>Total H.E. Pendientes</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Diurnas al 25%:</td><td>${totalPendientesDiurnasFormatted}</td></tr>
                        <tr><td>Total H. E. Nocturnas al 50%:</td><td>${totalPendientesNocturnasFormatted}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
      
        <div class="row">
            <div class="col-md-12">
                <h3>Suma Total de Horas Extras</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td><strong>Suma Total Horas Extras Aprobadas Diurnas + Nocturnas:</strong></td><td><strong>${formatTime(totalAprobadasDiurnas + totalAprobadasNocturnas)}</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Para depuración: mostrar en consola los valores totales
    console.log("Totales Aprobadas Diurnas:", totalAprobadasDiurnasFormatted);
    console.log("Totales Rechazadas Diurnas:", totalRechazadasDiurnasFormatted);
    console.log("Totales Pendientes Diurnas:", totalPendientesDiurnasFormatted);
    console.log("Total Horas Diurnas:", totalDiurnasFormatted);

    console.log("Totales Aprobadas Nocturnas:", totalAprobadasNocturnasFormatted);
    console.log("Totales Rechazadas Nocturnas:", totalRechazadasNocturnasFormatted);
    console.log("Totales Pendientes Nocturnas:", totalPendientesNocturnasFormatted);
    console.log("Total Horas Nocturnas:", totalNocturnasFormatted);
}
function generateReport(filteredData) {
    // Reiniciar los totales al generar un nuevo reporte
    totalDiurnasSeconds = 0;
    totalNocturnasSeconds = 0;
    
    let dailyData = {};

    // Recorrer los registros para generar los datos diarios
    filteredData.forEach(item => {
        const timestamp = new Date(item.timestamp);
        const dateKey = timestamp.toLocaleDateString();

        if (!dailyData[dateKey]) {
            // Crear un nuevo registro para la fecha
            dailyData[dateKey] = {
                id: item.id,
                date: dateKey,
                startTime: timestamp,
                endTime: timestamp,
                autoAssigned: false
            };
        } else {
            // Actualizar el registro existente si es la misma fecha
            if (timestamp < dailyData[dateKey].startTime) {
                dailyData[dateKey].startTime = timestamp;
            }
            if (timestamp > dailyData[dateKey].endTime) {
                dailyData[dateKey].endTime = timestamp;
            }
        }
    });

    let tableContent = "";

    for (let date in dailyData) {
        const record = dailyData[date];

        let startTimeFormatted = record.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let endTimeFormatted = record.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let alertMessage = "";
        let alertClass = '';

        let diurnalFormatted = "00:00:00";
        let nocturnalFormatted = "00:00:00";

        if (record.startTime.getTime() === record.endTime.getTime()) {
            alertMessage = `<span class="alert-text" style="color:red;">Falta de marcación - Horas extras no calculadas- Calcular manualmente</span>`;
        } else {
            let { diurnalSeconds, nocturnalSeconds } = calcularHorasExtras(record.startTime, record.endTime);

            diurnalFormatted = formatTime(diurnalSeconds);
            nocturnalFormatted = formatTime(nocturnalSeconds);

            totalDiurnasSeconds += diurnalSeconds;
            totalNocturnasSeconds += nocturnalSeconds;
        }

        if (diurnalFormatted === "00:00:00" && nocturnalFormatted === "00:00:00") {
            alertClass = 'alerta-horas';
        }

        tableContent += `
            <tr>
                <td class="${alertClass}">${record.date}</td>
                <td class="${alertClass}">${startTimeFormatted}</td>
                <td class="${alertClass}">${endTimeFormatted}</td>
                <td class="${alertClass}">${diurnalFormatted}</td>
                <td class="${alertClass}">${nocturnalFormatted}</td>
                <td class="${alertClass}">
                    <select class="status-select" onchange="updateTotal(this, '${record.date}', '${diurnalFormatted}', '${nocturnalFormatted}')">
                        <option value="AUTORIZADO" selected>AUTORIZADO</option>
                        <option value="RECHAZADO">RECHAZADO</option>
                        <option value="PENDIENTE">PENDIENTE</option>
                    </select>
                </td>
                <td>${alertMessage}</td>
            </tr>
        `;

        actualizarTotales(totals, 'AUTORIZADO', diurnalFormatted, nocturnalFormatted);
    }

    // Convertir los totales de segundos a formato hh:mm:ss
    let totalCombinedSeconds = totalDiurnasSeconds + totalNocturnasSeconds;
    let totalDiurnasFormatted = formatTime(totalDiurnasSeconds);
    let totalNocturnasFormatted = formatTime(totalNocturnasSeconds);
    let totalCombinedFormatted = formatTime(totalCombinedSeconds);

    // Añadir las filas de totales correctamente al final
    let totalRows = `
        <tr>
            <td colspan="3"><strong>Total</strong></td>
            <td><strong>${totalDiurnasFormatted}</strong></td>
            <td><strong>${totalNocturnasFormatted}</strong></td>
            <td></td>
        </tr>
        <tr>
            <td colspan="4"><strong>Total Combinado</strong></td>
            <td colspan="2"><strong>${totalCombinedFormatted}</strong></td>
        </tr>
    `;

    // Mostrar el contenido de la tabla en el DOM
    document.getElementById('output').innerHTML = `
        <h2>Reporte de Horas Extras</h2>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Hora Inicio</th>
                    <th>Hora Fin</th>
                    <th>Horas Extras Diurnas (25%)</th>
                    <th>Horas Extras Nocturnas/Feriado (50%)</th>
                    <th>Estado</th>
                    <th>Alerta</th>
                </tr>
            </thead>
            <tbody>
                ${tableContent}
            </tbody>
            <tfoot>
                ${totalRows}
            </tfoot>
        </table>
    `;

    // Aquí es donde se debe agregar el código para inicializar el estado anterior
    document.querySelectorAll('.status-select').forEach((selectElement) => {
        const currentStatus = selectElement.value;
        selectElement.setAttribute('data-previous-status', currentStatus); // Guardamos el estado inicial
    });

    // Mostrar el resumen
    mostrarResumen();

    // Mostrar los botones de descarga PDF y Excel una vez generado el reporte
    document.getElementById('downloadPdfBtn').style.display = 'block';
    document.getElementById('downloadExcelBtn').style.display = 'block';
}
function captureTotals() {
    let totalDiurnasFormatted = formatTime(totalDiurnasSeconds);
    let totalNocturnasFormatted = formatTime(totalNocturnasSeconds);
    let totalCombinedSeconds = totalDiurnasSeconds + totalNocturnasSeconds;
    let totalCombinedFormatted = formatTime(totalCombinedSeconds);

    let totalRows = `
        <tr>
            <td colspan="3"><strong>Total</strong></td>
            <td><strong>${totalDiurnasFormatted}</strong></td>
            <td><strong>${totalNocturnasFormatted}</strong></td>
            <td></td>
        </tr>
        <tr>
            <td colspan="4"><strong>Total Combinado</strong></td>
            <td colspan="2"><strong>${totalCombinedFormatted}</strong></td>
        </tr>
    `;

    document.getElementById('output').innerHTML += `
        <tfoot>
            ${totalRows}
        </tfoot>
    `;
}
function generateReport(filteredData) {
    // Reiniciar los totales al generar un nuevo reporte
    totalDiurnasSeconds = 0;
    totalNocturnasSeconds = 0;
    
    let dailyData = {};

    // Recorrer los registros para generar los datos diarios
    filteredData.forEach(item => {
        const timestamp = new Date(item.timestamp);
        const dateKey = timestamp.toLocaleDateString();

        if (!dailyData[dateKey]) {
            // Crear un nuevo registro para la fecha
            dailyData[dateKey] = {
                id: item.id,
                date: dateKey,
                startTime: timestamp,
                endTime: timestamp,
                autoAssigned: false
            };
        } else {
            // Actualizar el registro existente si es la misma fecha
            if (timestamp < dailyData[dateKey].startTime) {
                dailyData[dateKey].startTime = timestamp;
            }
            if (timestamp > dailyData[dateKey].endTime) {
                dailyData[dateKey].endTime = timestamp;
            }
        }
    });

    let tableContent = "";

    for (let date in dailyData) {
        const record = dailyData[date];

        let startTimeFormatted = record.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let endTimeFormatted = record.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let alertMessage = "";
        let alertClass = '';

        let diurnalFormatted = "00:00:00";
        let nocturnalFormatted = "00:00:00";

        if (record.startTime.getTime() === record.endTime.getTime()) {
            alertMessage = `<span class="alert-text" style="color:red;">Falta de marcación - Horas extras no calculadas- Calcular manualmente</span>`;
        } else {
            let { diurnalSeconds, nocturnalSeconds } = calcularHorasExtras(record.startTime, record.endTime);

            diurnalFormatted = formatTime(diurnalSeconds);
            nocturnalFormatted = formatTime(nocturnalSeconds);

            totalDiurnasSeconds += diurnalSeconds;
            totalNocturnasSeconds += nocturnalSeconds;
        }

        if (diurnalFormatted === "00:00:00" && nocturnalFormatted === "00:00:00") {
            alertClass = 'alerta-horas';
        }

        tableContent += `
    <tr>
        <td class="${alertClass}">${record.date}</td>
        <td class="${alertClass}">${startTimeFormatted}</td>
        <td class="${alertClass}">${endTimeFormatted}</td>
        <td class="${alertClass}">${diurnalFormatted}</td>
        <td class="${alertClass}">${nocturnalFormatted}</td>
        <td class="${alertClass}">
            <select class="status-select" data-date="${record.date}" onchange="updateTotal(this, '${record.date}', '${diurnalFormatted}', '${nocturnalFormatted}')">
                <option value="AUTORIZADO" selected>AUTORIZADO</option>
                <option value="RECHAZADO">RECHAZADO</option>
                <option value="PENDIENTE">PENDIENTE</option>
            </select>
        </td>
        <td>${alertMessage}</td>
    </tr>
`;


        actualizarTotales(totals, 'AUTORIZADO', diurnalFormatted, nocturnalFormatted);
    }
    // Convertir los totales de segundos a formato hh:mm:ss
    let totalCombinedSeconds = totalDiurnasSeconds + totalNocturnasSeconds;
    
    // Formatear totales
    let totalDiurnasFormatted = formatTime(totalDiurnasSeconds);
    let totalNocturnasFormatted = formatTime(totalNocturnasSeconds);
    let totalCombinedFormatted = formatTime(totalCombinedSeconds);

    // Añadir las filas de totales correctamente al final
    let totalRows = `
        <tr>
            <td colspan="3"><strong>Total</strong></td>
            <td><strong>${totalDiurnasFormatted}</strong></td>
            <td><strong>${totalNocturnasFormatted}</strong></td>
            <td></td>
        </tr>
        <tr>
            <td colspan="4"><strong>Total Combinado</strong></td>
            <td colspan="2"><strong>${totalCombinedFormatted}</strong></td>
        </tr>
    `;

    // Mostrar el contenido de la tabla en el DOM
    document.getElementById('output').innerHTML = `
        <h2>Reporte de Horas Extras</h2>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Hora Inicio</th>
                    <th>Hora Fin</th>
                    <th>Horas Extras Diurnas (25%)</th>
                    <th>Horas Extras Nocturnas/Feriado (50%)</th>
                    <th>Estado</th>
                    <th>Alerta</th>
                </tr>
            </thead>
            <tbody>
                ${tableContent}
            </tbody>
            <tfoot>
                ${totalRows}
            </tfoot>
        </table>
    `;
    // Mostrar el contenido de la tabla en el DOM
    document.getElementById('output').innerHTML = `
        <h2>Reporte de Horas Extras</h2>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Hora Inicio</th>
                    <th>Hora Fin</th>
                    <th>Horas Extras Diurnas (25%)</th>
                    <th>Horas Extras Nocturnas/Feriado (50%)</th>
                    <th>Estado</th>
                    <th>Alerta</th>
                </tr>
            </thead>
            <tbody>
                ${tableContent}
            </tbody>
            <tfoot>
                ${totalRows}
            </tfoot>
        </table>
    `;

    // Aquí es donde se debe agregar el código para inicializar el estado anterior
    document.querySelectorAll('.status-select').forEach((selectElement) => {
        const currentStatus = selectElement.value;
        selectElement.setAttribute('data-previous-status', currentStatus); // Guardamos el estado inicial
    });

    // Mostrar el resumen
    mostrarResumen();

    // Mostrar los botones de descarga PDF y Excel una vez generado el reporte
    document.getElementById('downloadPdfBtn').style.display = 'block';
    document.getElementById('downloadExcelBtn').style.display = 'block';
}
// Función para formatear correctamente los segundos a hh:mm:ss
function formatTime(seconds) {
    if (seconds < 0) return "00:00:00"; // Evitar mostrar tiempos negativos

    const hours = Math.floor(seconds / 3600); // Convertir a horas
    const mins = Math.floor((seconds % 3600) / 60); // Convertir a minutos
    const secs = seconds % 60; // Obtener segundos restantes

    // Asegurarse de que cada unidad tenga al menos 2 dígitos
    return [hours, mins, secs]
        .map(unit => String(unit).padStart(2, '0'))
        .join(':');
}
function convertirHorasASegundos(horasExtras) {
    if (!horasExtras) return 0;

    const partes = horasExtras.split(':').map(Number);
    const segundos = partes[0] * 3600 + partes[1] * 60 + partes[2];
    return segundos;
}
function updateTotal(selectElement, date, horasExtrasDiurnas, horasExtrasNocturnas) {
    const newStatus = selectElement.value;
    const previousStatus = selectElement.getAttribute('data-previous-status') || "";

    // Convertir horas extras a segundos para poder operar
    const segundosDiurnas = convertirHorasASegundos(horasExtrasDiurnas);
    const segundosNocturnas = convertirHorasASegundos(horasExtrasNocturnas);

    if (previousStatus && previousStatus !== newStatus) {
        // Si el estado cambia, restamos las horas del estado anterior
        actualizarTotales(totals, previousStatus, horasExtrasDiurnas, horasExtrasNocturnas, true);
    }

    // Sumar las horas del nuevo estado
    actualizarTotales(totals, newStatus, horasExtrasDiurnas, horasExtrasNocturnas);

    // Actualizamos el estado anterior con el nuevo estado
    selectElement.setAttribute('data-previous-status', newStatus);

    // Volvemos a generar el resumen
    mostrarResumen();
}
function actualizarTotales(totals, status, horasExtrasDiurnas, horasExtrasNocturnas, restar = false) {
    // Convertimos las horas extras en segundos
    const diurnasPartes = horasExtrasDiurnas.split(':').map(Number);
    const nocturnasPartes = horasExtrasNocturnas.split(':').map(Number);

    const segundosDiurnas = diurnasPartes[0] * 3600 + diurnasPartes[1] * 60 + diurnasPartes[2];
    const segundosNocturnas = nocturnasPartes[0] * 3600 + nocturnasPartes[1] * 60 + nocturnasPartes[2];

    // Aplicamos un factor de suma o resta, dependiendo del parámetro 'restar'
    const factor = restar ? -1 : 1;

    // Según el estado, actualizamos los totales
    if (status === "AUTORIZADO") {
        totals.aprobadas["25%"] += segundosDiurnas * factor;
        totals.aprobadas["50%"] += segundosNocturnas * factor;
    } else if (status === "RECHAZADO") {
        totals.rechazadas["25%"] += segundosDiurnas * factor;
        totals.rechazadas["50%"] += segundosNocturnas * factor;
    } else if (status === "PENDIENTE") {
        totals.pendientes["25%"] += segundosDiurnas * factor;
        totals.pendientes["50%"] += segundosNocturnas * factor;
    }

    console.log("Totales actualizados:", totals);
}
function reinicializarTotales() {
    totals = {
        aprobadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
        rechazadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
        pendientes: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 }
    };
}
function reinicializarTotales() {
    totals = {
        aprobadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
        rechazadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
        pendientes: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 }
    };
}
function resetTotals() {
    totals = {
        aprobadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
        rechazadas: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 },
        pendientes: { "0%": 0, "25%": 0, "50%": 0, "100%": 0 }
    };
}
function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Obtener el ID ingresado por el usuario
    const reportID = document.getElementById('idInput').value || 'Desconocido';

    // Añadir título al documento
    const title = `Horas Extras - ID: ${reportID}`;
    doc.setFontSize(18);
    doc.text(title, 15, 10); // Posicionamos el título en el PDF

    // Obtener el contenido de la tabla
    const table = document.querySelector('#output table');
    const rows = table.querySelectorAll('tr');

    const data = [];

    rows.forEach((row, rowIndex) => {
        const rowData = [];
        const cells = row.querySelectorAll('td, th');

        cells.forEach((cell, cellIndex) => {
            if (cellIndex === 5 && rowIndex > 0) { // Columna "Estado"
                const selectElement = cell.querySelector('select');
                rowData.push(selectElement ? selectElement.value : cell.textContent);
            } else {
                rowData.push(cell.textContent);
            }
        });

        data.push(rowData);
    });

    // Añadir la tabla al PDF usando autoTable
    doc.autoTable({
        head: [data[0]],  // La primera fila es el encabezado
        body: data.slice(1),  // Las siguientes filas son los datos
        theme: 'grid',
        headStyles: { fillColor: [0, 123, 255] }, // Color del encabezado de la tabla
        startY: 20,  // Empezar después del título
        margin: { top: 10 }  // Márgenes en la tabla
    });

    // Guardar el archivo con un nombre dinámico basado en el ID
    const fileName = `reporte_horas_extras_ID_${reportID}.pdf`;
    doc.save(fileName);
}
function downloadExcel() {
    // Crear una nueva hoja de cálculo (workbook) y hoja (worksheet)
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    // Añadir encabezado de la tabla
    const table = document.querySelector('#output table');
    const headers = Array.from(table.querySelectorAll('thead tr th')).map(th => th.textContent);
    ws_data.push(headers);

    // Obtener el contenido de la tabla sin duplicar el encabezado
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');
        
        // Agregar las celdas de la fila al array
        cells.forEach((cell, cellIndex) => {
            // Verificar si es una celda de tiempo (diurno o nocturno)
            if (cellIndex === 3 || cellIndex === 4) {
                const timeText = cell.textContent.trim();
                
                // Si el texto de la hora tiene formato hh:mm:ss, lo mantenemos como está
                if (timeText.match(/^\d{2}:\d{2}:\d{2}$/)) {
                    rowData.push(timeText); // Guardar directamente como texto "hh:mm:ss"
                } else {
                    rowData.push("00:00:00"); // Si no es un formato de hora válido, dejar como 00:00:00
                }
            } else {
                rowData.push(cell.textContent); // Para todas las demás celdas
            }
        });

        ws_data.push(rowData);
    });

    // Añadir los totales al final de la hoja
    let totalDiurnasFormatted = formatTime(totalDiurnasSeconds);
    let totalNocturnasFormatted = formatTime(totalNocturnasSeconds);
    let totalCombinedFormatted = formatTime(totalDiurnasSeconds + totalNocturnasSeconds);

    // Mover los totales una columna atrás para alinearlos correctamente
    ws_data.push(['', '', 'Total:', totalDiurnasFormatted, totalNocturnasFormatted]);
    ws_data.push(['', '', 'Total Combinado:', totalCombinedFormatted]);

    // Crear la hoja de cálculo a partir de los datos
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Añadir la hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, "Horas Extras");

    // Descargar el archivo Excel
    const reportID = document.getElementById('idInput').value || 'Desconocido';
    const fileName = `reporte_horas_extras_ID_${reportID}.xlsx`;
    XLSX.writeFile(wb, fileName);
}





