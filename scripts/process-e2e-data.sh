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
        echo "Skipping '$log_dir': Not a directory or does not exist." >&2
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
    echo "At: $log_dir"
    for job in "$log_dir"/[0-9]-*.log "$log_dir"/[0-9][0-9]-*.log; do
        echo "At: $log_dir"
        echo "Processing: $job"
        echo "at $job"
        if [[ -f "$job" ]]; then
            # Check if the file contains "Run nick-fields/retry", if not, skip this file
            if ! grep -q "Run nick-fields/retry" "$job"; then
                # "Skipping '$job' (no 'Run nick-fields/retry' found)."
                continue
            fi
    
            # Count total runs
            TOTAL_RUNS=$(grep -c "Attempt [0-9]$" "$job")
    
            # Count retry attempts (strip leading spaces)
            FAILURE_COUNT=$(grep -c "Attempt [0-9] failed" "$job")
    
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
            echo "    \"failures\": $FAILURE_COUNT,"
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
