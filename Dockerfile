FROM cgr.dev/chainguard/node:18 AS build

WORKDIR /app

# Copy everything except the node_modules
COPY --chown=node:node . .

RUN pwd && ls -la

# Install the dependencies
RUN npm ci --no-fund

# Lint the project
RUN npm run lint

# Run the tests
RUN npm test

# Build the project
RUN npm run build

# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18

ARG VER

WORKDIR /app

# Copy the node config files
COPY --chown=node:node package*.json ./

# Copy the built files from the first image
COPY --chown=node:node --from=build /app/dist ./dist

# Install the dependencies in production mode
RUN npm ci --omit=dev --no-fund

RUN npm ci pepr@${VER}

# Start the application
CMD [ "dist/pepr-controller.js" ]
