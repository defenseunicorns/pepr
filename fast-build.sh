#!/bin/bash

rm -rf kfc/src
rm -rf kfc/dist

cp -R ~/not-pepr/kubernetes-fluent-client/src kfc/src
cp -R ~/not-pepr/kubernetes-fluent-client/dist kfc/dist
rm -rf node_modules/kubernetes-fluent-client/src
rm -rf node_modules/kubernetes-fluent-client/dist
cp -R kfc/src node_modules/kubernetes-fluent-client/src
cp -R kfc/dist node_modules/kubernetes-fluent-client/dist
npm run build:image
