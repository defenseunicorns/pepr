### BUILD ###

FROM docker.io/library/node:22-alpine@sha256:487dc5d5122d578e13f2231aa4ac0f63068becd921099c4c677c850df93bede8 as with-git

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

FROM cgr.dev/chainguard/node-lts@sha256:a0b51fe161184c9dffcf57b9f5b0ec4c7d58f7ba2c2445a4828ebd104928af2d

WORKDIR /app

COPY --from=with-git --chown=node:node /app/ /app/
