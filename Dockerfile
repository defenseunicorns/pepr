### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

# crane digest cgr.dev/chainguard/node-lts:latest-dev
FROM cgr.dev/chainguard/node-lts@sha256:4db5b44244c45471ae6d94e54a048e28f670d20d2657e32673fd1445df4b2edc AS build

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

# crane digest cgr.dev/chainguard/node-lts:latest
FROM cgr.dev/chainguard/node-lts@sha256:4db5b44244c45471ae6d94e54a048e28f670d20d2657e32673fd1445df4b2edc

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
