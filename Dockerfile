# 1. Usamos la imagen OFICIAL de Puppeteer. 
# Ya trae Chrome y Node instalados y optimizados. ¡Cero instalaciones manuales!
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. Usamos usuario root para no tener problemas de permisos al copiar archivos
USER root

# 3. Saltamos la descarga de Chrome (porque ya viene en la imagen)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# 4. Preparamos la carpeta
WORKDIR /app

# 5. Copiamos archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# 6. Instalamos dependencias del proyecto (rápido)
RUN npm install

# 7. Generamos el cliente de base de datos
RUN npx prisma generate

# 8. Copiamos el resto del código
COPY . .

# 9. Construimos el Frontend
RUN npm run build

# 10. Comando de arranque
CMD sh -c "npx prisma db push && npx ts-node src/index.ts"