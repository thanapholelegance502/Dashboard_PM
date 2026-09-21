# Backend — Node 20 + Prisma
FROM node:20-slim

# openssl ให้ Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate

EXPOSE 3000
# migrate deploy ก่อน start (idempotent) — seed แยกทำครั้งแรกด้วยมือ
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
