### BUILD ###

FROM docker.io/library/node:22-alpine@sha256:9e8f45fc08c709b1fd87baeeed487977f57585f85f3838c01747602cd85a64bb as with-git

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

FROM cgr.dev/chainguard/node-lts@sha256:352823f86cfc66af25faa67f812ba011e96d28fc80b83f017970bf10bb69800e

WORKDIR /app

COPY --from=with-git --chown=node:node /app/ /app/
