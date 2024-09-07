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

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    // Aseguramos que horas, minutos y segundos siempre tengan dos dígitos
    const formattedTime = [
        String(hours).padStart(2, '0'),
        String(mins).padStart(2, '0'),
        String(secs).padStart(2, '0')
    ].join(':');

    return formattedTime;
}

function mostrarResumen() {
    const totalAprobadas = formatTime(totals.aprobadas["0%"] + totals.aprobadas["25%"] + totals.aprobadas["50%"] + totals.aprobadas["100%"]);
    const totalRechazadas = formatTime(totals.rechazadas["0%"] + totals.rechazadas["25%"] + totals.rechazadas["50%"] + totals.rechazadas["100%"]);
    const totalPendientes = formatTime(totals.pendientes["0%"] + totals.pendientes["25%"] + totals.pendientes["50%"] + totals.pendientes["100%"]);
    const totalGeneral = formatTime(
        totals.aprobadas["0%"] + totals.rechazadas["0%"] + totals.pendientes["0%"] +
        totals.aprobadas["25%"] + totals.rechazadas["25%"] + totals.pendientes["25%"] +
        totals.aprobadas["50%"] + totals.rechazadas["50%"] + totals.pendientes["50%"] +
        totals.aprobadas["100%"] + totals.rechazadas["100%"] + totals.pendientes["100%"]
    );

    document.getElementById('resumen-container').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h3>Total H.E. Aprobadas</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Aprobadas al 0%:</td><td>${formatTime(totals.aprobadas["0%"])}</td></tr>
                        <tr><td>Total H. E. Aprobadas al 25%:</td><td>${formatTime(totals.aprobadas["25%"])}</td></tr>
                        <tr><td>Total H. E. Aprobadas al 50%:</td><td>${formatTime(totals.aprobadas["50%"])}</td></tr>
                        <tr><td>Total H. E. Aprobadas al 100%:</td><td>${formatTime(totals.aprobadas["100%"])}</td></tr>
                        <tr><td><strong>Total Horas Extras Aprobadas:</strong></td><td><strong>${totalAprobadas}</strong></td></tr>
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
                        <tr><td><strong>Total Horas Extras Rechazadas:</strong></td><td><strong>${totalRechazadas}</strong></td></tr>
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
                        <tr><td><strong>Total Horas Extras Pendientes:</strong></td><td><strong>${totalPendientes}</strong></td></tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-6">
                <h3>Total General Horas Extras</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. al 0%:</td><td>${formatTime(
                          totals.aprobadas["0%"] + totals.rechazadas["0%"] + totals.pendientes["0%"]
                        )}</td></tr>
                        <tr><td>Total H. E. al 25%:</td><td>${formatTime(
                          totals.aprobadas["25%"] + totals.rechazadas["25%"] + totals.pendientes["25%"]
                        )}</td></tr>
                        <tr><td>Total H. E. al 50%:</td><td>${formatTime(
                          totals.aprobadas["50%"] + totals.rechazadas["50%"] + totals.pendientes["50%"]
                        )}</td></tr>
                        <tr><td>Total H. E. al 100%:</td><td>${formatTime(
                          totals.aprobadas["100%"] + totals.rechazadas["100%"] + totals.pendientes["100%"]
                        )}</td></tr>
                        <tr><td><strong>Total Horas Extras:</strong></td><td><strong>${totalGeneral}</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
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

        let startTimeFormatted = record.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let endTimeFormatted = record.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let { diurnalSeconds, nocturnalSeconds } = calcularHorasExtras(record.startTime, record.endTime);

        let diurnalFormatted = formatTime(diurnalSeconds);
        let nocturnalFormatted = formatTime(nocturnalSeconds);

        // Verificación de alerta por inconsistencias
        let alertClass = '';
        if (record.startTime.getTime() === record.endTime.getTime() || (diurnalSeconds === 0 && nocturnalSeconds === 0)) {
            alertClass = 'alerta-horas'; // Clase para resaltar problemas
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
            </tr>
        `;

        // Actualizamos los totales de horas extras dependiendo del estado
        actualizarTotales(totals, 'AUTORIZADO', diurnalFormatted, nocturnalFormatted);
    }

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
                </tr>
            </thead>
            <tbody>
                ${tableContent}
            </tbody>
        </table>
    `;

    // Mostrar el botón de descarga de PDF
    document.getElementById('downloadPdfBtn').style.display = 'block';

    mostrarResumen();
}

function updateTotal(selectElement, date, horasExtrasDiurnas, horasExtrasNocturnas) {
    const row = selectElement.closest('tr');
    const newStatus = selectElement.value; // Nuevo estado seleccionado

    // Obtener el estado anterior almacenado
    const previousStatus = selectElement.getAttribute('data-previous-status') || ""; 
    selectElement.setAttribute('data-previous-status', newStatus); // Guardar el nuevo estado como el estado anterior para la próxima vez

    // Restar las horas del estado anterior si existe un estado anterior
    if (previousStatus && previousStatus !== newStatus) {
        actualizarTotales(totals, previousStatus, horasExtrasDiurnas, horasExtrasNocturnas, true); // true indica que restamos horas
    }

    // Sumar las horas del nuevo estado
    if (newStatus) {
        actualizarTotales(totals, newStatus, horasExtrasDiurnas, horasExtrasNocturnas, false); // false indica que sumamos horas
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



