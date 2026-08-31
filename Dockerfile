### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish
ARG BUILD_IMAGE=cgr.dev/defenseunicorns.com/node:26-dev@sha256:4e1dcad29bc85fa86c0cdc030eeb906d4001b6d3e0ba52118e4fea81cd8892e5
ARG BASE_IMAGE=cgr.dev/defenseunicorns.com/node:26-slim@sha256:9bd2d0f9c28a797d121b9d4b834c32404bdb5d528382eee73cded2657bfac1c2

FROM ${BUILD_IMAGE} AS build

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
    npm i --no-save ws && \
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

FROM ${BASE_IMAGE}

WORKDIR /app

COPY --from=build --chown=65532:65532 /app/node_modules/ ./node_modules/
USER 65532
