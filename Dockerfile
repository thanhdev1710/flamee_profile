# ============================
# Stage 1: Build
# ============================
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm ci

COPY . .

# Prisma generate (output đã chỉ định trong schema.prisma)
RUN npx prisma generate

RUN npm run build

# ============================
# Stage 2: Production image
# ============================
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Copy Prisma client generated
COPY --from=builder /app/src/generated ./dist/generated

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/server.js"]
