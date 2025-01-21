for file in timeout-logs/*.json; do
    echo "$(jq '.numFailedTests' "$file")" 
done  > extracted_numFailedTests.txt

echo "Freq|# of Failing Tests"
sort extracted_numFailedTests.txt | uniq -c