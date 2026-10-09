# ---------- Base ----------
FROM node:24-bookworm-slim AS base
WORKDIR /app

# ---------- Production dependencies ----------
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# ---------- Release ----------
FROM base AS release
COPY --from=deps /app/node_modules ./node_modules
COPY ./src ./src
USER node
CMD ["node", "src/index.js"]
