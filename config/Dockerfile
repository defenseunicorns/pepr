### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

FROM cgr.dev/du-uds-defenseunicorns/node:22.14.0@sha256:8a479a5574085bee6c003cb6ba56b73901cf4240c1496ac06b32012f464e52ba AS build

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
FROM cgr.dev/du-uds-defenseunicorns/node:22.14.0-slim@sha256:05560c42afabb42619062315fda5cd7dcbb009f629e45825720f52188d526af5

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
