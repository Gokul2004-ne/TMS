# Lightweight Python 3.11 slim image for Container Deployments
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

EXPOSE 8005

# Launch Uvicorn with memory recycling and port fallback (default port 8005)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8005} --workers 1 --limit-max-requests 500 --timeout-keep-alive 5"]
