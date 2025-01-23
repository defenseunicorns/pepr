#!/bin/bash

for file in $(grep -rl '"success":\s*false' timeout-logs); do
    failureMessages=$(jq '.testResults[] | select(.status == "failed") | .assertionResults[] | select(.status == "failed") | .failureMessages' $file)
    echo "Failure for $file:" >> failure-details.log
    echo $failureMessages  >> failure-details.log
    echo "-------------------------" >> failure-details.log
done