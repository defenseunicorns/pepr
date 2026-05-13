### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

FROM cgr.dev/defenseunicorns.com/node:24-dev@sha256:c8a90ddf682ad194789b95758c7dad4707b9a96c1294d6461ec8059712427e15 AS build

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
FROM cgr.dev/defenseunicorns.com/node:24@sha256:4fcf0cbdc5016c1d2d8d6f2680293d45f1ead4303eb640283a0615c8c03dc6ee


WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
