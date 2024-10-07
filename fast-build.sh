#!/bin/bash

rm -rf kfc/src
rm -rf kfc/dist

cp -R ~/not-pepr/kubernetes-fluent-client/src kfc/src
cp -R ~/not-pepr/kubernetes-fluent-client/dist kfc/dist
npm run build:image
