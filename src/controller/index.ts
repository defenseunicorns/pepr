// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import bodyParser from "body-parser";
import express from "express";
import fs from "fs";
import https from "https";

const app = express();
const port = 3000;

// Load SSL certificate and key
const options = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || "/etc/certs/tls.key"),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || "/etc/certs/tls.crt"),
};

// Middleware for logging requests
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const now = new Date().toISOString();
    const elapsedTime = Date.now() - startTime;
    const message = `[${now}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${elapsedTime} ms\n`;

    res.statusCode >= 400 ? console.error(message) : console.info(message);
  });
  next();
});

app.use(bodyParser.json());

// Example route
app.get("/healthz", (req, res) => {
  try {
    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/mutate", (req, res) => {
  try {
    const name = req.body?.request?.name || "";
    const namespace = req.body?.request?.namespace || "";
    const gvk = req.body?.request?.kind || { group: "", version: "", kind: "" };

    console.log(`Mutate request: ${gvk.group}/${gvk.version}/${gvk.kind}`);
    name && console.log(`                ${namespace}/${name}\n`);

    // Send a no prob bob response
    res.send({
      apiVersion: "admission.k8s.io/v1",
      kind: "AdmissionReview",
      response: {
        uid: req.body.request.uid,
        allowed: true,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// Create HTTPS server
https.createServer(options, app).listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
