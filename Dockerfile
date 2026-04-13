FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies (skip scripts)
RUN npm ci --ignore-scripts

# Set environment variables for build
ENV DATABASE_URL="postgresql://postgres:XbzVyDNxDUcjSQr0E1qMFqdjugo3HiKFYBMLltNSlHRNKZEINcRVyCOgBzbJzmja@t988d08iic82x0ylduy1469p:5432/postgres?sslmode=require"
ENV NEXTAUTH_SECRET="maintainex-super-secret-key-2024"
ENV NEXTAUTH_URL="https://maintainex.lk"
ENV NODE_ENV="production"

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
