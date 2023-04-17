# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install the dependencies in production mode
RUN npm ci --omit=dev

# Sync the pepr dist files
COPY --chown=node:node ./dist/  ./node_modules/pepr/dist/
COPY --chown=node:node ./package.json  ./node_modules/pepr/package.json
