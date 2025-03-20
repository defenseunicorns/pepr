#! /bin/bash

echo "Args are:"
echo "$1"

markdownlint --fix --ignore adr --ignore pepr-test-module --ignore pepr-upgrade-test --ignore node_modules "$1"