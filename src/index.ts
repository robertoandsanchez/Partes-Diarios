import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
// import puppeteer from 'puppeteer'; <-- LO QUITAMOS PARA QUE NO DE ERROR
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// --- MONITOR DE LOGS ---
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

const formatDate = (date: Date) => {
  try { return date.toISOString().split('T')[0].split('-').reverse().join('/'); } 
  catch (e) { return '-'; }
};

// --- RUTAS DE CATÁLOGOS ---
function crearRutasCatalogo(nombreModelo: string, modeloPrisma: any) {
  const ruta = `/api/${nombreModelo}`;
  app.get(ruta, async (req, res) => {
    try {
      const { sectorId } = req.query;
      const where: any = {};
      if (sectorId && nombreModelo === 'operarios') where.sectorId = Number(sectorId);
      const items = await modeloPrisma.findMany({ where, orderBy: { nombre: 'asc' } });
      res.json(items);
    } catch (error) { res.status(500).json({ error: 'Error server' }); }
  });
  app.post(ruta, async (req, res) => {
    try {
      let data = req.body;
      if (data.sectorId) data.sectorId = Number(data.sectorId);
      const nuevo = await modeloPrisma.create({ data });
      res.json(nuevo);
    } catch (error) { res.status(400).json({ error: 'Error creando' }); }
  });
  app.delete(`${ruta}/:id`, async (req, res) => {
    try {
      await modeloPrisma.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (error) { res.status(400).json({ error: 'Error eliminando' }); }
  });
}

crearRutasCatalogo('sectores', prisma.sector);
crearRutasCatalogo('contratistas', prisma.contratista);
crearRutasCatalogo('proyectos', prisma.proyecto);
crearRutasCatalogo('supervisores', prisma.supervisor);
crearRutasCatalogo('operarios', prisma.operario);
crearRutasCatalogo('actividades', prisma.actividad);

// --- GESTIÓN DE FORMULARIOS ---

app.post('/api/formularios', async (req, res) => {
  try {
    console.log("📝 CREAR Formulario:", req.body);
    const { detalles, ...cabecera } = req.body;
    const nuevo = await prisma.formularioDiario.create({
      data: {
        fecha: new Date(cabecera.fecha),
        turno: cabecera.turno,
        ordenCompra: cabecera.ordenCompra,
        observaciones: cabecera.observaciones || '',
        contratistaId: Number(cabecera.contratistaId),
        proyectoId: Number(cabecera.proyectoId),
        sectorId: Number(cabecera.sectorId),
        supervisorId: Number(cabecera.supervisorId),
        detalles: {
          create: detalles.map((d: any) => ({
            operarioId: Number(d.operarioId),
            actividadId: Number(d.actividadId),
            horas: Number(d.horas)
          }))
        }
      }
    });
    res.json(nuevo);
  } catch (error) { 
    console.error("❌ Error Crear:", error); 
    res.status(400).json({ error: 'Error al guardar' }); 
  }
});

app.put('/api/formularios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    console.log(`🔄 EDITAR Formulario ${id}`);
    const { detalles, ...cabecera } = req.body;

    const actualizado = await prisma.$transaction([
      prisma.detalleActividad.deleteMany({ where: { formularioId: id } }),
      prisma.formularioDiario.update({
        where: { id },
        data: {
          fecha: new Date(cabecera.fecha),
          turno: cabecera.turno,
          ordenCompra: cabecera.ordenCompra,
          observaciones: cabecera.observaciones || '',
          contratistaId: Number(cabecera.contratistaId),
          proyectoId: Number(cabecera.proyectoId),
          sectorId: Number(cabecera.sectorId),
          supervisorId: Number(cabecera.supervisorId),
          detalles: {
            create: detalles.map((d: any) => ({
              operarioId: Number(d.operarioId),
              actividadId: Number(d.actividadId),
              horas: Number(d.horas)
            }))
          }
        }
      })
    ]);
    res.json(actualizado);
  } catch (error: any) { 
    console.error("❌ Error Editar:", error);
    res.status(400).json({ error: 'Error al actualizar' }); 
  }
});

app.get('/api/formularios/buscar', async (req, res) => {
  try {
    const { q } = req.query; 
    const busqueda = String(q || '');
    const esNumero = !isNaN(Number(busqueda)) && busqueda !== '';

    const resultados = await prisma.formularioDiario.findMany({
      take: 50, orderBy: { fecha: 'desc' }, 
      where: {
        OR: [
          esNumero ? { id: Number(busqueda) } : {}, 
          { supervisor: { nombre: { contains: busqueda } } }, 
          { observaciones: { contains: busqueda } }
        ]
      },
      include: { sector: true, supervisor: true, detalles: true }
    });
    res.json(resultados);
  } catch (error) { res.status(500).json([]); }
});

app.get('/api/formularios/:id', async (req, res) => {
  try {
    const formulario = await prisma.formularioDiario.findUnique({
      where: { id: Number(req.params.id) },
      include: { detalles: true }
    });
    res.json(formulario);
  } catch (error) { res.status(404).send("No encontrado"); }
});

// --- REPORTES (PDF Y EXCEL) ---

