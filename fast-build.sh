#!/bin/bash

rm -rf kfc/src
rm -rf kfc/dist

cp -R ~/kubernetes-fluent-client/src kfc/src
cp -R ~/kubernetes-fluent-client/dist kfc/dist
rm -rf node_modules/kubernetes-fluent-client/src
rm -rf node_modules/kubernetes-fluent-client/dist
cp -R ~/kubernetes-fluent-client/src node_modules/kubernetes-fluent-client/src
cp -R ~/kubernetes-fluent-client/dist node_modules/kubernetes-fluent-client/dist
npm run build:image
