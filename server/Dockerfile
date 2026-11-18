# Backend — Node 20 + Prisma
FROM node:20-slim

# openssl ให้ Prisma · chromium + ฟอนต์ไทย ให้รายงาน PDF (บอร์ด PM/KHAW)
# --no-install-recommends กันอิมเมจบวม · fonts-thai-tlwg = ฟอนต์ไทยสำรองของ footer PDF
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl chromium fonts-thai-tlwg \
    && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate

EXPOSE 3000
# migrate deploy ก่อน start (idempotent) — seed แยกทำครั้งแรกด้วยมือ
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
