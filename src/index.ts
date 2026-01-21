import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import path from 'path';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// --- UTILIDADES ---
const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0].split('-').reverse().join('/');
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
    } catch (error) { res.status(500).json({ error: `Error al obtener ${nombreModelo}` }); }
  });

  app.post(ruta, async (req, res) => {
    try {
      let data = req.body;
      if (data.sectorId) data.sectorId = Number(data.sectorId);
      const nuevo = await modeloPrisma.create({ data });
      res.json(nuevo);
    } catch (error) { res.status(400).json({ error: `Error al crear.` }); }
  });

  app.delete(`${ruta}/:id`, async (req, res) => {
    try {
      await modeloPrisma.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (error) { res.status(400).json({ error: 'No se pudo eliminar.' }); }
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
  } catch (error) { res.status(400).json({ error: 'Error guardando formulario' }); }
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

app.put('/api/formularios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
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
  } catch (error) { res.status(400).json({ error: 'Error al actualizar' }); }
});


// ==========================================
//           RUTAS DE REPORTES
// ==========================================

app.get('/api/reportes/excel', async (req, res) => {
  try {
    const { desde, hasta } = req.query; 
    if (!desde || !hasta) return res.status(400).send("Falta rango");

    const formularios = await prisma.formularioDiario.findMany({
      where: { 
        fecha: { gte: new Date(String(desde)), lte: new Date(String(hasta)) }
      },
      include: { sector: true, supervisor: true, detalles: true },
      orderBy: { fecha: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'FECHA', key: 'fecha', width: 12 },
      { header: 'SECTOR', key: 'sector', width: 20 },
      { header: 'TURNO', key: 'turno', width: 10 },
      { header: 'OPERARIOS', key: 'operarios', width: 10 },
      { header: 'HORAS', key: 'horas', width: 10 },
      { header: 'SUPERVISOR', key: 'supervisor', width: 20 },
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
        supervisor: f.supervisor.nombre.toUpperCase()
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).send("Error Excel"); }
});

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
    
    const totalHoras = form.detalles.reduce((sum: any, d: any) => sum + Number(d.horas), 0);

    const htmlContent = `
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
          .meta-table { width: 100%; margin-bottom: 30px; border-collapse: collapse; font-size: 13px; }
          .meta-table td { padding: 6px; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #555; width: 140px; background-color: #f8fafc; }
          .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .data-table th { background: #1e3a8a; color: white; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
          .data-table td { border-bottom: 1px solid #ddd; padding: 10px; font-size: 13px; }
          .data-table tr:nth-child(even) { background-color: #f8fafc; }
          .summary-section { margin-top: 30px; display: flex; gap: 20px; }
          .obs-box { flex: 2; border: 1px solid #ddd; padding: 15px; border-radius: 4px; font-size: 12px; background: #fff; }
          .total-box { flex: 1; background: #1e3a8a; color: white; padding: 15px; text-align: right; border-radius: 4px; font-size: 16px; font-weight: bold; }
          .footer { margin-top: 80px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .signature-block { width: 40%; text-align: center; }
          .line { border-top: 1px solid #333; margin-bottom: 10px; }
          .sign-name { font-weight: bold; font-size: 12px; }
          .sign-role { font-size: 10px; color: #666; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Parte Diario de Servicio</h1>
          <div class="subtitle">REPORTE DE ACTIVIDAD Y HORAS - ID #${form.id}</div>
        </div>
        <table class="meta-table">
          <tr><td class="label">FECHA:</td><td><strong>${formatDate(form.fecha)}</strong></td><td class="label">TURNO:</td><td>${form.turno}</td></tr>
          <tr><td class="label">SECTOR:</td><td>${form.sector.nombre}</td><td class="label">SUPERVISOR:</td><td>${form.supervisor.nombre}</td></tr>
          <tr><td class="label">PROYECTO:</td><td>${form.proyecto.nombre}</td><td class="label">CONTRATISTA:</td><td>${form.contratista.nombre}</td></tr>
           <tr><td class="label">ORDEN DE COMPRA:</td><td colspan="3">${form.ordenCompra || '-'}</td></tr>
        </table>
        <table class="data-table">
          <thead><tr><th>Operario / Recurso</th><th>Actividad Realizada</th><th style="text-align: right;">Horas</th></tr></thead>
          <tbody>
            ${form.detalles.map((d: any) => `<tr><td><strong>${d.operario.nombre}</strong></td><td>${d.actividad.nombre}</td><td style="text-align: right;">${d.horas} hs</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="summary-section">
          <div class="obs-box"><strong>OBSERVACIONES:</strong><br><br>${form.observaciones || 'Sin observaciones registradas.'}</div>
          <div class="total-box">TOTAL HORAS: ${totalHoras}</div>
        </div>
        <div class="footer">
          <div class="signature-block"><div class="line"></div><div class="sign-name">${form.supervisor.nombre}</div><div class="sign-role">Firma Supervisor</div></div>
          <div class="signature-block"><div class="line"></div><div class="sign-name">RESPONSABLE CLIENTE</div><div class="sign-role">Conformidad de Servicio</div></div>
        </div>
      </body>
      </html>
    `;
    
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' } });
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Parte_${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) { res.status(500).send("Error PDF"); }
});

// ==========================================
//    SERVIR FRONTEND EN PRODUCCIÓN
// ==========================================
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('API endpoint no encontrado');
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// --- CAMBIO CLAVE PARA LA NUBE ---
// Usamos process.env.PORT si existe (Nube), sino el 3000 (Local)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 SISTEMA ONLINE EN PUERTO: ${PORT}`);
  console.log(`==================================================\n`);
});