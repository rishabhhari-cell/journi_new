FROM ollama/ollama:latest

# Pull the model at build time so it's baked into the image.
# This avoids a slow cold-start on first request.
# Use a readiness loop instead of a fixed sleep — Railway build runners vary in speed.
RUN ollama serve & \
    pid=$! && \
    echo "Waiting for Ollama to be ready..." && \
    until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do sleep 1; done && \
    echo "Ollama ready — pulling qwen3:4b..." && \
    ollama pull qwen3:4b && \
    echo "Model pull complete — stopping daemon" && \
    kill $pid && wait $pid 2>/dev/null || true

EXPOSE 11434

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -sf http://localhost:11434/api/tags | grep -q "qwen3" || exit 1

CMD ["ollama", "serve"]
