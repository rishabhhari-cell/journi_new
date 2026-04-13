#!/bin/sh
set -e

# Start Ollama server in the background
ollama serve &
OLLAMA_PID=$!

# Wait until Ollama is ready
echo "[entrypoint] Waiting for Ollama to start..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] Ollama is ready."

# Pull models listed in OLLAMA_DEFAULT_MODELS (comma-separated)
# Falls back to qwen2.5:3b if not set.
MODELS="${OLLAMA_DEFAULT_MODELS:-qwen2.5:3b}"
for MODEL in $(echo "$MODELS" | tr ',' ' '); do
  if curl -sf http://localhost:11434/api/tags | grep -q "$(echo "$MODEL" | cut -d: -f1)"; then
    echo "[entrypoint] $MODEL already present — skipping pull."
  else
    echo "[entrypoint] Pulling $MODEL..."
    ollama pull "$MODEL"
    echo "[entrypoint] $MODEL ready."
  fi
done

echo "[entrypoint] All models ready."
wait $OLLAMA_PID
