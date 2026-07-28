FROM node:20-slim

ARG NEXTAUTH_SECRET=placeholder-build-only
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

RUN apt-get update && apt-get install -y openssl build-essential python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

COPY . .

RUN rm -rf prisma/migrations && \
    sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma && \
    npx prisma generate && \
    mkdir -p public/uploads/services && chmod 755 public/uploads/services

RUN npm run build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD npx prisma db push && npm start
