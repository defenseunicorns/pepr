#!/bin/bash

# Process each .d.ts file
find "./gen/model" -type f -name "*.d.ts" -exec sh -c '
  for file do
    # Remove "V1" or "V2" prefix from any string in the file
    sed -i "" -E "s/[[:<:]]V[12]//g" "$file"
    echo "Updated file: $file"
  done
' sh {} +
