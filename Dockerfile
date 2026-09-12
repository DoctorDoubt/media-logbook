# Build the frontend, then run the API and serve the built files.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:frontend

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# tsx is a runtime dependency, so dev dependencies (Tauri CLI, Vite, test
# tooling) are not installed here.
RUN npm ci --omit=dev && npm cache clean --force

COPY api ./api
COPY server ./server
COPY migrate-db.ts ./
COPY --from=build /app/dist ./dist

# Don't run as root.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000

# Apply the schema (idempotent) before accepting traffic.
CMD ["sh", "-c", "npm run migrate && npm run serve"]
