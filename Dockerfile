### BUILD ###

ARG PEPR_BUILD_VERSION=0.0.0-development

# crane digest cgr.dev/chainguard/node-lts:latest-dev
FROM cgr.dev/chainguard/node-lts@sha256:49163a9f8b52f3ad9e842a16ccf0d7fa673571a272762f6483e38b90ba83985f AS build

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

RUN npm --no-git-tag-version version ${PEPR_BUILD_VERSION}

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
FROM cgr.dev/chainguard/node-lts@sha256:64578d895b168f20737413ac56a14cefd63663691611f8af5020e8bc8de53f82

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
