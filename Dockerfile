# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18@sha256:f91f4dcfd725b9b6251c13b04f1cc90918686c56bf8b0656ad31a7653e37ecf1

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install the dependencies in production mode
RUN npm ci --omit=dev

# Sync the pepr dist files
COPY --chown=node:node ./dist/  ./node_modules/pepr/dist/
COPY --chown=node:node ./package.json  ./node_modules/pepr/package.json
