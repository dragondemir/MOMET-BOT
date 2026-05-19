FROM node:18

# Gerekli sistem araçlarını kur
RUN apt-get update && apt-get install -y curl openssl

WORKDIR /app

# Paketleri kopyala ve kur
COPY package*.json ./
RUN npm install && \
    npm install pino pino-pretty axios mongoose @types/mongoose express && \
    npm install prisma@5.22.0 @prisma/client@5.22.0 && \
    npm install -g typescript ts-node

COPY . .

# Prisma motorunu oluştur (Klasör yolunu düzelttik!)
ENV PRISMA_CLIENT_ENGINE_TYPE="binary"
RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 7860

# Çevre değişkenlerini .env dosyasına yaz ve botu tertemiz başlat!
CMD sh -c "\
echo 'DISCORD_TOKEN='\"\$DISCORD_TOKEN\" > .env && \
echo 'TOKEN='\"\$DISCORD_TOKEN\" >> .env && \
echo 'MONGO_URI='\"\$MONGO_URI\" >> .env && \
echo 'DATABASE_URL='\"\$MONGO_URI\" >> .env && \
echo 'MONGODB_URI='\"\$MONGO_URI\" >> .env && \
echo 'CLIENT_ID='\"\$CLIENT_ID\" >> .env && \
npx ts-node --transpile-only src/index.ts"
