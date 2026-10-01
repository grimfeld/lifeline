# Lifeline MCP server (ADR 0062). Built from the repository root — the server
# bundles Core and every App — so deploy with:
#   fly deploy . --config mcp/fly.toml
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter "@lifeline/mcp..."
RUN pnpm --filter @lifeline/mcp build

# The bundle is self-contained: no node_modules at runtime.
FROM node:22-alpine
WORKDIR /app
COPY --from=build /repo/mcp/dist/ ./
ENV NODE_ENV=production
USER node
EXPOSE 8787
CMD ["node", "--enable-source-maps", "server.mjs"]
