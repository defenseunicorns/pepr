#!/bin/bash

# Display script usage
print_usage() {
    echo "This script processes directories containing log files from E2E CI runs."
    echo
    echo "Usage: $0 <log_directory1> [log_directory2] ..."
    exit 1
}

# Validate if a given directory exists
validate_directory() {
    local log_dir=$1
    [[ -d "$log_dir" ]] || return 1
}

# Compute failure rate
compute_failure_rate() {
    local failure_count=$1
    local total_runs=$2

    if [[ $total_runs -gt 0 ]]; then
        awk "BEGIN {printf \"%.2f\", ($failure_count / $total_runs) * 100}"
    else
        echo "0.00"
    fi
}

# Process a single log file
process_log_file() {
    local job=$1
    local first_entry=$2

    # Extract relevant metrics
    local logged_attempt_total
    logged_attempt_total=$(grep -c "Command completed after [0-9] attempt" "$job")
    local logged_attempt_count
    logged_attempt_count=$(grep -c "Attempt [0-9]$" "$job")
    local attempt_failure_count
    attempt_failure_count=$(grep -c "Attempt [0-9] failed" "$job")
    local final_attempt_failure_count
    final_attempt_failure_count=$(grep -c "Final attempt failed" "$job")
    local test_fail_count
    test_fail_count=$(grep -c -E 'Tests:\s+[0-9]+ failed,' "$job")

    # Default values if grep finds nothing
    logged_attempt_total=${logged_attempt_total:-0}
    logged_attempt_count=${logged_attempt_count:-0}
    total_runs=$(( logged_attempt_total + logged_attempt_count ))
    attempt_failure_count=${attempt_failure_count:-0}
    final_attempt_failure_count=${final_attempt_failure_count:-0}
    test_fail_count=${test_fail_count:-0}

    # Calculate failure count with a max cap of 3
    local failure_count=$(( attempt_failure_count + final_attempt_failure_count + test_fail_count ))
    (( failure_count > 3 )) && failure_count=3

    # Compute failure rate
    local failure_rate
    failure_rate=$(compute_failure_rate "$failure_count" "$total_runs")

    # Print JSON object
    print_json_entry "$first_entry" "$job" "$total_runs" "$logged_attempt_total" "$logged_attempt_count" \
                     "$failure_count" "$test_fail_count" "$attempt_failure_count" "$final_attempt_failure_count" "$failure_rate"
}

# Print JSON entry for a job
print_json_entry() {
    local first_entry=$1
    shift
    local job_name
    job_name=$(basename "$1")
    local total_runs=$2
    local logged_attempt_total=$3
    local logged_attempt_count=$4
    local failure_count=$5
    local test_fail_count=$6
    local attempt_failure_count=$7
    local final_attempt_failure_count=$8
    local failure_rate=$9

    [[ "$first_entry" == false ]] && echo ","

    echo "  {"
    echo "    \"job_name\": \"$job_name\","
    echo "    \"total_runs\": $total_runs,"
    echo "    \"logged_attempt_total\": $logged_attempt_total,"
    echo "    \"logged_attempt_count\": $logged_attempt_count,"
    echo "    \"failures\": $failure_count,"
    echo "    \"test_failure_count\": $test_fail_count,"
    echo "    \"attempt_failure_count\": $attempt_failure_count,"
    echo "    \"final_attempt_failure_count\": $final_attempt_failure_count,"
    echo "    \"failure_rate\": $failure_rate"
    echo "  }"
}

# Process an entire directory of log files
process_directory() {
    local log_dir=$1
    local first_entry=true

    echo "  {"
    echo "    \"directory\": \"$log_dir\","
    echo "    \"jobs\": ["

    for job in "$log_dir"/[0-9]-*.log "$log_dir"/[0-9][0-9]-*.log; do
        process_log_file "$job" "$first_entry" && first_entry=false
    done

    echo "    ]"
    echo "  }"
}

# Ensure at least one directory argument is provided
if [ "$#" -lt 1 ]; then
    print_usage
fi

# Initialize JSON output
echo "["

first_dir=true

# Iterate over each provided directory
for log_dir in "$@"; do
    if validate_directory "$log_dir"; then
        [[ "$first_dir" == false ]] && echo ","
        first_dir=false
        process_directory "$log_dir"
    fi
done

# Close JSON array
echo "]"
