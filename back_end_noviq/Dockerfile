FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN python -c "from pathlib import Path; path = Path('requirements.txt'); path.write_text(path.read_text(encoding='utf-16'), encoding='utf-8')" \
    && python -m pip install -r requirements.txt gunicorn==23.0.0 \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app

COPY --chown=app:app . .

USER app

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 8 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile - run:app"]
