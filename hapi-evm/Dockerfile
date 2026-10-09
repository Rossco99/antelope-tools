# ---------- Base ----------
FROM node:24-bookworm-slim AS base
WORKDIR /app

# ---------- Builder (also used for local development) ----------
FROM base AS builder
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY ./ ./
RUN yarn build

# ---------- Production dependencies ----------
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# ---------- Release ----------
FROM base AS release
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./src
USER node
CMD ["node", "./src/index.js"]
