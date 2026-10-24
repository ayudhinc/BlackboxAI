# Meta stack

Verified against dev.meta.ai docs on 2026-10-23. Base URL `https://api.meta.ai/v1`, bearer token `MODEL_API_KEY`, OpenAI and Anthropic SDK compatible.

## Models used

| Model | Role in BlackboxAI | Limits that matter | Price |
|---|---|---|---|
| `sam-3.1` | Track UI primitives across screen video (video mode) | Video ≤15,000 frames (about 10 min) per request; MP4 or MOV, H.264, H.265 or MPEG-4 (no VP9 or WebM); ≤16 tracked objects per frame; one concept per request; text prompt holds either a noun phrase or box and point prompts, never both; negative points only; `propagation_direction` forward, backward or both; `mask_encoding` `one_bit` for small payloads; `include_confidence` opt-in; output is a special-token grammar decoded by `meta-sam-parser` (Python ≥0.0.6) or `@meta-sam/parser` (TypeScript ≥0.0.13); 50-frame minimum billing; weak zero-shot on fine-grained, out-of-domain concepts; no published evaluation on GUI imagery | $0.20 per 1,000 frames · $2.50 per 1,000 images |
| `muse-spark-1.3` | Step narration, policy compilation, verdicts | 1,048,576-token context; text, image, video, audio and PDF in; structured output, parallel tool calls, search grounding, computer use; reasoning effort up to `max`; audio degraded on 1.3 (use 1.2 if audio matters) | $1.25 in · $4.25 out per M tokens · cached in $0.15 |
| `muse-wonder-1.0` | Generates the demo agent runs (computer use) | Preview; Wonder Full is not on the API | $4 in · $20 out per M tokens |
| `muse-glimmer` 30B (open weights) | On-prem path for regulated accounts | Apache 2.0; self-hosted with vLLM, SGLang or llama.cpp; not on the Model API | Own compute |

Not used in v0: Muse Image (no mask parameter, non-deterministic), Muse Voice Transcribe (no audio in the core flow).

## Rate limits (per team, unofficial guide)

Muse Spark Standard 3,000 requests and 4M tokens per minute. SAM 3.1 3,000 requests per minute.

## Cost per run

| Run | Video mode | Native mode |
|---|---|---|
| 4 min 26 s, 2 fps, 4 SAM concepts | about $0.52 | about $0.03 |
| 10 min, 2 fps, 4 concepts | about $1.10 | about $0.05 |

SAM dominates video-mode cost: frames × concepts × $0.0002. Native mode skips SAM.

## Practical notes

- Export MP4 with `-movflags +faststart` so the service does not remux.
- Upload each clip once with `POST /v1/files` (`purpose=user_data`) and reference it by `file_id`.
- Use `one_bit` masks for video; boxes are enough for most checks.
- Never use `-contributor` model variants for customer data; they train Meta's models.
