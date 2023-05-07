# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18@sha256:4bedd64861f9ab9a321409966c3ce57dfc0f76367ee7824fd117d9c75a562069

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install the dependencies in production mode
RUN npm ci --omit=dev --omit=peer

# Sync the pepr dist files
COPY --chown=node:node ./dist/  ./node_modules/pepr/dist/
COPY --chown=node:node ./package.json  ./node_modules/pepr/package.json
