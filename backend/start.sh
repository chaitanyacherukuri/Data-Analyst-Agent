#!/bin/bash
# Get the PORT environment variable, default to 8000 if not set
PORT=${PORT:-8000}
echo "Starting server on port: $PORT"
uvicorn app:app --host 0.0.0.0 --port "$PORT" 