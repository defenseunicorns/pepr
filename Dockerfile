### BUILD ###

FROM docker.io/library/node:20-alpine as with-git

WORKDIR /app

# install git
RUN apk --no-cache add git

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Load only direct dependencies for Production use
RUN npm ci --omit=dev --omit=peer && \
    # Clean up npm cache
    npm cache clean --force && \
    # Remove @types
    rm -fr node_modules/@types && \
    # Remove Ramda unused Ramda files
    rm -fr node_modules/ramda/dist && \
    rm -fr node_modules/ramda/es && \
    # Remove all typescript files
    find . -name "*.ts" -type f -delete

# Sync the pepr dist files
COPY --chown=node:node ./dist/  ./node_modules/pepr/dist/
COPY --chown=node:node ./package.json  ./node_modules/pepr/package.json


##### DELIVER #####

FROM cgr.dev/chainguard/node:20@sha256:f30d39c6980f0a50119f2aa269498307a80c2654928d8e23bb25431b9cbbdc4f

WORKDIR /app

COPY --from=with-git --chown=node:node /app/ /app/