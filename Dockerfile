### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

# crane digest cgr.dev/chainguard/node-lts:latest-dev
FROM cgr.dev/chainguard/node:latest-dev@sha256:8a604e50086fdfa5c6298722bdf86bfbffd82e64e3ecc736b133bc0dbcb9d121 AS build

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install deps
RUN npm ci

COPY --chown=node:node ./hack/ ./hack/

COPY --chown=node:node ./tsconfig.json ./build.mjs ./

COPY --chown=node:node ./src/ ./src/
COPY kfc/ ./kfc/
RUN npm run build && \
    npm ci --omit=dev --omit=peer && \
    npm cache clean --force && \
    # Remove @types
    rm -rf node_modules/@types && \
    # Remove Ramda unused Ramda files
    rm -rf node_modules/ramda/dist && \
    rm -rf node_modules/ramda/es && \
    rm -rf node_modules/kubernetes-fluent-client/src && \
    rm -rf node_modules/kubernetes-fluent-client/dist && \
    find . -name "*.ts" -type f -delete && \
    mkdir node_modules/pepr && \
    cp -r dist node_modules/pepr/dist && \
    cp -r kfc/dist node_modules/kubernetes-fluent-client/dist && \
    cp -r kfc/src node_modules/kubernetes-fluent-client/src && \
    cp package.json node_modules/pepr

##### DELIVER #####

# crane digest cgr.dev/chainguard/node-lts:latest
FROM cgr.dev/chainguard/node:latest@sha256:2ec55b47bddaa173fbcd6283d492b10e903da51dc7da12988024829ad0454dd7

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
