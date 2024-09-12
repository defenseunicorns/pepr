### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish


# crane digest cgr.dev/chainguard/node-lts:latest-dev
FROM cgr.dev/chainguard/node:latest-dev@sha256:0a7847d55e5837d4fd78cf1171ce09911e6b0a851bad27f44b8594ec101df9b6 AS build

ENV HUSKY=0
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
FROM cgr.dev/chainguard/node:latest@sha256:5851789a8c729131e0aacc5943186f5b982d66b9dff4123a136a4c2fd44c782e

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
