document.addEventListener('DOMContentLoaded', handleFile);

let data = [];
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

    console.log("Datos cargados:", data);
}
function filterData() {
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
    const day = fecha.getDay();
    const formattedDate = `${("0" + fecha.getDate()).slice(-2)}-${("0" + (fecha.getMonth() + 1)).slice(-2)}`;
    return day === 0 || day === 6 || feriados.includes(formattedDate);
}
function calcularHorasExtras(startTime, endTime) {
    const startOfWorkDay = new Date(startTime);
    startOfWorkDay.setHours(8, 33, 0, 0);

    const endOfWorkDay = new Date(startTime);
    endOfWorkDay.setHours(17, 33, 0, 0);

    const startOfDiurnalOvertime = new Date(startTime);
    startOfDiurnalOvertime.setHours(17, 33, 0, 0);

    const endOfDiurnalOvertime = new Date(startTime);
    endOfDiurnalOvertime.setHours(21, 0, 0, 0);

    const startOfNocturnalOvertime = new Date(startTime);
    startOfNocturnalOvertime.setHours(21, 0, 0, 0);

    let diurnalOvertimeSeconds = 0;
    let nocturnalOvertimeSeconds = 0;

    if (esFeriado(startTime)) {
        nocturnalOvertimeSeconds = (endTime - startTime) / 1000;
    } else {
        if (startTime < startOfWorkDay) {
            startTime = startOfWorkDay;
        }

        if (endTime > endOfWorkDay) {
            if (endTime <= endOfDiurnalOvertime) {
                diurnalOvertimeSeconds = (endTime - endOfWorkDay) / 1000;
            } else {
                diurnalOvertimeSeconds = (endOfDiurnalOvertime - endOfWorkDay) / 1000;
                nocturnalOvertimeSeconds = (endTime - startOfNocturnalOvertime) / 1000;
            }
        }
    }

    return {
        diurnalSeconds: Math.round(diurnalOvertimeSeconds),
        nocturnalSeconds: Math.round(nocturnalOvertimeSeconds)
    };
}
function actualizarTotales(totals, status, horasExtras, restar = false) {
    if (!status || horasExtras === "No hay horas extras") {
        return; // Si no hay estado o no hay horas, no hacemos nada
    }

    // Usamos un regex para extraer horas, minutos y segundos
    const timeRegex = /(\d+ horas?)?\s*(\d+ minutos?)?\s*(\d+ segundos?)?/;
    const match = horasExtras.match(timeRegex);

    if (!match) {
        console.log("Formato de horas incorrecto:", horasExtras);
        return;
    }

    let horas = parseInt(match[1]) || 0;
    let minutos = parseInt(match[2]) || 0;
    let segundos = parseInt(match[3]) || 0;

    // Convertimos todo a minutos
    const totalMinutos = horas * 60 + minutos + Math.floor(segundos / 60);

    // Si estamos restando, usamos un factor negativo
    const factor = restar ? -1 : 1;

    // Determinar el porcentaje basado en el tipo de horas
    let porcentaje = "25%"; // Por defecto, se asigna al 25%
    if (horasExtras.includes("50%")) {
        porcentaje = "50%";
    } else if (horasExtras.includes("100%")) {
        porcentaje = "100%";
    } else if (horasExtras.includes("0%")) {
        porcentaje = "0%";
    }

    // Actualizar los totales según el estado
    if (status === "AUTORIZADO") {
        totals.aprobadas[porcentaje] += totalMinutos * factor;
    } else if (status === "RECHAZADO") {
        totals.rechazadas[porcentaje] += totalMinutos * factor;
    } else if (status === "PENDIENTE") {
        totals.pendientes[porcentaje] += totalMinutos * factor;
    }
}
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    let result = "";

    if (hours > 0) {
        result += `${hours} hora${hours > 1 ? "s" : ""}`;
    }
    if (mins > 0) {
        if (result) result += " y ";
        result += `${mins} minuto${mins > 1 ? "s" : ""}`;
    }
    if (secs > 0) {
        if (result) result += " y ";
        result += `${secs} segundo${secs > 1 ? "s" : ""}`;
    }

    return result || "No hay horas extras";
}
function mostrarResumen() {
    const resumenContainer = document.getElementById('resumen-container');

    if (!resumenContainer) {
        const container = document.createElement('div');
        container.id = 'resumen-container';
        document.getElementById('output').appendChild(container);
    } else {
        resumenContainer.innerHTML = '';
    }

    // Crear el contenido HTML para las cuatro tablas de resumen
    let resumenContent = `
        <div class="row">
            <div class="col-md-6">
                <h3>Total H.E. Aprobadas</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Aprobadas al 0%:</td><td>${formatTime(totals.aprobadas["0%"])}</td></tr>
                        <tr><td>Total H. E. Aprobadas al 25%:</td><td>${formatTime(totals.aprobadas["25%"])}</td></tr>
                        <tr><td>Total H. E. Aprobadas al 50%:</td><td>${formatTime(totals.aprobadas["50%"])}</td></tr>
                        <tr><td>Total H. E. Aprobadas al 100%:</td><td>${formatTime(totals.aprobadas["100%"])}</td></tr>
                        <tr><td><strong>Total Horas Extras Aprobadas:</strong></td><td><strong>${formatTime(
                          totals.aprobadas["0%"] +
                          totals.aprobadas["25%"] +
                          totals.aprobadas["50%"] +
                          totals.aprobadas["100%"]
                        )}</strong></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-6">
                <h3>Total H.E. Rechazadas</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Rechazadas al 0%:</td><td>${formatTime(totals.rechazadas["0%"])}</td></tr>
                        <tr><td>Total H. E. Rechazadas al 25%:</td><td>${formatTime(totals.rechazadas["25%"])}</td></tr>
                        <tr><td>Total H. E. Rechazadas al 50%:</td><td>${formatTime(totals.rechazadas["50%"])}</td></tr>
                        <tr><td>Total H. E. Rechazadas al 100%:</td><td>${formatTime(totals.rechazadas["100%"])}</td></tr>
                        <tr><td><strong>Total Horas Extras Rechazadas:</strong></td><td><strong>${formatTime(
                          totals.rechazadas["0%"] +
                          totals.rechazadas["25%"] +
                          totals.rechazadas["50%"] +
                          totals.rechazadas["100%"]
                        )}</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="row">
            <div class="col-md-6">
                <h3>Total H.E. Pendientes</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Pendientes al 0%:</td><td>${formatTime(totals.pendientes["0%"])}</td></tr>
                        <tr><td>Total H. E. Pendientes al 25%:</td><td>${formatTime(totals.pendientes["25%"])}</td></tr>
                        <tr><td>Total H. E. Pendientes al 50%:</td><td>${formatTime(totals.pendientes["50%"])}</td></tr>
                        <tr><td>Total H. E. Pendientes al 100%:</td><td>${formatTime(totals.pendientes["100%"])}</td></tr>
                        <tr><td><strong>Total Horas Extras Pendientes:</strong></td><td><strong>${formatTime(
                          totals.pendientes["0%"] +
                          totals.pendientes["25%"] +
                          totals.pendientes["50%"] +
                          totals.pendientes["100%"]
                        )}</strong></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-6">
                <h3>Total General Horas Extras</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. al 0%:</td><td>${formatTime(
                          totals.aprobadas["0%"] +
                          totals.rechazadas["0%"] +
                          totals.pendientes["0%"]
                        )}</td></tr>
                        <tr><td>Total H. E. al 25%:</td><td>${formatTime(
                          totals.aprobadas["25%"] +
                          totals.rechazadas["25%"] +
                          totals.pendientes["25%"]
                        )}</td></tr>
                        <tr><td>Total H. E. al 50%:</td><td>${formatTime(
                          totals.aprobadas["50%"] +
                          totals.rechazadas["50%"] +
                          totals.pendientes["50%"]
                        )}</td></tr>
                        <tr><td>Total H. E. al 100%:</td><td>${formatTime(
                          totals.aprobadas["100%"] +
                          totals.rechazadas["100%"] +
                          totals.pendientes["100%"]
                        )}</td></tr>
                        <tr><td><strong>Total Horas Extras:</strong></td><td><strong>${formatTime(
                          totals.aprobadas["0%"] +
                          totals.rechazadas["0%"] +
                          totals.pendientes["0%"] +
                          totals.aprobadas["25%"] +
                          totals.rechazadas["25%"] +
                          totals.pendientes["25%"] +
                          totals.aprobadas["50%"] +
                          totals.rechazadas["50%"] +
                          totals.pendientes["50%"] +
                          totals.aprobadas["100%"] +
                          totals.rechazadas["100%"] +
                          totals.pendientes["100%"]
                        )}</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('resumen-container').innerHTML = resumenContent;
}
function generateReport(filteredData) {
    let dailyData = {};

    filteredData.forEach(item => {
        const dateKey = item.timestamp.toLocaleDateString();
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                id: item.id,
                date: dateKey,
                startTime: item.timestamp,
                endTime: item.timestamp
            };
        } else {
            if (item.timestamp < dailyData[dateKey].startTime) {
                dailyData[dateKey].startTime = item.timestamp;
            }
            if (item.timestamp > dailyData[dateKey].endTime) {
                dailyData[dateKey].endTime = item.timestamp;
            }
        }
    });

    let tableContent = "";

    for (let date in dailyData) {
        const record = dailyData[date];

        let startTimeFormatted = record.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let endTimeFormatted = record.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let { diurnalSeconds, nocturnalSeconds } = calcularHorasExtras(record.startTime, record.endTime);

        let diurnalFormatted = formatTime(diurnalSeconds);
        let nocturnalFormatted = formatTime(nocturnalSeconds);

        tableContent += `
            <tr>
                <td>${record.id}</td>
                <td>${record.date}</td>
                <td>${startTimeFormatted}</td>
                <td>${endTimeFormatted}</td>
                <td>${diurnalFormatted}</td>
                <td>${nocturnalFormatted}</td>
                <td>
                    <select class="status-select" onchange="updateTotal(this, '${record.date}')">
                        <option value="AUTORIZADO" selected>AUTORIZADO</option>
                        <option value="RECHAZADO">RECHAZADO</option>
                        <option value="PENDIENTE">PENDIENTE</option>
                    </select>
                </td>
            </tr>
        `;

        // Actualizamos los totales de horas extras dependiendo del estado
        actualizarTotales(totals, 'AUTORIZADO', diurnalFormatted);
        actualizarTotales(totals, 'AUTORIZADO', nocturnalFormatted);
    }

    document.getElementById('output').innerHTML = `
        <h2>Reporte de Horas Extras</h2>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Hora Inicio</th>
                    <th>Hora Fin</th>
                    <th>Horas Extras Diurnas (25%)</th>
                    <th>Horas Extras Nocturnas/Feriado (50%)</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                ${tableContent}
            </tbody>
        </table>
    `;

    // Mostramos el resumen con las horas totales al final
    mostrarResumen();

    // Aseguramos que el botón PDF esté visible después de generar el reporte
    document.getElementById('downloadPdfBtn').style.display = 'block';
}
function updateTotal(selectElement) {
    const row = selectElement.closest('tr');
    const diurnalHours = row.children[4].textContent;
    const nocturnalHours = row.children[5].textContent;
    const newStatus = selectElement.value; // Nuevo estado seleccionado

    // Obtener el estado anterior almacenado
    const previousStatus = selectElement.getAttribute('data-previous-status') || ""; 
    selectElement.setAttribute('data-previous-status', newStatus); // Guardar el nuevo estado como el estado anterior para la próxima vez

    // Restar las horas del estado anterior
    if (diurnalHours !== "No hay horas extras") {
        actualizarTotales(totals, previousStatus, diurnalHours, true); // true indica que restamos horas
    }

    if (nocturnalHours !== "No hay horas extras") {
        actualizarTotales(totals, previousStatus, nocturnalHours, true);
    }

    // Sumar las horas del nuevo estado
    if (diurnalHours !== "No hay horas extras") {
        actualizarTotales(totals, newStatus, diurnalHours, false); // false indica que sumamos horas
    }

    if (nocturnalHours !== "No hay horas extras") {
        actualizarTotales(totals, newStatus, nocturnalHours, false);
    }

    // Regenerar el resumen
    mostrarResumen();
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

    // Obtener el contenido de la tabla
    const table = document.querySelector('#output table');
    const rows = table.querySelectorAll('tr');

    const data = [];

    rows.forEach((row, rowIndex) => {
        const rowData = [];
        const cells = row.querySelectorAll('td, th');

        cells.forEach((cell, cellIndex) => {
            if (cellIndex === 6 && rowIndex > 0) { // Columna "Estado"
                const selectElement = cell.querySelector('select');
                rowData.push(selectElement ? selectElement.value : cell.textContent);
            } else {
                rowData.push(cell.textContent);
            }
        });

        data.push(rowData);
    });

    doc.autoTable({
        head: [data[0]],  // La primera fila es el encabezado
        body: data.slice(1),  // Las siguientes filas son los datos
        theme: 'grid',
        headStyles: { fillColor: [0, 123, 255] },
        margin: { top: 20 }
    });

    doc.save('reporte_horas_extras.pdf');
}

