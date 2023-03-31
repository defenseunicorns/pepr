// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import express from "express";
import https from "https";
import fs from "fs";

const app = express();
const port = 3000;

// @todo: implement webhook

// Example route
app.get("/", (req, res) => {
  res.send("Hello, world!");
});

// Load SSL certificate and key
const options = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH),
};

// Create HTTPS server
https.createServer(options, app).listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
