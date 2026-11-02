# BlackboxAI worker for Fly.io. Build from the repository root:
#   fly deploy --config apps/worker/fly.toml
FROM node:24-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@11.4.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@blackbox/worker..."
ENV NODE_ENV=production \
    WORKER_HEALTH_HOST=0.0.0.0 \
    WORKER_HEALTH_PORT=3502
EXPOSE 3502
CMD ["pnpm", "--filter", "@blackbox/worker", "start"]
