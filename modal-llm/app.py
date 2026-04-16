"""
Journi LLM — Modal serverless inference endpoint.

Runs Qwen3:8B via vLLM on an A10G GPU. Thinking mode is disabled so output
is clean JSON without <think>...</think> preambles.

Deploy:
  modal deploy modal-llm/app.py

Pull model weights into the Volume (run once):
  modal run modal-llm/app.py::download_model

Required Modal secret: "journi-llm-token"
  MODAL_TOKEN_SECRET=<random string>  (same value set in Railway env vars)
"""
import modal

app = modal.App("journi-llm")

# Persistent volume for model weights — survives across container restarts.
volume = modal.Volume.from_name("journi-model-weights", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.19.0",
        "huggingface_hub[hf_transfer]",
        "fastapi[standard]",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

MODEL_ID = "Qwen/Qwen3-8B"
MODEL_DIR = "/models/qwen3-8b"
MODEL_READY_FILES = ("config.json", "tokenizer.json", "tokenizer_config.json")


@app.function(
    image=image,
    volumes={"/models": volume},
    timeout=300,
)
def download_model():
    """Pull model weights into the Volume. Run once: modal run modal-llm/app.py::download_model"""
    from huggingface_hub import snapshot_download
    import os

    os.makedirs(MODEL_DIR, exist_ok=True)
    snapshot_download(repo_id=MODEL_ID, local_dir=MODEL_DIR)
    volume.commit()
    print(f"Model downloaded to {MODEL_DIR}")


# Keep this at 0 until the model image and volume contents are stable.
@app.cls(
    gpu="A10G",
    image=image,
    volumes={"/models": volume},
    min_containers=0,
    timeout=120,
    secrets=[modal.Secret.from_name("journi-llm-token")],
)
@modal.concurrent(max_inputs=8)
class JourniLLM:
    @modal.enter()
    def load_model(self):
        import os
        from vllm import LLM

        # Refresh the mounted volume so a warm container sees the latest commit
        # from `download_model`.
        volume.reload()

        missing_files = [
            filename
            for filename in MODEL_READY_FILES
            if not os.path.exists(os.path.join(MODEL_DIR, filename))
        ]
        if missing_files:
            raise RuntimeError(
                "Model volume is not ready at "
                f"{MODEL_DIR}. Missing files: {missing_files}. "
                "Run `modal run modal-llm/app.py::download_model` and retry."
            )

        self.llm = LLM(model=MODEL_DIR, dtype="float16")

    @modal.fastapi_endpoint(method="POST")
    def infer(self, body: dict, authorization: str = "") -> dict:
        import os
        from vllm import SamplingParams

        expected = f"Bearer {os.environ.get('MODAL_TOKEN_SECRET', '')}"
        if authorization != expected:
            return {"error": "unauthorized"}

        prompt = body.get("prompt", "")
        if not prompt:
            return {"error": "prompt is required"}

        params = SamplingParams(
            temperature=0.0,
            max_tokens=4096,
            # Disable Qwen3 thinking mode — required for clean JSON output.
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )

        outputs = self.llm.generate([prompt], params)
        return {"response": outputs[0].outputs[0].text}

    @modal.fastapi_endpoint(method="POST")
    def reformat_section(self, body: dict, authorization: str = "") -> dict:
        import json
        import os
        from vllm import SamplingParams

        expected = f"Bearer {os.environ.get('MODAL_TOKEN_SECRET', '')}"
        if authorization != expected:
            return {"error": "unauthorized"}

        section_title = body.get("section_title", "")
        section_content = body.get("section_content", "")
        guidelines_summary = body.get("guidelines_summary", "")

        if not section_content:
            return {"error": "section_content is required"}

        words = section_content.split()
        truncated_content = " ".join(words[:400])  # ~2000 chars, word-boundary safe

        prompt = f"""You are helping reformat a section of an academic manuscript to meet journal submission requirements.

Journal requirements:
{guidelines_summary}

Section: {section_title}
Content:
---
{truncated_content}
---

Return a JSON array of suggestions. Each suggestion:
{{
  "type": "trim" or "restructure",
  "original": "<exact quote from the content that needs changing>",
  "suggested": "<replacement text>",
  "reason": "<one sentence explanation>"
}}

Rules:
- Only suggest changes that are required by the journal guidelines above.
- For trim: identify specific overlong paragraphs. Quote the exact text in "original".
- For restructure: only if the section structure clearly violates guidelines.
- If no changes are needed, return an empty array [].
- Return ONLY a valid JSON array. No markdown fences, no commentary."""

        params = SamplingParams(
            temperature=0.0,
            max_tokens=2048,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )

        outputs = self.llm.generate([prompt], params)
        raw = outputs[0].outputs[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                parsed = []
            return {"suggestions": parsed}
        except json.JSONDecodeError:
            return {"suggestions": [], "parse_error": raw[:200]}
