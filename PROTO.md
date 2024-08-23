Generate

```bash
npx grpc_tools_node_protoc \
  --js_out=import_style=commonjs,binary:./src/generated \
  --grpc_out=grpc_js:./src/generated \
  --plugin=protoc-gen-grpc=$(which grpc_tools_node_protoc_plugin) \
  --ts_out=service=grpc-node,mode=grpc-js:./src/generated \
  -I ./src/api ./src/api/apiv1.proto
```
