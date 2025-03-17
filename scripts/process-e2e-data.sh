#!/bin/bash

# Ensure at least one directory argument is provided
if [ "$#" -lt 1 ]; then
    echo "This script processes a directory that contains log files from E2E CI runs."
    echo
    echo "Usage: $0 <log_directory1> [log_directory2] ..."
    exit 1
fi

# Initialize JSON output
echo "["

first_dir=true

# Iterate over each provided directory
for log_dir in "$@"; do
    if [[ ! -d "$log_dir" ]]; then
        # "Skipping '$log_dir': Not a directory or does not exist." >&2
        continue
    fi

    # Track first entry for correct JSON formatting
    if [ "$first_dir" = true ]; then
        first_dir=false
    else
        echo ","
    fi

    echo "  {"
    echo "    \"directory\": \"$log_dir\","
    echo "    \"jobs\": ["

    first_entry=true
    
    # Find log files in the directory matching the naming pattern
    for job in "$log_dir"/[0-9]-*.log "$log_dir"/[0-9][0-9]-*.log; do
        if [[ -f "$job" ]]; then
            # Check if the file contains "Run nick-fields/retry", if not, skip this file
            if ! grep -q "Run nick-fields/retry" "$job"; then
                # "Skipping '$job' (no 'Run nick-fields/retry' found)."
                continue
            fi
    
            # Count total runs
            LOGGED_ATTEMPT_TOTAL=$(grep -c "Command completed after [0-9] attempt" "$job")
            LOGGED_ATTEMPT_COUNT=$(grep -c "Attempt [0-9]$" "$job")

            # Ensure default value of 0 if grep returns nothing
            LOGGED_ATTEMPT_TOTAL=${LOGGED_ATTEMPT_TOTAL:-0}
            LOGGED_ATTEMPT_COUNT=${LOGGED_ATTEMPT_COUNT:-0}
            TOTAL_RUNS=$(( LOGGED_ATTEMPT_TOTAL + LOGGED_ATTEMPT_COUNT ))
    
            # Count retry attempts (strip leading spaces)
            ATTEMPT_FAILURE_COUNT=$(grep -c "Attempt [0-9] failed" "$job")
            FINAL_ATTEMPT_FAILURE_COUNT=$(grep -c "Final attempt failed" "$job")
            TEST_FAIL_COUNT=$(grep -c -E 'Tests:\s+[0-9]+ failed,' "$job")

            # Ensure default value of 0 if grep returns nothing
            ATTEMPT_FAILURE_COUNT=${ATTEMPT_FAILURE_COUNT:-0}
            FINAL_ATTEMPT_FAILURE_COUNT=${FINAL_ATTEMPT_FAILURE_COUNT:-0}
            TEST_FAIL_COUNT=${TEST_FAIL_COUNT:-0}

            # Sum the counts safely
            FAILURE_COUNT=$(( ATTEMPT_FAILURE_COUNT + FINAL_ATTEMPT_FAILURE_COUNT + TEST_FAIL_COUNT ))
            if [[ $FAILURE_COUNT -gt 3 ]]; then
                FAILURE_COUNT=3
            fi
    
            # Compute failure rate (percentage)
            if [[ $TOTAL_RUNS -gt 0 ]]; then
                FAILURE_RATE=$(awk "BEGIN {printf \"%.2f\", ($FAILURE_COUNT / $TOTAL_RUNS) * 100}")
            else
                FAILURE_RATE="0.00"
            fi
    
            # Handle JSON formatting (avoid trailing commas)
            if [ "$first_entry" = true ]; then
                first_entry=false
            else
                echo ","
            fi
    
            # Print JSON object
            echo "  {"
            echo "    \"job_name\": \"$(basename "$job")\","
            echo "    \"total_runs\": $TOTAL_RUNS,"
            echo "    \"logged_attempt_total\": $LOGGED_ATTEMPT_TOTAL,"
            echo "    \"logged_attempt_count\": $LOGGED_ATTEMPT_COUNT,"
            echo "    \"failures\": $FAILURE_COUNT,"
            echo "    \"test_failure_count\": $TEST_FAIL_COUNT,"
            echo "    \"attempt_failure_count\": $ATTEMPT_FAILURE_COUNT,"
            echo "    \"final_attempt_failure_count\": $FINAL_ATTEMPT_FAILURE_COUNT,"
            echo "    \"failure_rate\": $FAILURE_RATE"
            echo "  }"
        fi
    done

    echo
    echo "    ]"
    echo "  }"
done

# Close JSON array
echo "]"
