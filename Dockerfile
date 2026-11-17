# Multi-stage build for Storm Takeoff (Production Ready)
# ----------------------------------------------------
# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --include=dev
COPY app/ ./
RUN npm run build

# Stage 2: Python 3.11 Backend with PyMuPDF, FastAPI, Uvicorn
FROM python:3.11-slim
WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY server/requirements.txt ./server/
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy server code
COPY server/ ./server/

# Copy built frontend assets to app/dist for full-stack static serving
COPY --from=frontend-builder /app/dist ./app/dist

# Mountable persistent storage directory for SQLite database & blueprint WebP sheets
ENV DATA_DIR=/data
ENV PORT=8090
RUN mkdir -p /data/sheets

EXPOSE 8090

CMD ["sh", "-c", "uvicorn server.app:app --host 0.0.0.0 --port ${PORT:-8090}"]
