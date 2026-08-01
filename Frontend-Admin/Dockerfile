# Dependencies stage - production dependencies only
ARG NPM_REGISTRY=https://registry.npmjs.org

FROM node:20-slim AS deps
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
ARG NPM_REGISTRY
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
WORKDIR /workspace/Frontend-Admin
COPY Frontend-Admin/package.json Frontend-Admin/package-lock.json ./
RUN if [ -n "${HTTP_PROXY}" ]; then npm config set proxy "${HTTP_PROXY}"; fi && \
    if [ -n "${HTTPS_PROXY}" ]; then npm config set https-proxy "${HTTPS_PROXY}"; fi && \
    if [ -n "${NO_PROXY}" ]; then npm config set noproxy "${NO_PROXY}"; fi && \
    npm config set replace-registry-host always && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set registry ${NPM_REGISTRY} && \
    npm ci --only=production --no-audit --no-fund

# Builder stage - full dependencies for building
FROM node:20-slim AS builder
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
ARG NPM_REGISTRY
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
WORKDIR /workspace

# Copy Frontend-Admin files
COPY Frontend-Admin ./Frontend-Admin

# Install dependencies and build
WORKDIR /workspace/Frontend-Admin
RUN if [ -n "${HTTP_PROXY}" ]; then npm config set proxy "${HTTP_PROXY}"; fi && \
    if [ -n "${HTTPS_PROXY}" ]; then npm config set https-proxy "${HTTPS_PROXY}"; fi && \
    if [ -n "${NO_PROXY}" ]; then npm config set noproxy "${NO_PROXY}"; fi && \
    npm config set replace-registry-host always && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set registry ${NPM_REGISTRY} && \
    npm ci --include=dev --no-audit --no-fund

# Make sibling shared package TypeScript resolution find React modules.
RUN ln -sfn /workspace/Frontend-Admin/node_modules /workspace/node_modules

# Build arguments
ARG NEXT_PUBLIC_ADMIN_PORT

# Set environment variables for build
ENV NEXT_PUBLIC_ADMIN_PORT=$NEXT_PUBLIC_ADMIN_PORT
ENV NODE_ENV=production

# Build the application
# Next.js 16 defaults to Turbopack for build; in slim containers without native SWC
# binaries this may fall back to WASM and fail (`turbo.createProject` unsupported).
RUN node ./node_modules/next/dist/bin/next build --webpack

# Runner stage - minimal production image
FROM node:20-slim AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Copy built application with correct ownership
COPY --from=builder --chown=nextjs:nodejs /workspace/Frontend-Admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/Frontend-Admin/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/Frontend-Admin/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set runtime environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["node", "-e", "const http=require('http');const req=http.get({host:'127.0.0.1',port:Number(process.env.PORT||3000),path:'/'},(res)=>{process.exit(res.statusCode&&res.statusCode<500?0:1);});req.on('error',()=>process.exit(1));req.setTimeout(2000,()=>{req.destroy();process.exit(1);});"]

# Start the application
CMD ["node", "server.js"]
