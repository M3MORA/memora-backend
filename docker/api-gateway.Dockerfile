# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:20.20.2-bookworm-slim
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.base.json tsconfig.build.json ./
COPY apps ./apps
COPY libs ./libs
COPY proto ./proto
RUN npx nest build api-gateway

FROM ${NODE_IMAGE} AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 memora \
  && useradd --system --uid 1001 --gid memora --home-dir /app --no-create-home memora
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto
USER memora
EXPOSE 3000
CMD ["node", "dist/apps/api-gateway/main.js"]
