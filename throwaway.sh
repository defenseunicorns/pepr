#!/bin/bash
# Arrange
# Use dev version

set -euo pipefail

pwd
rm -rf 1713/
npm run build &&
npx pepr init --name 1713 --description "1713 test" --skip-post-init --confirm &&
jq '.dependencies.pepr = "file://Users/sam/code/work/pepr/pepr-0.0.0-development.tgz"' 1713/package.json > 1713/package.temp.json && 
mv 1713/package.temp.json 1713/package.json

# Check setup
if [ $(jq '.dependencies.pepr' 1713/package.json) == "\"file://Users/sam/code/work/pepr/pepr-0.0.0-development.tgz\"" ]; then
  echo "Replace success"
else
  echo "Replace Fail"
  exit 1
fi

# Act
cd 1713 &&
npm i &&
npx pepr build &&
cd ..

# Assert
file=$(echo 1713/dist/*-chart/values.yaml)

if [[ $(yq '.namespace.labels' $file) == "pepr.dev: 'asdf'" ]]; then
  echo "SUCCESS - Namespace"
else
  echo "FAIL - Namespace"
  yq '.namespace.labels' 1713/dist/*-chart/values.yaml
  exit 1
fi