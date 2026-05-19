FROM node:18

# Cloudflare WARP bağımlılıklarını ve gerekli araçları kur
RUN apt-get update && apt-get install -y curl gpg && \
    curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ buster main" | tee /etc/apt/sources.list.d/cloudflare-client.list && \
    apt-get update && apt-get install -y cloudflare-warp

WORKDIR /app

# Paketleri kopyala ve kur
COPY package*.json ./
RUN npm install && \
    npm install pino pino-pretty axios mongoose @types/mongoose express && \
    npm install prisma@5.22.0 @prisma/client@5.22.0 && \
    npm install -g typescript ts-node

COPY . .

ENV PRISMA_CLIENT_ENGINE_TYPE="binary"
RUN npx prisma generate --schema=MOMET/prisma/schema.prisma

EXPOSE 7860

# Arka planda WARP servisini başlatıp, botu yerel tünelden geçiriyoruz
CMD sh -c "\
warp-cli --accept-tos registration new && \
warp-cli --accept-tos mode proxy && \
warp-cli --accept-tos connect && \
echo 'DISCORD_TOKEN='\"\$DISCORD_TOKEN\" > .env && \
echo 'TOKEN='\"\$DISCORD_TOKEN\" >> .env && \
echo 'MONGO_URI='\"\$MONGO_URI\" >> .env && \
echo 'DATABASE_URL='\"\$MONGO_URI\" >> .env && \
echo 'MONGODB_URI='\"\$MONGO_URI\" >> .env && \
echo 'CLIENT_ID='\"\$CLIENT_ID\" >> .env && \
npx ts-node --transpile-only MOMET/src/index.ts"
