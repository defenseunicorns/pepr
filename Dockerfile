### BUILD ###

FROM docker.io/library/node:22-alpine@sha256:9459e243f620fff19380c51497493e91db1454f5a30847efe5bc5e50920748d5 as with-git

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

FROM cgr.dev/chainguard/node-lts@sha256:4648bb408354c1b8bd48ef6d8eb4de6c3386a5cb3b334329ede45ab70b6026c8

WORKDIR /app

COPY --from=with-git --chown=node:node /app/ /app/
