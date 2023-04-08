// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import bodyParser from 'body-parser';
import express from "express";
import fs from "fs";
import https from "https";
import { Log } from "pepr";

const app = express();
const port = 3000;

// Load SSL certificate and key
const options = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || "/etc/certs/tls.key"),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || "/etc/certs/tls.crt"),
};

app.use(bodyParser.json());

// Example route
app.get("/healthz", (req, res) => {
  Log.info(`Health check from ${req.ip}`)
  res.send("OK");
});


app.post("/mutate", (req, res) => {
  Log.info(`Mutate request from ${req.ip}`)
  Log.debug(req.body)
  res.send("OK");
});

// Create HTTPS server
https.createServer(options, app).listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
