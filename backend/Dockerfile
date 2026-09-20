FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RABBIT_QUESTION_BANK=/app/content/math.question-bank.json
WORKDIR /app
RUN addgroup --system rabbit && adduser --system --ingroup rabbit rabbit
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY content ./content
USER rabbit
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
