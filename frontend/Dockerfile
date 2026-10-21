# syntax=docker/dockerfile:1
# Build from the REPOSITORY ROOT:
#   docker build -f frontend/Dockerfile -t taskboard-frontend .

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY playwright/package.json playwright/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci -w frontend --include-workspace-root
COPY frontend/ frontend/
RUN npm run build -w frontend

FROM nginx:1.29-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
