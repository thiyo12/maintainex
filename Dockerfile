FROM node:20-slim

ARG NEXTAUTH_SECRET=placeholder-build-only
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

RUN apt-get update && apt-get install -y openssl build-essential python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN mkdir -p public/uploads/services && chmod 755 public/uploads/services

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
