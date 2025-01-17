for file in timeout-logs/*.json; do
    echo "$(jq '.numFailedTests' "$file")" 
done  > extracted_numFailedTests.txt