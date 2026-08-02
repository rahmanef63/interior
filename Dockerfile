# Next.js standalone — multi-stage.
#
# The builder now also pushes the Convex backend (`npm run build` →
# scripts/build.mjs → `convex deploy --cmd`), so one image build ships both
# halves and NEXT_PUBLIC_CONVEX_URL is taken from the deploy key rather than
# from .env.production.
#
# That means the builder needs CONVEX_DEPLOY_KEY. Two ways in, preferred first:
#
#   1. BuildKit secret (does not enter any image layer or the build cache):
#        DOCKER_BUILDKIT=1 docker build \
#          --secret id=convex_deploy_key,env=CONVEX_DEPLOY_KEY -t interior .
#
#   2. Build arg, if the platform cannot mount secrets (this is the Dokploy path):
#        docker build --build-arg CONVEX_DEPLOY_KEY=prod:... -t interior .
#      The final `runner` stage never receives it, so it is absent from the
#      shipped image — but it IS recorded in the builder stage's layer history
#      on the build host. Prefer (1) where possible.
#
# The build PRINTS which of the two it found (presence only, never the value), so
# a failure says whether the platform ignored the secret or the arg was misnamed.
#
# CONVEX_REQUIRE_DEPLOY=1 makes a missing key a hard build failure instead of
# silently producing a frontend built against an un-pushed backend.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV CONVEX_REQUIRE_DEPLOY=1
ARG CONVEX_DEPLOY_KEY=""
# Escape hatch, passed through so a platform that can only set build args can
# still choose "frontend only" deliberately. Not a default anywhere.
ARG CONVEX_SKIP_DEPLOY=""
# Secret first, build arg second, and SAY WHICH — a build that fails with only
# "not set" cannot tell you whether the platform ignored your secret or you named
# the arg wrong, and those need opposite fixes. Prints presence, never the value.
#
# Testing for a NON-EMPTY secret matters: when the mount is absent BuildKit can
# still present an empty file, and `cat` of an empty file succeeds — so a plain
# `cat || echo $ARG` would silently discard the arg.
RUN --mount=type=secret,id=convex_deploy_key \
    SECRET="$(cat /run/secrets/convex_deploy_key 2>/dev/null || true)"; \
    echo "── convex deploy key ──"; \
    if [ -n "$SECRET" ]; then echo "   buildkit secret 'convex_deploy_key' : present"; \
    else echo "   buildkit secret 'convex_deploy_key' : absent"; fi; \
    if [ -n "$CONVEX_DEPLOY_KEY" ]; then echo "   build arg CONVEX_DEPLOY_KEY        : present"; \
    else echo "   build arg CONVEX_DEPLOY_KEY        : absent"; fi; \
    if [ -n "$SECRET" ]; then KEY="$SECRET"; else KEY="$CONVEX_DEPLOY_KEY"; fi; \
    CONVEX_DEPLOY_KEY="$KEY" CONVEX_SKIP_DEPLOY="$CONVEX_SKIP_DEPLOY" npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
