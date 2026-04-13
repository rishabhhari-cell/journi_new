#!/bin/sh
set -e

# Start Ollama daemon in the background
ollama serve &
OLLAMA_PID=$!

# Wait until Ollama is ready to accept requests
echo "[start.sh] Waiting for Ollama to be ready..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 1
done
echo "[start.sh] Ollama is ready."

# Pull the model only if it isn't already present (volume cache check)
if curl -sf http://localhost:11434/api/tags | grep -q "qwen2.5"; then
  echo "[start.sh] qwen2.5:3b already present — skipping pull."
else
  echo "[start.sh] Pulling qwen2.5:3b (first boot or volume cleared)..."
  ollama pull qwen2.5:3b
  echo "[start.sh] Pull complete."
fi

# Hand off to the Ollama process (keep container alive)
wait $OLLAMA_PID
