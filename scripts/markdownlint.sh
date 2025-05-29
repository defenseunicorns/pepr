#!/usr/bin/env bash
npm install -D markdownlint-cli > /dev/null 2>&1
markdownlint --fix --ignore adr --ignore integration/testroot --ignore pepr-test-module --ignore pepr-upgrade-test --ignore node_modules "$1"
exit_code=$?
npm uninstall markdownlint-cli > /dev/null 2>&1
exit $exit_code