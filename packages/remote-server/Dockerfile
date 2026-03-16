FROM node:20-slim

# node-pty needs Python + build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package.json ./
RUN npm install

# Copy source
COPY src/ ./src/

# Expose default port
EXPOSE 7533

# Production start
CMD ["node", "src/index.js"]
