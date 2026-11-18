# Nobel BOQ: one container serves the web app and the API (Render, or any Docker host).
#
# Stage 1 builds the React app; stage 2 runs the FastAPI server, which serves the built
# app at "/" and the API at "/api". Persistent data (SQLite database, signing key and
# sheet images) lives in DATA_DIR, which must be a mounted disk in production.

# ---------------------------------------------------------------- 1. frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --include=dev
COPY app/ ./
# Same-origin API: no VITE_API_URL, the app calls /api on the server that serves it
RUN npm run build

# ---------------------------------------------------------------- 2. server
FROM python:3.11-slim
WORKDIR /workspace

# Tesseract (Azerbaijani, Russian, English) for optional OCR of image-only sheets.
# Off by default (OCR_DISABLED=1, below); the server skips OCR when it is disabled or missing.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-aze tesseract-ocr-rus tesseract-ocr-eng curl \
    && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt ./server/
RUN pip install --no-cache-dir -r server/requirements.txt

COPY server/ ./server/
COPY --from=frontend-builder /app/dist ./app/dist
# Sample project and the default rate library
COPY app/src/data/qobu.json ./app/src/data/qobu.json

# FORWARDED_ALLOW_IPS: Render's proxy sits in front of the container; trust it for the client IP
#   (login throttling would otherwise see every visitor as the proxy).
# OCR_DISABLED=1: OCR of scanned sheets is off. Measured: 37 scanned CAD sheets took 7 minutes
#   and gave no usable quantities. Scanned sheets are flagged for manual takeoff instead.
ENV DATA_DIR=/data \
    PORT=8090 \
    PYTHONUNBUFFERED=1 \
    FORWARDED_ALLOW_IPS="*" \
    OCR_DISABLED=1

RUN useradd --create-home --uid 10001 nobel && mkdir -p /data/sheets && chown -R nobel /data
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# A mounted disk arrives owned by root: fix ownership, then drop to the unprivileged user.
CMD ["sh", "-c", "mkdir -p \"$DATA_DIR/sheets\" && chown -R nobel \"$DATA_DIR\" && exec setpriv --reuid=10001 --regid=10001 --init-groups uvicorn app:app --app-dir server --host 0.0.0.0 --port \"${PORT:-8090}\" --proxy-headers --timeout-keep-alive 75"]
