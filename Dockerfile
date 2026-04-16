# Multi-stage Dockerfile: build => runtime
FROM node:18-alpine AS build
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy sources and build (if build script exists)
COPY . .
RUN npm run build || true

FROM node:18-alpine AS runtime
WORKDIR /app

# Copy built artifacts and production deps from build stage
COPY --from=build /app /app

# Create non-root user and fix permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]