import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// --- MONITOR DE ERRORES (LOGS) ---
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] PETICIÓN: ${req.method} ${req.url}`);
  next();
});

const formatDate = (date: Date) => {
  try { return date.toISOString().split('T')[0].split('-').reverse().join('/'); } 
  catch (e) { return 'Fecha inválida'; }
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

// --- FORMULARIOS (CREAR Y EDITAR) ---

// CREAR
app.post('/api/formularios', async (req, res) => {
  try {
    console.log("📝 Intentando CREAR formulario:", req.body);
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
    console.log("✅ Creado ID:", nuevo.id);
    res.json(nuevo);
  } catch (error) { 
    console.error("❌ ERROR AL CREAR:", error); // ¡ESTO ES LO IMPORTANTE!
    res.status(400).json({ error: 'Error al guardar' }); 
  }
});

// EDITAR (AQUÍ ESTÁ EL PROBLEMA)
app.put('/api/formularios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    console.log(`🔄 Intentando EDITAR ID ${id}. Datos:`, req.body);
    const { detalles, ...cabecera } = req.body;

    // Validación básica de números
    if (!cabecera.sectorId || !cabecera.supervisorId) {
        throw new Error("Faltan IDs obligatorios (Sector o Supervisor)");
    }

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
    console.log("✅ Editado correctamente");
    res.json(actualizado);
  } catch (error: any) { 
    console.error("❌ ERROR AL EDITAR:", error.message, error); // ¡VEREMOS ESTO EN LOGS!
    res.status(400).json({ error: 'Error al actualizar: ' + error.message }); 
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

// --- REPORTES ---

app.get('/api/reportes/excel', async (req, res) => {
  try {
    console.log("📊 Generando Excel...");
    const { desde, hasta } = req.query; 
    if (!desde || !hasta) return res.status(400).send("Falta rango");

    const formularios = await prisma.formularioDiario.findMany({
      where: { fecha: { gte: new Date(String(desde)), lte: new Date(String(hasta)) } },
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
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { 
      console.error("❌ Error Excel:", error);
      res.status(500).send("Error Excel"); 
  }
});

app.get('/api/reportes/pdf/:id', async (req, res) => {
  try {
    console.log(`📄 Generando PDF para ID ${req.params.id}`);
    const id = Number(req.params.id);
    const form = await prisma.formularioDiario.findUnique({
      where: { id },
      include: { 
        sector: true, contratista: true, proyecto: true, supervisor: true,
        detalles: { include: { operario: true, actividad: true } }
      }
    });

    if (!form) return res.status(404).send("No encontrado");
    
    const htmlContent = `
      <html><head><style>body{font-family:Arial;padding:20px;} li{margin-bottom:5px;}</style></head><body>
        <h1 style="color:#1e3a8a;">Parte Diario #${form.id}</h1>
        <p><strong>Fecha:</strong> ${formatDate(form.fecha)} | <strong>Turno:</strong> ${form.turno}</p>
        <p><strong>Sector:</strong> ${form.sector.nombre}</p>
        <p><strong>Supervisor:</strong> ${form.supervisor.nombre}</p>
        <hr/>
        <h3>Detalle de Actividades</h3>
        <ul>
          ${form.detalles.map((d: any) => `<li><strong>${d.operario.nombre}</strong>: ${d.actividad.nombre} (${d.horas} hs)</li>`).join('')}
        </ul>
        <hr/><p>Generado automáticamente.</p>
      </body></html>
    `;
    
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Parte_${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) { 
    console.error("❌ Error PDF:", error);
    res.status(500).send("Error PDF"); 
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