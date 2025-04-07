### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

FROM cgr.dev/du-uds-defenseunicorns/node:22.14.0@sha256:9885632c7143541d67f79e1118602065f47de70ae6576bb3fb87c256408da827 AS build

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install deps
RUN npm ci

COPY --chown=node:node ./hack/ ./hack/

COPY --chown=node:node ./tsconfig.json ./build.mjs ./

COPY --chown=node:node ./src/ ./src/

RUN npm run build && \
    npm ci --omit=dev --omit=peer && \
    npm cache clean --force && \
    # Remove @types
    rm -rf node_modules/@types && \
    # Remove Ramda unused Ramda files
    rm -rf node_modules/ramda/dist && \
    rm -rf node_modules/ramda/es && \
    find . -name "*.ts" -type f -delete && \
    mkdir node_modules/pepr && \
    cp -r dist node_modules/pepr/dist && \
    cp package.json node_modules/pepr

##### DELIVER #####
FROM cgr.dev/du-uds-defenseunicorns/node:22.14.0-slim@sha256:d33796a60e7a1a46ebc0b250a5546a86252de67eda595297c6ebaba22ffa82ab

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
