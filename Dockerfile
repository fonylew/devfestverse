# Use official lightweight Python image
FROM python:3.13-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    GCP_PROJECT=gdg-cloud-bangkok-2026

# Install system dependencies and uv package manager
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv for high-performance dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install production dependencies
RUN uv sync --frozen --no-install-project

# Copy application source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY architecture.md README.md ./

# Expose standard Cloud Run port
EXPOSE 8080

# Run FastAPI backend with Uvicorn
CMD ["uv", "run", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
