#!/bin/sh
set -e

echo "[start.sh] Starting Ollama daemon..."
OLLAMA_HOST=0.0.0.0 ollama serve &
OLLAMA_PID=$!

# Wait until Ollama is ready to accept requests (poll local loopback)
echo "[start.sh] Waiting for Ollama to be ready..."
i=0
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  i=$((i+1))
  if [ $i -ge 120 ]; then
    echo "[start.sh] ERROR: Ollama did not become ready after 120s — exiting."
    exit 1
  fi
  sleep 1
done
echo "[start.sh] Ollama is ready after ${i}s."

# Pull the model only if not already present (volume cache)
if curl -sf http://localhost:11434/api/tags | grep -q "qwen2.5"; then
  echo "[start.sh] qwen2.5:3b already present — skipping pull."
else
  echo "[start.sh] Pulling qwen2.5:3b (first boot or volume cleared)..."
  ollama pull qwen2.5:3b
  echo "[start.sh] Pull complete."
fi

echo "[start.sh] Ready — handing off to Ollama process."
wait $OLLAMA_PID
