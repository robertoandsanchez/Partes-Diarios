# Usamos una imagen base de Node ligera
FROM node:20-slim

# 1. Instalar dependencias del sistema necesarias para Puppeteer y Prisma
# (OpenSSL para la base de datos, Chromium para el PDF)
RUN apt-get update -y && apt-get install -y \
    openssl \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# 2. Variables de entorno para que Puppeteer use el Chrome instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 3. Preparar carpeta de trabajo
WORKDIR /app

# 4. Copiar archivos de configuración
COPY package*.json ./
COPY prisma ./prisma/

# 5. Instalar dependencias del proyecto
RUN npm install

# 6. Generar el cliente de Prisma
RUN npx prisma generate

# 7. Copiar el resto del código
COPY . .

# 8. Construir el Frontend
RUN npm run build

# 9. Comando de inicio (Crear tablas y arrancar)
CMD sh -c "npx prisma db push && npx ts-node src/index.ts"