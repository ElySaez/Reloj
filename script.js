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
    const day = fecha.getDay(); // Obtener el día de la semana (0 es domingo, 6 es sábado)
    const formattedDate = `${("0" + fecha.getDate()).slice(-2)}-${("0" + (fecha.getMonth() + 1)).slice(-2)}`;
    
    // Agregar un console.log para depuración
    console.log("Fecha:", fecha, "Día:", day, "¿Es feriado?", feriados.includes(formattedDate), "¿Es fin de semana?", (day === 0 || day === 6));

    // Verificar si es fin de semana o está en la lista de feriados
    return day === 0 || day === 6 || feriados.includes(formattedDate);
}


function calcularHorasExtras(startTime, endTime) {
    // Definir horarios del día laboral (de 08:33 a 17:33)
    const startOfWorkDay = new Date(startTime);
    startOfWorkDay.setHours(8, 33, 0, 0); // Inicio laboral 08:33

    const endOfWorkDay = new Date(startTime);
    endOfWorkDay.setHours(17, 33, 0, 0); // Fin laboral 17:33

    // Definir los intervalos de horas extras
    const startOfDiurnalOvertime = new Date(startTime);
    startOfDiurnalOvertime.setHours(17, 34, 0, 0); // Inicio horas extras diurnas

    const endOfDiurnalOvertime = new Date(startTime);
    endOfDiurnalOvertime.setHours(20, 59, 59, 999); // Fin horas extras diurnas

    const startOfNocturnalOvertime = new Date(startTime);
    startOfNocturnalOvertime.setHours(21, 0, 0, 0); // Inicio horas extras nocturnas

    // Variables para acumular el total de segundos
    let diurnalOvertimeSeconds = 0;
    let nocturnalOvertimeSeconds = 0;
    let workSeconds = 0;

    // Si es feriado o fin de semana, todas las horas se consideran nocturnas
    if (esFeriado(startTime)) {
        nocturnalOvertimeSeconds = (endTime - startTime) / 1000; // Todas las horas son nocturnas en feriados/fines de semana
    } else {
        // Si la entrada es antes del inicio laboral, ajustar al horario laboral
        if (startTime < startOfWorkDay) {
            startTime = startOfWorkDay;
        }

        // Si la salida es antes del fin del horario laboral
        if (endTime <= endOfWorkDay) {
            workSeconds = (endTime - startTime) / 1000; // Tiempo dentro del horario laboral
        } else {
            // Contabilizar las horas laborales completas
            workSeconds = (endOfWorkDay - startTime) / 1000;

            // Si la salida está en el rango de horas extras diurnas (de 17:34 a 20:59)
            if (endTime > endOfWorkDay && endTime <= endOfDiurnalOvertime) {
                diurnalOvertimeSeconds = (endTime - endOfWorkDay) / 1000;
            } else if (endTime > endOfDiurnalOvertime) {
                // Si hay horas extras diurnas y nocturnas
                diurnalOvertimeSeconds = (endOfDiurnalOvertime - endOfWorkDay) / 1000;
                nocturnalOvertimeSeconds = (endTime - startOfNocturnalOvertime) / 1000;
            }
        }
    }

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
    const totalAprobadasDiurnas = totals.aprobadas["25%"];
    const totalAprobadasNocturnas = totals.aprobadas["50%"];
    const totalRechazadasDiurnas = totals.rechazadas["25%"];
    const totalRechazadasNocturnas = totals.rechazadas["50%"];
    const totalPendientesDiurnas = totals.pendientes["25%"];
    const totalPendientesNocturnas = totals.pendientes["50%"];

    // Sumar todas las horas diurnas y nocturnas
    const totalDiurnas = totalAprobadasDiurnas + totalRechazadasDiurnas + totalPendientesDiurnas;
    const totalNocturnas = totalAprobadasNocturnas + totalRechazadasNocturnas + totalPendientesNocturnas;

    document.getElementById('resumen-container').innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <h3>Total H.E. Aprobadas</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Diurnas al 25%:</td><td>${formatTime(totalAprobadasDiurnas)}</td></tr>
                        <tr><td>Total H. E. Nocturnas al 50%:</td><td>${formatTime(totalAprobadasNocturnas)}</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-4">
                <h3>Total H.E. Rechazadas</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Diurnas al 25%:</td><td>${formatTime(totalRechazadasDiurnas)}</td></tr>
                        <tr><td>Total H. E. Nocturnas al 50%:</td><td>${formatTime(totalRechazadasNocturnas)}</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-4">
                <h3>Total H.E. Pendientes</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Diurnas al 25%:</td><td>${formatTime(totalPendientesDiurnas)}</td></tr>
                        <tr><td>Total H. E. Nocturnas al 50%:</td><td>${formatTime(totalPendientesNocturnas)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="row">
            <div class="col-md-12">
                <h3>Total General Horas Extras</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td>Total H. E. Diurnas al 25%:</td><td>${formatTime(totalDiurnas)}</td></tr>
                        <tr><td>Total H. E. Nocturnas al 50%:</td><td>${formatTime(totalNocturnas)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="row">
            <div class="col-md-12">
                <h3>Suma Total de Horas Extras</h3>
                <table class="table table-bordered">
                    <tbody>
                        <tr><td><strong>Suma Total Diurnas + Nocturnas:</strong></td><td><strong>${formatTime(totalDiurnas + totalNocturnas)}</strong></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}



function generateReport(filteredData) {
    let dailyData = {};
    let totalDiurnasSeconds = 0;
    let totalNocturnasSeconds = 0;

    // Recorrer los registros
    filteredData.forEach(item => {
        const timestamp = new Date(item.timestamp); // Convertir a Date si es texto
        const dateKey = timestamp.toLocaleDateString();

        if (!dailyData[dateKey]) {
            // Si no hay un registro para esta fecha, creamos uno
            dailyData[dateKey] = {
                id: item.id,
                date: dateKey,
                startTime: timestamp, // Asegurarnos que esto sea un objeto Date
                endTime: timestamp,   // Asegurarnos que esto sea un objeto Date
                autoAssigned: false // Bandera para detectar asignaciones automáticas
            };
        } else {
            // Actualizamos el registro existente si es del mismo día
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

        let startTimeFormatted;
        let endTimeFormatted;
        let alertMessage = ""; // Variable para almacenar la alerta

        // Verificamos si hay una sola marca en el día (inicio y fin iguales)
        if (record.startTime.getTime() === record.endTime.getTime()) {
            // Asignar horas estándar
            let startTimeStandard = new Date(record.startTime);
            startTimeStandard.setHours(8, 33, 0, 0); // Entrada estándar 08:33

            let endTimeStandard = new Date(record.startTime);
            endTimeStandard.setHours(17, 33, 0, 0); // Salida estándar 17:33

            record.startTime = startTimeStandard;
            record.endTime = endTimeStandard;
            record.autoAssigned = true; // Marcar como asignación automática

            // Formatear los tiempos
            startTimeFormatted = startTimeStandard.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            endTimeFormatted = endTimeStandard.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // Asignar mensaje de alerta
            alertMessage = `<span class="alert-text" style="color:red;">Hora asignada automáticamente por falta de registro</span>`;
        } else {
            // Si hay dos marcas, formateamos normalmente
            startTimeFormatted = record.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            endTimeFormatted = record.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // Calcular horas extras en segundos
        let { diurnalSeconds, nocturnalSeconds } = calcularHorasExtras(record.startTime, record.endTime);

        let diurnalFormatted = formatTime(diurnalSeconds);
        let nocturnalFormatted = formatTime(nocturnalSeconds);

        // Acumular totales
        totalDiurnasSeconds += diurnalSeconds;
        totalNocturnasSeconds += nocturnalSeconds;

        // Verificación de alerta por inconsistencias
        let alertClass = '';
        if (record.startTime.getTime() === record.endTime.getTime() || (diurnalSeconds === 0 && nocturnalSeconds === 0)) {
            alertClass = 'alerta-horas'; // Clase para resaltar problemas
        }

        // Generar contenido de la tabla
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
                <td>${alertMessage}</td> <!-- Añadir alerta si fue asignado automáticamente -->
            </tr>
        `;

        actualizarTotales(totals, 'AUTORIZADO', diurnalFormatted, nocturnalFormatted);
    }

    // Calcular el total combinado
    let totalCombinedSeconds = totalDiurnasSeconds + totalNocturnasSeconds;
    let totalDiurnasFormatted = formatTime(totalDiurnasSeconds);
    let totalNocturnasFormatted = formatTime(totalNocturnasSeconds);
    let totalCombinedFormatted = formatTime(totalCombinedSeconds);

    // Añadir el total al final de la tabla
    tableContent += `
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

    // Mostrar el contenido generado
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
                    <th>Alerta</th> <!-- Nueva columna para la alerta -->
                </tr>
            </thead>
            <tbody>
                ${tableContent}
            </tbody>
        </table>
    `;
    mostrarResumen();
}

// Función para formatear correctamente los segundos a hh:mm:ss
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [hours, mins, secs]
        .map(unit => String(unit).padStart(2, '0'))
        .join(':');
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
function downloadExcel() {
    // Crear una nueva hoja de cálculo (workbook) y hoja (worksheet)
    const wb = XLSX.utils.book_new();
    const ws_data = [];
    
    // Añadir encabezado de la tabla solo una vez
    const table = document.querySelector('#output table');
    const headers = Array.from(table.querySelectorAll('thead tr th')).map(th => th.textContent);
    ws_data.push(headers);

    // Obtener el contenido de la tabla sin duplicar el encabezado
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');

        cells.forEach((cell, cellIndex) => {
            if (cellIndex === 5) { // Columna "Estado"
                const selectElement = cell.querySelector('select');
                rowData.push(selectElement ? selectElement.value : cell.textContent);
            } else if (cellIndex === 0 || cellIndex === 1) { // Columnas de Horas Extras
                const timeText = cell.textContent.trim();
                
                // Si el texto de la hora tiene formato hh:mm:ss, lo mantenemos como está
                if (timeText.match(/^\d{2}:\d{2}:\d{2}$/)) {
                    rowData.push(timeText); // Guardar directamente como texto "hh:mm:ss"
                } else {
                    rowData.push(timeText); // Si no es un formato de hora válido, dejar tal cual
                }
            } else {
                rowData.push(cell.textContent);
            }
        });

        ws_data.push(rowData);
    });

    // Añadir los datos a la hoja
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Configurar el formato de las celdas para que Excel las interprete como horas
    const timeCols = [0, 1]; // Asumiendo que las columnas 0 y 1 son de horas extras
    timeCols.forEach(colIndex => {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let row = range.s.r + 1; row <= range.e.r; ++row) { // Saltar encabezado
            const cellAddress = XLSX.utils.encode_cell({r: row, c: colIndex});
            const cell = ws[cellAddress];
            if (cell) {
                cell.z = 'h:mm:ss'; // Aplicar formato de horas a esas celdas
            }
        }
    });

    // Añadir la hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, "Horas Extras");

    // Descargar el archivo Excel
    const reportID = document.getElementById('idInput').value || 'Desconocido';
    const fileName = `reporte_horas_extras_ID_${reportID}.xlsx`;
    XLSX.writeFile(wb, fileName);
}





