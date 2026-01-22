import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Parche para __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

// Aseguramos que el puerto sea un número
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// ==========================================
// 📡 EL CHISMOSO (MONITOR DE TRÁFICO)
// ==========================================
app.use((req, res, next) => {
  console.log(`📡 LLEGÓ PETICIÓN: ${req.method} ${req.url}`);
  next();
});

// --- UTILIDADES ---
const formatDate = (date: Date) => {
  try {
    return date.toISOString().split('T')[0].split('-').reverse().join('/');
  } catch (e) { return 'Fecha inválida'; }
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
    } catch (error) { 
        console.error(`Error GET ${nombreModelo}:`, error);
        res.status(500).json({ error: `Error al obtener ${nombreModelo}` }); 
    }
  });

  app.post(ruta, async (req, res) => {
    try {
      console.log(`Intentando crear en ${nombreModelo}:`, req.body);
      let data = req.body;
      if (data.sectorId) data.sectorId = Number(data.sectorId);
      const nuevo = await modeloPrisma.create({ data });
      console.log("Creado con éxito:", nuevo);
      res.json(nuevo);
    } catch (error) { 
        console.error(`Error POST ${nombreModelo}:`, error);
        res.status(400).json({ error: `Error al crear.` }); 
    }
  });

  app.delete(`${ruta}/:id`, async (req, res) => {
    try {
      await modeloPrisma.delete({ where: { id: Number(req.params.id) } });
      res.json({ success: true });
    } catch (error) { res.status(400).json({ error: 'No se pudo eliminar.' }); }
  });
}

// Inicializamos las rutas
crearRutasCatalogo('sectores', prisma.sector);
crearRutasCatalogo('contratistas', prisma.contratista);
crearRutasCatalogo('proyectos', prisma.proyecto);
crearRutasCatalogo('supervisores', prisma.supervisor);
crearRutasCatalogo('operarios', prisma.operario);
crearRutasCatalogo('actividades', prisma.actividad);


// --- GESTIÓN DE FORMULARIOS ---

app.post('/api/formularios', async (req, res) => {
  try {
    console.log("Recibiendo formulario:", req.body);
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
    console.log("Formulario guardado ID:", nuevo.id);
    res.json(nuevo);
  } catch (error) { 
    console.error("Error guardando formulario:", error);
    res.status(400).json({ error: 'Error guardando formulario' }); 
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


// ==========================================
//            RUTAS DE REPORTES
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
    
    // HTML SIMPLIFICADO PARA EVITAR ERRORES DE COPIA
    const htmlContent = `
      <html>
      <head><style>body{font-family:Arial;padding:20px;}</style></head>
      <body>
        <h1>Parte Diario #${form.id}</h1>
        <p><strong>Fecha:</strong> ${formatDate(form.fecha)} | <strong>Turno:</strong> ${form.turno}</p>
        <p><strong>Sector:</strong> ${form.sector.nombre} | <strong>Supervisor:</strong> ${form.supervisor.nombre}</p>
        <hr/>
        <h3>Detalles</h3>
        <ul>
          ${form.detalles.map((d: any) => `<li>${d.operario.nombre} - ${d.actividad.nombre} (${d.horas}hs)</li>`).join('')}
        </ul>
        <hr/>
        <p><strong>Observaciones:</strong> ${form.observaciones || 'Ninguna'}</p>
      </body>
      </html>
    `;
    
    const browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Parte_${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) { 
    console.error("Error generando PDF:", error);
    res.status(500).send("Error PDF"); 
  }
});

// ==========================================
//      SERVIR FRONTEND EN PRODUCCIÓN
// ==========================================
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).send('API endpoint no encontrado');
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Arrancamos el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 SISTEMA ONLINE EN PUERTO: ${PORT} y HOST: 0.0.0.0`);
  console.log(`==================================================\n`);
});