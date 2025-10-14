# ===============================
# 1️⃣ Build stage — Vite build
# ===============================
FROM node:20-alpine AS build
WORKDIR /app

# Copy package manifests first for caching
COPY package*.json ./

# Install dependencies
RUN npm install --no-audit --no-fund --ignore-scripts

# Copy the rest of the source code
COPY . .

# Pass in the API base URL (default /api for proxying)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build production assets
RUN VITE_API_BASE_URL=$VITE_API_BASE_URL npm run build

# ===============================
# 2️⃣ Serve stage — Nginx
# ===============================
FROM nginx:1.27-alpine AS serve
WORKDIR /usr/share/nginx/html

# Copy the built static files from the previous stage
COPY --from=build /app/dist ./

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O - http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
