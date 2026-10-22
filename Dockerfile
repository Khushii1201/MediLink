# Multi-Stage Production Dockerfile for MediLink

# ==========================================
# Stage 1: Frontend Build
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install native compilation dependencies for better-sqlite3 on Alpine
RUN apk add --no-cache python3 make g++

# Set production environment
ENV NODE_ENV=production \
    PORT=5000 \
    DB_PATH=/data/medilink.db

# Create persistent database directory
RUN mkdir -p /data && chown -R node:node /data

# Install backend production dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY backend/ ./

# Copy built frontend assets to frontend/dist for backend static serving
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Switch to unprivileged node user
USER node

EXPOSE 5000

# Health check against backend health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
