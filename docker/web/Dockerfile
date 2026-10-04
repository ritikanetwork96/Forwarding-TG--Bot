# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace configurations
COPY package.json package-lock.json* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci || npm install

# Copy source files
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared package and web
RUN npm run build:shared
RUN npm run build:web

# Production runtime stage (Nginx)
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
