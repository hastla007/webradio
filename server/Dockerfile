FROM node:20-alpine
WORKDIR /app/server

# Install dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy server source
COPY server/ ./

# Copy data folder for defaults
COPY data /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

# Default to database mode, can be overridden
CMD ["node", "index-db.js"]
