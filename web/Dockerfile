# syntax=docker/dockerfile:1

# Build from the web directory, so only the frontend is in the context:
#
#   docker build -t attrails/web web

# Keep in sync with the node and pnpm versions in mise.toml.
ARG NODE_VERSION=26.12.1
ARG PNPM_VERSION=12.14.0

FROM node:${NODE_VERSION}-trixie-slim AS base
ARG PNPM_VERSION
RUN npm install --global pnpm@${PNPM_VERSION}
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder

ARG ATTRAILS_UMAMI_SCRIPT_URL
ENV ATTRAILS_UMAMI_SCRIPT_URL=${ATTRAILS_UMAMI_SCRIPT_URL}

ARG ATTRAILS_UMAMI_WEBSITE_ID
ENV ATTRAILS_UMAMI_WEBSITE_ID=${ATTRAILS_UMAMI_WEBSITE_ID}

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules node_modules
COPY . .

RUN pnpm build

FROM gcr.io/distroless/nodejs26-debian13:nonroot

WORKDIR /app

ENV NODE_ENV=production

ARG ATTRAILS_UMAMI_SCRIPT_URL
ENV ATTRAILS_UMAMI_SCRIPT_URL=${ATTRAILS_UMAMI_SCRIPT_URL}

ARG ATTRAILS_UMAMI_WEBSITE_ID
ENV ATTRAILS_UMAMI_WEBSITE_ID=${ATTRAILS_UMAMI_WEBSITE_ID}

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /app/.next/static .next/static

EXPOSE 3000

CMD ["server.js"]
