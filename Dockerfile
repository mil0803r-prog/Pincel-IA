FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY pincel_ia ./pincel_ia
ENV PINCEL_DATOS=/datos PORT=8000
EXPOSE 8000
CMD ["python", "-m", "pincel_ia.server"]
