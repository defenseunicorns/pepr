# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install the dependencies in production mode
RUN npm ci --omit=dev

# Sync the pepr dist files
COPY --chown=node:node ./dist/*.js  ./node_modules/pepr/

# pepr-core.js is the NPM entry point
RUN mv ./node_modules/pepr/pepr-core.js ./node_modules/pepr/index.js
