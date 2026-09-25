### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish
FROM cgr.dev/defenseunicorns.com/node:26-dev@sha256:73b206d4b2fe15a1ed9eb1e6ccaf07205ef252eb20d2d49c2e1a9680e02c0fac AS build-image

FROM cgr.dev/defenseunicorns.com/node:26-slim@sha256:47f8673979ff7b7d45f9ef6f8eaa381fbca021a513a37a534455cde0ad33d1e7 AS base-image

FROM build-image AS build

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./
COPY --chown=node:node ./patches/ ./patches/

# Install deps
RUN npm ci

COPY --chown=node:node ./hack/ ./hack/

COPY --chown=node:node ./build.mjs ./
COPY --chown=node:node ./config/tsconfig.root.json ./config/tsconfig.root.json
COPY --chown=node:node ./src/ ./src/

RUN npm run build && \
    npm prune --omit=dev --omit=peer && \
    # https://github.com/defenseunicorns/pepr/issues/2747
    npm i --no-save --omit=dev --omit=peer ws && \
    npm cache clean --force && \
    # Remove @types
    rm -rf node_modules/@types && \
    # Remove unused dependencies in the controller image, usually needed by Pepr CLI
    rm -rf node_modules/ramda/dist && \
    rm -rf node_modules/ramda/es && \
    rm -rf node_modules/esbuild && \
    rm -rf node_modules/@esbuild && \
    rm -rf node_modules/fast-glob && \
    rm -rf node_modules/.bin/esbuild && \
    rm -rf node_modules/quicktype-core && \
    rm -rf node_modules/commander && \
    rm -rf node_modules/@npmcli && \
    rm -rf node_modules/@pkgjs && \
    rm -rf node_modules/@glideapps && \
    rm -rf node_modules/@jsep-plugin && \
    rm -rf node_modules/@sigstore && \
    rm -rf node_modules/benchmarks && \
    rm -rf node_modules/bare-* && \
    rm -rf node_modules/bin-links && \
    rm -rf node_modules/cacache && \
    rm -rf patches && \
    find . -name "*.ts" -type f -delete && \
    mkdir node_modules/pepr && \
    cp -r dist node_modules/pepr/dist && \
    cp package.json node_modules/pepr
##### DELIVER #####

FROM base-image

WORKDIR /app

COPY --from=build --chown=65532:65532 /app/node_modules/ ./node_modules/
USER 65532
