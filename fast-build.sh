#!/bin/bash

rm -rf kfc/src
rm -rf kfc/dist

cp -R ~/kubernetes-fluent-client/src kfc/src
cp -R ~/kubernetes-fluent-client/dist kfc/dist
npm run build:image
