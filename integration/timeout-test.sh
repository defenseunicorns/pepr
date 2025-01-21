#!/bin/bash
# Run this command from the `integration` directory of Pepr, or update pathing in the script

# Loop to run the command 30 times
for i in $(seq 1 30); do
  # Format the output file name with the iteration number
  OUTPUT_FILE="timeout-logs/${i}.json"

  # Run the jest command with the specified options and output file
  echo "Running iteration $i..."
  # ./prep.sh && jest --maxWorkers=4 --json --outputFile=$OUTPUT_FILE cli/
  ./prep.ts && jest --maxWorkers=4 --json --outputFile=$OUTPUT_FILE cli/

  # Check if the command was successful
  if [ $? -ne 0 ]; then
    echo "Iteration $i failed."
  fi

done

# Completion message
echo "All 30 iterations completed."
