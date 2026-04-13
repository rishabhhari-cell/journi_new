FROM ollama/ollama:latest

# Model is NOT pulled at build time — Railway build timeouts can't handle 2GB downloads.
# Instead, a startup script pulls the model on first boot and persists it to a Railway
# volume mounted at /root/.ollama. Subsequent restarts skip the pull (model already cached).

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 11434

HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=5 \
  CMD curl -sf http://localhost:11434/api/tags | grep -q "qwen2.5" || exit 1

CMD ["/start.sh"]
