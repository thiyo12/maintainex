FROM node:20-slim

RUN apt-get update && apt-get install -y openssl build-essential python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN mkdir -p public/uploads/services && chmod 755 public/uploads/services

RUN npm run build

EXPOSE 3000

CMD npx prisma db push --accept-data-loss 2>&1 | tee /tmp/prisma-push.log; echo "--- Starting Next.js ---"; next start 2>&1
