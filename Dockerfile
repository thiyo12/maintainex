FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN mkdir -p public/uploads/services && chmod 755 public/uploads/services

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
