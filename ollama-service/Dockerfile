FROM ollama/ollama:latest

# Railway's recommended pattern: pull models at container startup via an entrypoint
# script, not at build time. Models persist across restarts via a Railway volume
# mounted at /root/.ollama (set this up in the Railway dashboard).
#
# Set OLLAMA_DEFAULT_MODELS=qwen2.5:3b in Railway env vars to control which model
# is pulled on first boot. Subsequent restarts skip the pull if the volume is present.

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Bind on all interfaces (IPv4 + IPv6) — required for Railway's internal networking
ENV OLLAMA_HOST=::
ENV PORT=11434

EXPOSE 11434

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -sf http://localhost:11434/api/tags > /dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
