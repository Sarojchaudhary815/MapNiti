FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

# GDAL/PROJ for rasterio/geopandas wheels' runtime needs
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/static/avatars /app/static/articles /app/static/field /app/static/resumes /app/static/boundaries

EXPOSE 8000
# 4 workers is a good default for a 2-vCPU server; tune with WEB_CONCURRENCY.
CMD ["sh", "-c", "gunicorn main:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY:-4} -b 0.0.0.0:8000 --timeout 300"]
