FROM node:20-alpine
WORKDIR /app/server

# Install server deps
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Copy API source
COPY server/ ./

# ⬅️ Copy the root data folder so ../data/defaultData.json exists
COPY data /app/data

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "index.js"]
