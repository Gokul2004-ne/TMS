# Lightweight Python 3.11 slim image for Zoho Catalyst AppSail & Container Deployments
FROM python:3.11-slim

WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered streaming logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies if needed and Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source code
COPY . .

# Zoho Catalyst AppSail standard port is 9000 (also compatible with $PORT)
EXPOSE 9000

# Launch Uvicorn with memory recycling and port fallback (port 9000 for Catalyst, $PORT for Render/Railway/Fly/CloudRun)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-9000} --workers 1 --limit-max-requests 500 --timeout-keep-alive 5"]
