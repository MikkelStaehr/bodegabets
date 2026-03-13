FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies at root so both lib/ and railway/ can resolve packages
COPY railway/package.json railway/package-lock.json* ./railway/
RUN cd railway && npm install
RUN ln -s /app/railway/node_modules /app/node_modules

# Copy source files needed for compilation
COPY lib/ ./lib/
COPY railway/ ./railway/

# Build TypeScript (tsconfig rootDir is .., outDir is dist)
RUN cd railway && npm run build

# ─── Production stage ────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/railway/package.json ./package.json
COPY --from=builder /app/railway/package-lock.json* ./
RUN npm install --omit=dev

# Copy compiled output (rootDir=".." means output mirrors project structure)
COPY --from=builder /app/railway/dist/ ./dist/

EXPOSE 3000

CMD ["node", "dist/railway/index.js"]
