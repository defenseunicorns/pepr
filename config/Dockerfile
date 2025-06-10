### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

FROM quay.io/rfcurated/node:22.16.0-jammy-fips-rfcurated@sha256:a21f0def4843c5fb3194be2c21053f48b711dc69eca00f7ed86d0035d9b6342b AS build

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
FROM quay.io/rfcurated/node:22.16.0-jammy-fips-rfcurated@sha256:a21f0def4843c5fb3194be2c21053f48b711dc69eca00f7ed86d0035d9b6342b

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
