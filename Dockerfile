FROM python:3.11-slim
ENV CACHE_BUST=20260606-1608

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 10000

CMD ["uvicorn", "asgi:application", "--host", "0.0.0.0", "--port", "10000", "--timeout-keep-alive", "120"]
