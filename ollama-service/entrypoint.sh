#!/bin/sh

# Start Ollama server in the foreground — Railway health check needs it on :11434
# Model pull happens asynchronously so the health check passes immediately.

# Pull model in background after Ollama is ready
(
  i=0
  until wget -qO- http://localhost:11434/api/tags > /dev/null 2>&1; do
    i=$((i+1))
    if [ $i -ge 120 ]; then
      echo "[entrypoint] ERROR: Ollama did not start after 120s"
      exit 1
    fi
    sleep 1
  done
  echo "[entrypoint] Ollama ready after ${i}s. Pulling ${OLLAMA_DEFAULT_MODELS:-qwen2.5:3b}..."
  MODELS="${OLLAMA_DEFAULT_MODELS:-qwen2.5:3b}"
  for MODEL in $(echo "$MODELS" | tr ',' ' '); do
    ollama pull "$MODEL" && echo "[entrypoint] $MODEL ready." || echo "[entrypoint] WARNING: failed to pull $MODEL"
  done
  echo "[entrypoint] All models done."
) &

# Start Ollama in foreground (this keeps the container alive)
exec ollama serve
