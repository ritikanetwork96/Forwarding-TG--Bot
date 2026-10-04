# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace configurations
COPY package.json package-lock.json* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm ci || npm install

# Copy source files
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package and api
RUN npm run build:shared
RUN npm run build:api

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy root and package manifests
COPY package.json package-lock.json* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 5000

CMD ["node", "apps/api/dist/server.js"]
