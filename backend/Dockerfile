FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RABBIT_QUESTION_BANK=/app/content/math.question-bank.json \
    RABBIT_QUESTION_BANK_DIRECTORY=/app/content \
    RABBIT_DEMO_ASSET_DIRECTORY=/app/frontend/public
WORKDIR /app
RUN addgroup --system rabbit && adduser --system --ingroup rabbit rabbit
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/alembic.ini ./alembic.ini
COPY backend/migrations ./migrations
COPY content ./content
# The demo PDF embeds the same reviewed image served by the kid-view frontend.
COPY frontend/public/trivia-animals.png ./frontend/public/trivia-animals.png
USER rabbit
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.bootstrap && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
