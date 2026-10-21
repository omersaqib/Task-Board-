# syntax=docker/dockerfile:1
# Build from the REPOSITORY ROOT (npm workspaces share one lockfile):
#   docker build -f backend/Dockerfile -t taskboard-backend .

ARG NODE_VERSION=24

# ---- Stage 1: workspace manifests only (maximises layer caching) ----
FROM node:${NODE_VERSION}-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
# Every workspace manifest must be present or `npm ci` rejects the lockfile.
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY playwright/package.json playwright/package.json

# ---- Stage 2: compile TypeScript ----
FROM manifests AS build
# Root devDependencies (typescript) + backend deps; other workspaces are skipped.
RUN --mount=type=cache,target=/root/.npm \
    npm ci -w backend --include-workspace-root
COPY backend/ backend/
RUN npm run build -w backend

# ---- Stage 3: production-only dependencies ----
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci -w backend --omit=dev

# ---- Stage 4: runtime ----
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/data/taskboard.db
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
# SQLite file lives on a volume owned by the unprivileged user.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
WORKDIR /app/backend
EXPOSE 3001
# JWT_SECRET (>= 32 chars) must be supplied at runtime; the server refuses to start without it.
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