app.get('/api/reportes/excel', async (req, res) => {
  try {
    const { desde, hasta } = req.query; 
    if (!desde || !hasta) return res.status(400).send("Falta rango");

    const formularios = await prisma.formularioDiario.findMany({
      where: { fecha: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } },
      include: { sector: true, supervisor: true, detalles: true },
      orderBy: { fecha: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte');
    
    // --- AQUÍ AGREGUÉ LA COLUMNA SUPERVISOR ---
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'FECHA', key: 'fecha', width: 12 },
      { header: 'SECTOR', key: 'sector', width: 20 },
      { header: 'TURNO', key: 'turno', width: 10 },
      { header: 'OPERARIOS', key: 'operarios', width: 10 },
      { header: 'HORAS', key: 'horas', width: 10 },
      { header: 'SUPERVISOR', key: 'supervisor', width: 20 }, // <--- NUEVA COLUMNA
    ];
    sheet.getRow(1).font = { bold: true };

    formularios.forEach(f => {
      const totalHoras = f.detalles.reduce((sum: number, d: any) => sum + Number(d.horas), 0);
      sheet.addRow({
        id: f.id,
        fecha: formatDate(f.fecha),
        sector: f.sector.nombre.toUpperCase(),
        turno: f.turno,
        operarios: f.detalles.length,
        horas: totalHoras,
        supervisor: f.supervisor.nombre.toUpperCase() // <--- DATO DEL SUPERVISOR
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).send("Error Excel"); }
});

// --- SOLUCIÓN PDF: VISTA DE IMPRESIÓN ---
app.get('/api/reportes/pdf/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const form = await prisma.formularioDiario.findUnique({
      where: { id },
      include: { 
        sector: true, contratista: true, proyecto: true, supervisor: true,
        detalles: { include: { operario: true, actividad: true } }
      }
    });

    if (!form) return res.status(404).send("No encontrado");

    // Calculamos total de horas
    const totalHoras = form.detalles.reduce((sum: any, d: any) => sum + Number(d.horas), 0);

    // Generamos una página HTML bonita que se imprime sola
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Parte Diario #${form.id}</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; color: #1e3a8a; margin: 0; text-transform: uppercase; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
          .meta-table td { padding: 8px; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #555; width: 140px; background: #f8fafc; }
          .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #ddd; }
          .data-table th { background: #1e3a8a; color: white; padding: 10px; text-align: left; font-size: 12px; }
          .data-table td { border-bottom: 1px solid #ddd; padding: 10px; font-size: 13px; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; }
          .sign { width: 40%; text-align: center; border-top: 1px solid #333; padding-top: 5px; font-size: 12px; }
          
          /* Ocultar botones al imprimir */
          @media print { .no-print { display: none; } }
          .btn-print { background: #1e3a8a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-bottom: 20px; cursor: pointer;}
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: right;">
            <button onclick="window.print()" class="btn-print">🖨️ IMPRIMIR / GUARDAR COMO PDF</button>
        </div>

        <div class="header">
          <h1 class="title">Parte Diario de Servicio</h1>
          <div>ID REGISTRO #${form.id}</div>
        </div>

        <table class="meta-table">
          <tr><td class="label">FECHA:</td><td><strong>${formatDate(form.fecha)}</strong></td><td class="label">TURNO:</td><td>${form.turno}</td></tr>
          <tr><td class="label">SECTOR:</td><td>${form.sector.nombre}</td><td class="label">SUPERVISOR:</td><td>${form.supervisor.nombre}</td></tr>
          <tr><td class="label">PROYECTO:</td><td>${form.proyecto.nombre}</td><td class="label">CONTRATISTA:</td><td>${form.contratista.nombre}</td></tr>
          <tr><td class="label">ORDEN COMPRA:</td><td colspan="3">${form.ordenCompra || '-'}</td></tr>
        </table>

        <h3 style="color: #1e3a8a; margin-top: 30px;">Detalle de Actividades</h3>
        <table class="data-table">
          <thead><tr><th>Operario</th><th>Actividad</th><th style="text-align:right">Horas</th></tr></thead>
          <tbody>
            ${form.detalles.map((d: any) => `
              <tr>
                <td><strong>${d.operario.nombre}</strong></td>
                <td>${d.actividad.nombre}</td>
                <td style="text-align:right">${d.horas} hs</td>
              </tr>`).join('')}
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="2" style="text-align: right;">TOTAL HORAS:</td>
              <td style="text-align: right;">${totalHoras} hs</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9;">
            <strong>OBSERVACIONES:</strong><br>
            ${form.observaciones || 'Sin observaciones.'}
        </div>

        <div class="footer">
            <div class="sign">Firma Supervisor<br><strong>${form.supervisor.nombre}</strong></div>
            <div class="sign">Conformidad Cliente</div>
        </div>

        <script>
            // Intentar imprimir automáticamente al abrir
            setTimeout(() => window.print(), 500);
        </script>
      </body>
      </html>
    `;
    
    // Enviamos HTML en lugar de binario PDF
    res.send(htmlContent);

  } catch (error) { 
    console.error("❌ Error Vista:", error);
    res.status(500).send("Error generando vista"); 
  }
});

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('API 404');
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SERVIDOR LISTO EN PUERTO ${PORT}`);
});