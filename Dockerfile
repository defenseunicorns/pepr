### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish
ARG REQUIRE_CHOWN="true"
ARG BUILD_IMAGE=cgr.dev/defenseunicorns.com/node:26-dev@sha256:157c6017890d666a24a6c8eb69458ff53c22e6e2e3209abb19f2c0769ee19bc4
ARG BASE_IMAGE=cgr.dev/defenseunicorns.com/node:26-slim@sha256:4cb99318578b84de496a61a0ec21b98655e85931f6c411d312122ba6de46a794

FROM ${BUILD_IMAGE} AS build

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install deps
RUN npm ci

COPY --chown=node:node ./hack/ ./hack/

COPY --chown=node:node ./build.mjs ./
COPY --chown=node:node ./config/tsconfig.root.json ./config/tsconfig.root.json
COPY --chown=node:node ./src/ ./src/

RUN npm run build && \
    npm ci --omit=dev --omit=peer && \
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
    find . -name "*.ts" -type f -delete && \
    mkdir node_modules/pepr && \
    cp -r dist node_modules/pepr/dist && \
    cp package.json node_modules/pepr

##### DELIVER #####

FROM ${BASE_IMAGE}

WORKDIR /app

ARG REQUIRE_CHOWN="true"
ENV REQUIRE_CHOWN=${REQUIRE_CHOWN}


COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
RUN if [ "$REQUIRE_CHOWN" = "true" ]; then \
      mkdir -p /app && chown -R 65532:65532 /app; \
    fi
USER 65532
