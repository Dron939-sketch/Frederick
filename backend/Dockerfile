FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости для голоса и сборки
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    ffmpeg \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь код
COPY . .

# Открываем порт
EXPOSE 10000

# Запускаем сервер с поддержкой WebSocket
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000", "--timeout-keep-alive", "120"]
