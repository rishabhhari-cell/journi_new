"""
Journi Embed — CPU-only Modal endpoint for 384-dim sentence embeddings.
Uses sentence-transformers/all-MiniLM-L6-v2.

Deploy:
  modal deploy modal-llm/embed.py

Required Modal secret: "journi-llm-token"
  MODAL_TOKEN_SECRET=<same value as journi-llm>

After deploying, set MODAL_EMBED_URL in Railway env vars to the printed endpoint URL.
"""
import modal

app = modal.App("journi-embed")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("sentence-transformers==3.0.1")
)


@app.cls(
    image=image,
    cpu=2,
    memory=1024,
    min_containers=0,
    timeout=60,
    secrets=[modal.Secret.from_name("journi-llm-token")],
)
class JourniEmbed:
    @modal.enter()
    def load_model(self):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    @modal.fastapi_endpoint(method="POST")
    def embed(self, body: dict) -> dict:
        import os
        if body.get("_auth") != os.environ.get("MODAL_TOKEN_SECRET"):
            return {"error": "unauthorized"}

        texts = body.get("texts")
        if not texts or not isinstance(texts, list):
            return {"error": "texts must be a non-empty list of strings"}

        embeddings = self.model.encode(texts, normalize_embeddings=True).tolist()
        return {"embeddings": embeddings}
