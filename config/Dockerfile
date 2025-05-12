### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

FROM cgr.dev/du-uds-defenseunicorns/node-fips:22.15.0@sha256:886cb29e11b35f89448cd859371cc321d96fd773978e629ce8ed7f6333df8cc8 AS build

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
FROM cgr.dev/du-uds-defenseunicorns/node-fips:22.15.0-slim@sha256:80f43f7a53733029448de10ab810a1669e1feeb3fa5f34eb64a7d75e476afd45

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
