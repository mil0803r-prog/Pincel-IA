# 1) Compila la interfaz (React)
FROM node:22-slim AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# 2) Servidor (Python) con la interfaz ya compilada
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY pincel_ia ./pincel_ia
COPY --from=web /web/dist ./dist
ENV PINCEL_DATOS=/datos PORT=8000
EXPOSE 8000
CMD ["python", "-m", "pincel_ia.server"]
