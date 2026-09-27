# ==========================================
# Multi-stage Production Dockerfile for Google Cloud Run
# ==========================================

# Stage 1: Build Frontend and Compile Server
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for compilation
COPY package*.json ./
RUN npm ci

# Copy source and compile application
COPY . .
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Cloud Run defaults and security hardening
ENV NODE_ENV=production
ENV PORT=3000

# Install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled bundles from builder stage
COPY --from=builder /app/dist ./dist

# Create local data directory for persistent file-based fallback
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-privileged user for container security
USER node

EXPOSE 3000

# Health check matching the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.cjs"]
