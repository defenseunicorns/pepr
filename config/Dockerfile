### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

FROM quay.io/rfcurated/node:24.10.0-jammy-fips-rfcurated@sha256:2f765ca38a81f72cb31e9f079431ac8499edcee6c7a1e211acfa21c3b75e5f4d AS build

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
FROM quay.io/rfcurated/node:24.10.0-jammy-fips-rfcurated@sha256:2f765ca38a81f72cb31e9f079431ac8499edcee6c7a1e211acfa21c3b75e5f4d


WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
