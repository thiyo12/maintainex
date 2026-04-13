FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

RUN npx prisma generate

RUN npm run build

RUN npm prune --production

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]