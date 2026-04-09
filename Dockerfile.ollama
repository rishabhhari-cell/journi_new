FROM ollama/ollama:latest

# Pull the model at build time so it's baked into the image.
# This avoids a slow cold-start on first request.
RUN ollama serve & sleep 5 && ollama pull qwen3:4b && pkill ollama

EXPOSE 11434

CMD ["ollama", "serve"]
