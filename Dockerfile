### BUILD ###

FROM docker.io/library/node:22-alpine@sha256:94567107148ac59f1eb2ad9b7c1db03f1a1a12d28717b29eda0535aa3bd2f71e as with-git

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

FROM cgr.dev/chainguard/node-lts@sha256:64578d895b168f20737413ac56a14cefd63663691611f8af5020e8bc8de53f82

WORKDIR /app

COPY --from=with-git --chown=node:node /app/ /app/
