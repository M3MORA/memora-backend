# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.base.json tsconfig.build.json ./
COPY apps ./apps
COPY libs ./libs
COPY proto ./proto
# prisma.config.ts requires IAM_DATABASE_URL; generate does not connect.
ENV IAM_DATABASE_URL=postgresql://prisma_generate:unused@127.0.0.1:5432/prisma_generate?schema=iam
RUN npm run prisma:iam:generate \
  && npx nest build iam-service

FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 memora \
  && useradd --system --uid 1001 --gid memora --home-dir /app --no-create-home memora
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto
COPY --from=build /app/apps/iam-service/generated ./apps/iam-service/generated
USER memora
EXPOSE 50051 5051
CMD ["node", "dist/apps/iam-service/main.js"]
