import os
import sys
import json
import re

def print_usage():
    """Prints usage instructions and exits."""
    print("This script processes directories containing log files from E2E CI runs.")
    print("\nUsage: python process_e2e_data.py <log_directory1> [log_directory2] ...")
    sys.exit(1)

def validate_directory(log_dir):
    """Checks if a given directory exists."""
    return os.path.isdir(log_dir)

def compute_failure_rate(failure_count, total_runs):
    """Calculates the failure rate as a percentage."""
    return round((failure_count / total_runs) * 100, 2) if total_runs > 0 else 0.00

def process_log_file(job):
    """Processes a single log file and extracts relevant metrics."""
    if not os.path.isfile(job):
        return None

    with open(job, 'r', encoding='utf-8') as file:
        content = file.read()

    if "Run nick-fields/retry" not in content:
        return {
            "job_name": os.path.basename(job),
            "total_runs": 0,
            "logged_attempt_total": 0,
            "logged_attempt_count": 0,
            "failures": 0,
            "test_failure_count": 0,
            "attempt_failure_count": 0,
            "final_attempt_failure_count": 0,
            "failure_rate": 0
        }

    # Extracting relevant metrics using regex
    logged_attempt_total = len(re.findall(r"Command completed after \d+ attempt", content))
    logged_attempt_count = len(re.findall(r"Attempt \d+$", content, re.MULTILINE))
    total_runs = logged_attempt_total + logged_attempt_count

    attempt_failure_count = len(re.findall(r"Attempt \d+ failed", content))
    final_attempt_failure_count = len(re.findall(r"Final attempt failed", content))
    test_fail_count = len(re.findall(r"Tests:\s+\d+ failed,", content))

    failure_count = min(attempt_failure_count + final_attempt_failure_count + test_fail_count, 3) # Retry is capped at 3, kludge for multiple valid failure-strings
    failure_rate = compute_failure_rate(failure_count, total_runs)

    return {
        "job_name": re.sub(r"^\d+-", "", os.path.basename(job)),
        "total_runs": total_runs,
        "logged_attempt_total": logged_attempt_total,
        "logged_attempt_count": logged_attempt_count,
        "failures": failure_count,
        "test_failure_count": test_fail_count,
        "attempt_failure_count": attempt_failure_count,
        "final_attempt_failure_count": final_attempt_failure_count,
        "failure_rate": failure_rate
    }

def process_directory(log_dir):
    """Processes all log files in a directory."""
    jobs = []
    for job in sorted(os.listdir(log_dir)):
        if re.match(r"\d+-.*\.log", job):
            job_data = process_log_file(os.path.join(log_dir, job))
            if job_data:
                jobs.append(job_data)

    return {
        "directory": log_dir,
        "jobs": jobs
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print_usage()

    log_directories = sys.argv[1:]
    data = []

    for log_dir in log_directories:
        if validate_directory(log_dir):
            data.append(process_directory(log_dir))

    print(json.dumps(data, indent=2))