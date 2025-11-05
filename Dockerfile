# Multi-stage build for production
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    ca-certificates \
    && update-ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    ca-certificates \
    xvfb-run \
    x11vnc \
    fluxbox \
    dbus \
    freetype \
    fontconfig \
    && update-ca-certificates

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ytdownloader -u 1001 -G nodejs

# Copy built application from builder stage
COPY --from=builder --chown=ytdownloader:nodejs /app /app

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create necessary directories and set permissions
RUN mkdir -p /app/downloads /app/config && \
    chown -R ytdownloader:nodejs /app

# Switch to non-root user
USER ytdownloader

# Set environment variables
ENV NODE_ENV=production
ENV ELECTRON_DISABLE_SECURITY_WARNINGS=true
ENV DISPLAY=:99

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["xvfb-run", "-a", "-s", "-screen", "0", "1024x768x24", "fluxbox", "&", "sleep", "2", "&&", "npm", "start"]