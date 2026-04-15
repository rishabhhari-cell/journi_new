"""
Journi Scraper — GPU Modal endpoint for extracting structured journal guidelines
from raw HTML when rule-based extraction confidence is low.

Also runs a monthly scheduled job to scrape all stale journals.

Deploy:
  modal deploy modal-llm/scraper.py

Required Modal secret: "journi-llm-token"
  MODAL_TOKEN_SECRET=<same value as journi-llm>
  JOURNI_API_URL=<Railway Express API base URL, e.g. https://journi-api.up.railway.app>
  JOURNI_SCRAPER_SECRET=<random string — set same value in Railway JOURNI_SCRAPER_SECRET>

After deploying, set MODAL_SCRAPER_URL in Railway env vars to the printed endpoint URL.
"""
import modal

app = modal.App("journi-scraper")

volume = modal.Volume.from_name("journi-model-weights", create_if_missing=False)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.19.0",
        "huggingface_hub[hf_transfer]",
        "httpx",
        "fastapi[standard]",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

MODEL_ID = "Qwen/Qwen3-8B"
MODEL_DIR = "/models/qwen3-8b"

EXTRACTION_PROMPT = """You are extracting structured submission guidelines from a journal's Instructions for Authors page.

Return ONLY a valid JSON object with these fields (omit fields you cannot find):
{{
  "word_limits": {{ "abstract": <number|null>, "main_text": <number|null>, "total": <number|null> }},
  "citation_style": "<vancouver|apa|mla|harvard|ama|ieee|nlm|null>",
  "sections_required": ["Introduction", "Methods", ...],
  "structured_abstract": <true|false|null>,
  "figures_max": <number|null>,
  "tables_max": <number|null>,
  "keywords_required": <true|false|null>,
  "max_keywords": <number|null>,
  "requires_cover_letter": <true|false|null>,
  "acceptance_rate": <decimal 0-1|null>,
  "mean_time_to_publication_days": <number|null>,
  "notes": "<any other important requirements as a short string|null>"
}}

Page text:
---
{page_text}
---"""


@app.cls(
    gpu="A10G",
    image=image,
    volumes={{"/models": volume}},
    min_containers=0,
    timeout=120,
    secrets=[modal.Secret.from_name("journi-llm-token")],
)
@modal.concurrent(max_inputs=8)
class JourniScraper:
    @modal.enter()
    def load_model(self):
        from vllm import LLM
        volume.reload()
        self.llm = LLM(model=MODEL_DIR, dtype="float16")

    @modal.fastapi_endpoint(method="POST")
    def extract_guidelines(self, body: dict) -> dict:
        import json
        import os
        from vllm import SamplingParams

        if body.get("_auth") != os.environ.get("MODAL_TOKEN_SECRET"):
            return {"error": "unauthorized"}

        page_text = body.get("page_text", "")
        if not page_text:
            return {"error": "page_text is required"}

        # Truncate to ~3000 words to keep tokens manageable
        words = page_text.split()
        truncated = " ".join(words[:3000])

        prompt = EXTRACTION_PROMPT.format(page_text=truncated)
        params = SamplingParams(
            temperature=0.0,
            max_tokens=1024,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )

        outputs = self.llm.generate([prompt], params)
        raw = outputs[0].outputs[0].text.strip()

        # Strip markdown fences if present
        raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            return {"guidelines": json.loads(raw)}
        except json.JSONDecodeError:
            return {"error": "failed to parse LLM output", "raw": raw[:200]}


@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install("httpx"),
    schedule=modal.Cron("0 2 1 * *"),  # 02:00 UTC on the 1st of each month
    secrets=[modal.Secret.from_name("journi-llm-token")],
    timeout=3600,
)
async def monthly_journal_sync():
    """Calls the Express API to trigger journal scraping for stale journals."""
    import os
    import httpx

    api_url = os.environ.get("JOURNI_API_URL")
    secret = os.environ.get("JOURNI_SCRAPER_SECRET")
    if not api_url or not secret:
        raise RuntimeError("JOURNI_API_URL and JOURNI_SCRAPER_SECRET must be set in Modal secret")

    async with httpx.AsyncClient(timeout=3500) as client:
        response = await client.post(
            f"{api_url}/api/journals/sync-scrape",
            headers={"x-scraper-secret": secret},
        )
        response.raise_for_status()
        print(f"Sync complete: {response.json()}")
