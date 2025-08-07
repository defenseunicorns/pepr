### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

ARG BUILD_IMAGE=docker.io/library/node@sha256:37c7b4cd8867313fc17ba76c1a6676414c61e2aac113694072bb8e3ef6d0a4c8
ARG BASE_IMAGE=docker.io/library/node@sha256:e8e882c692a08878d55ec8ff6c5a4a71b3edca25eda0af4406e2a160d8a93cf2

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
    npm cache clean --force && \
    # Remove @types
    rm -rf node_modules/@types && \
    # Remove Ramda unused Ramda files and esbuild
    rm -rf node_modules/ramda/dist && \
    rm -rf node_modules/ramda/es && \ 
    rm -rf node_modules/esbuild && \
    rm -rf node_modules/@esbuild && \
    rm -rf node_modules/.bin/esbuild && \
    find . -name "*.ts" -type f -delete && \
    mkdir node_modules/pepr && \
    cp -r dist node_modules/pepr/dist && \
    cp package.json node_modules/pepr

##### DELIVER #####

FROM ${BASE_IMAGE}

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
