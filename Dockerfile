# 1) Compila la interfaz (React)
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2) Servidor (Python) con la interfaz ya compilada
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY pincel_ia ./pincel_ia
COPY --from=web /pincel_ia/static ./pincel_ia/static
ENV PINCEL_DATOS=/datos PORT=8000
EXPOSE 8000
CMD ["python", "-m", "pincel_ia.server"]
