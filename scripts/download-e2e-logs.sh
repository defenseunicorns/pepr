#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Usage function
usage() {
    echo "Usage: $0 -r <owner/repo> -w <workflow_name> [-o <output_directory>]"
    exit 1
}

# Default values
OUTPUT_DIR="logs"

# Parse command-line arguments
while getopts "r:w:o:h" opt; do
    case ${opt} in
        r ) REPO=$OPTARG ;;
        w ) WORKFLOW_NAME=$OPTARG ;;
        o ) OUTPUT_DIR=$OPTARG ;;
        h ) usage ;;
        * ) usage ;;
    esac
done

# Validate required parameters
if [[ -z "$REPO" || -z "$WORKFLOW_NAME" ]]; then
    echo "Error: Repository and workflow name are required."
    usage
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get the workflow ID
WORKFLOW_ID=$(gh workflow list --repo "$REPO" --limit 100 --json name,id | jq -r ".[] | select(.name==\"$WORKFLOW_NAME\") | .id")

if [[ -z "$WORKFLOW_ID" ]]; then
    echo "Error: Workflow '$WORKFLOW_NAME' not found in repository '$REPO'."
    exit 1
fi

echo "Workflow ID for '$WORKFLOW_NAME': $WORKFLOW_ID"

# Get workflow runs from the last 30 days
RUN_IDS=$(gh run list --workflow "$WORKFLOW_ID" --repo "$REPO" --limit 100 --json databaseId,createdAt \
    --jq "map(select(.createdAt >= \"$(date -v-1d -u +"%Y-%m-%dT%H:%M:%SZ")\")) | .[].databaseId")

if [[ -z "$RUN_IDS" ]]; then
    echo "No runs found for the past 30 days."
    exit 0
fi

echo "Downloading logs for runs from the last 30 days..."

# Loop through each run and download logs
for RUN_ID in $RUN_IDS; do

    RUN_DIR="$OUTPUT_DIR/run-$RUN_ID"
    mkdir -p "$RUN_DIR"
    
    echo "Fetching jobs for run ID: $RUN_ID..."
    
    # Get job IDs and names within the run
    JOBS_JSON=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs)
    
    JOB_IDS=$(echo "$JOBS_JSON" | jq -r '.jobs[].databaseId')
    JOB_NAMES=$(echo "$JOBS_JSON" | jq -r '.jobs[].name')
    
    if [[ -z "$JOB_IDS" ]]; then
        echo "No jobs found for run ID: $RUN_ID"
        continue
    fi

    # Loop through each job ID and download its log
    INDEX=0
    for JOB_ID in $JOB_IDS; do
        JOB_NAME=$(echo "$JOB_NAMES" | sed -n "$((INDEX + 1))p" | tr ' ' '_')
        JOB_LOG_FILE="$RUN_DIR/$INDEX-$JOB_NAME.log"
        
        echo "Downloading log for job: $JOB_NAME (ID: $JOB_ID)..."
        
        gh api \
          -H "Accept: application/vnd.github+json" \
          -H "X-GitHub-Api-Version: 2022-11-28" \
          repos/defenseunicorns/pepr/actions/jobs/"$JOB_ID"/logs > "$JOB_LOG_FILE"
        
        echo "Log saved to: $JOB_LOG_FILE"
        INDEX=$((INDEX + 1))
    done



done

echo "All logs downloaded successfully in '$OUTPUT_DIR'."

# Optional: Compress logs
echo "Compressing logs..."
tar -czvf "$OUTPUT_DIR.tar.gz" "$OUTPUT_DIR"
echo "Logs compressed into '$OUTPUT_DIR.tar.gz'."

exit 0