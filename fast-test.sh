#!/bin/bash

rm -rf node_modules/kubernetes-fluent-client/src
rm -rf node_modules/kubernetes-fluent-client/dist
cp -r ~/kubernetes-fluent-client/src node_modules/kubernetes-fluent-client/src
cp -r ~/kubernetes-fluent-client/dist node_modules/kubernetes-fluent-client/dist
