# syntax=docker/dockerfile:1
# One-shot Prisma migrate / seed / RBAC runner. Not an application service.

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 memora \
  && useradd --system --uid 1001 --gid memora --home-dir /app --no-create-home memora
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.base.json ./
COPY apps/iam-service/prisma.config.ts ./apps/iam-service/prisma.config.ts
COPY apps/iam-service/prisma ./apps/iam-service/prisma
COPY libs/contracts/src/iam/permissions.ts ./libs/contracts/src/iam/permissions.ts
ENV IAM_DATABASE_URL=postgresql://prisma_generate:unused@127.0.0.1:5432/prisma_generate?schema=iam
RUN npx prisma generate --config apps/iam-service/prisma.config.ts
USER memora
ENTRYPOINT ["npx", "prisma", "migrate", "deploy", "--config", "apps/iam-service/prisma.config.ts"]
