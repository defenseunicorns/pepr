FROM cgr.dev/chainguard/node:18 AS build

WORKDIR /app

# Copy everything except the node_modules
COPY --chown=node:node . .

# Install the dependencies
RUN npm ci

# Build the project
RUN npm run build

# Copy the built files and node_modules into a new image
FROM cgr.dev/chainguard/node:18

ARG VER

WORKDIR /app

# Copy the node config files
COPY --chown=node:node package*.json ./

# Copy the built files from the first image
COPY --chown=node:node --from=build /app/dist/pepr-controller.js ./dist/pepr-controller.js

# Install the dependencies in production mode
RUN npm ci --omit=dev

RUN npm ci pepr@${VER}

# Start the application
CMD [ "dist/pepr-controller.js" ]
