FROM node:20-slim

WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Install frontend dependencies and build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy source
COPY src/ ./src/

# Create data directories
RUN mkdir -p data logs

EXPOSE 3000

CMD ["node", "src/server.js"]
