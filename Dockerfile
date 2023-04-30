# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18@sha256:ceac7bae5fc7dac9c6c77b0c1eb247ac3f829f17bb15ee7da4fb2b1fa0d5aee6

WORKDIR /app

# Copy the node config files
COPY --chown=node:node ./package*.json ./

# Install the dependencies in production mode
RUN npm ci --omit=dev

# Sync the pepr dist files
COPY --chown=node:node ./dist/  ./node_modules/pepr/dist/
COPY --chown=node:node ./package.json  ./node_modules/pepr/package.json
