-- CreateTable
CREATE TABLE "Contratista" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Operario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "legajo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "UnidadMedida" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FormularioDiario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "ordenCompra" TEXT,
    "contratistaId" INTEGER NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "sectorId" INTEGER NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "turno" TEXT NOT NULL,
    "observaciones" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormularioDiario_contratistaId_fkey" FOREIGN KEY ("contratistaId") REFERENCES "Contratista" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormularioDiario_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormularioDiario_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FormularioDiario_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DetalleActividad" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formularioId" INTEGER NOT NULL,
    "operarioId" INTEGER NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "horas" DECIMAL NOT NULL,
    CONSTRAINT "DetalleActividad_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "FormularioDiario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetalleActividad_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "Operario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DetalleActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Contratista_nombre_key" ON "Contratista"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_nombre_key" ON "Proyecto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_nombre_key" ON "Sector"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_nombre_key" ON "Supervisor"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Operario_nombre_key" ON "Operario"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Actividad_nombre_key" ON "Actividad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadMedida_codigo_key" ON "UnidadMedida"("codigo");

-- CreateIndex
CREATE INDEX "FormularioDiario_fecha_idx" ON "FormularioDiario"("fecha");
