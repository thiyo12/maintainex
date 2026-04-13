FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all files first
COPY . .

# Install dependencies (skip scripts to avoid prisma generate before schema is ready)
RUN npm ci --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
