// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { version } from "../../package.json";
import build from "./build";
import capability from "./capability";
import init from "./init";
import { RootCmd } from "./root";
import test from "./test";

const program = new RootCmd();

program.version(version);

init(program);
build(program);
capability(program);
test(program);

program.parse();
