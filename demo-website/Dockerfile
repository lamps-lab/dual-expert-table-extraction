# syntax=docker/dockerfile:1

ARG NODE_VERSION=24-alpine

# --- Stage 1: install dependencies -----------------------------------------
FROM node:${NODE_VERSION} AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: build ---------------------------------------------------------
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# --- Stage 3: runtime -------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

WORKDIR /app

# standalone/ carries server.js + the traced subset of node_modules.
# static/ and public/ are not copied into it by Next, so add them explicitly.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public



EXPOSE 3000

CMD ["node", "server.js"]
