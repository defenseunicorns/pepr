### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

FROM cgr.dev/du-uds-defenseunicorns/node:22.14.0@sha256:b1240ac4f77e28349febd9dfa0a7176d459688a4bd2df98ef0160a80e6e78e33 AS build

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
FROM cgr.dev/du-uds-defenseunicorns/node:22.14.0-slim@sha256:9ac4adb34641d76753c39798916877f2038b7618450ca25609aec67d18a7ac68

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
