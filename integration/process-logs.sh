#!/bin/bash

for file in timeout-logs/*.json; do
    echo "$(jq '.numFailedTests' "$file") in $file" 
done  > extracted_numFailedTests.txt

echo "Freq|# of Failing Tests"
sort extracted_numFailedTests.txt | uniq -c

for file in $(grep -rl '"success":\s*false' timeout-logs); do
    failureMessages=$(jq '.testResults[] | select(.status == "failed") | .assertionResults[] | select(.status == "failed") | .failureMessages' $file)
    echo "-------------------------" > failure-details.log
    echo "Failure for $file:" >> failure-details.log
    echo $failureMessages  >> failure-details.log
    echo "-------------------------" >> failure-details.log
done
