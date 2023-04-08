# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18

WORKDIR /app

# Get the new version of pepr
ARG VER

# Copy the node config files
COPY --chown=node:node package*.json ./

# Copy the built files 
COPY --chown=node:node dist/pepr-controller.js ./dist/pepr-controller.js

# Install the dependencies in production mode
RUN npm ci --omit=dev

# Install new version of pepr
RUN npm ci pepr@${VER}

# Start the application
CMD [ "dist/pepr-controller.js" ]
