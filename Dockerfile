### BUILD ###

# NOTE:
# Used to build Controller image
# In this file, we delete the *.ts intentionally
# Any other changes to Dockerfile should be reflected in Publish

# crane digest cgr.dev/chainguard/node-lts:latest-dev
# cgr.dev/chainguard/node:latest-dev@sha256:96260affdd273eb612d5fa031b8230cde59e06e21cdaf67f85a8f6399abd889a
FROM docker.io/library/node@sha256:d66063b725449eb6b8667f356d12524acce6f449fb9a3e61bad701692cdbf578 AS build

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
# cgr.dev/chainguard/node:latest@sha256:f771505c29d1f766c1dc4d3b2ed0f8660a76553685b9d886728bc55d6f430ce8
# gcr.io/distroless/nodejs22-debian12@sha256:d00edbf864c5b989f1b69951a13c5c902bf369cca572de59b5ec972552848e33
FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:894873fc72ea5731e38cf3cfa75a6a3b1985a9330e46bb4d81162e6a184f212e

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules/ ./node_modules/
