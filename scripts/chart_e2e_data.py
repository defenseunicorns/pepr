import json
import pandas as pd
import matplotlib.pyplot as plt
import os

# File paths
LOG_FILE = "/Users/sam.mayer/code/work/pepr/py.log"
OUTPUT_IMAGE = "failures_histogram.png"

def load_failure_data(log_file):
    """Loads job failure data from a JSON file."""
    with open(log_file, "r", encoding="utf-8") as file:
        data = json.load(file)
    
    failures = []
    
    for entry in data:
        for job in entry.get("jobs", []):
            if job["failures"] > 0:
                failures.append((job["job_name"], job["failures"]))

    return failures

def aggregate_failures(failures):
    """Aggregates failures by job name."""
    df = pd.DataFrame(failures, columns=["job_name", "failures"])
    df = df.groupby("job_name", as_index=False).sum()
    df = df.sort_values(by="failures", ascending=False)
    return df

def plot_failures(df, output_path):
    """Generates and saves a histogram of failures."""
    plt.figure(figsize=(10, 6))
    plt.barh(df["job_name"], df["failures"], color="skyblue")
    plt.xticks(rotation=0)
    plt.xlabel("Number of Failures")
    plt.ylabel("Job Name")
    plt.title("Histogram of Failures by Job Name")
    plt.grid(axis="x")

    # Add threshold lines
    mean_failures = int(round(df["failures"].mean()))
    plt.axvline(x=mean_failures, color="red", linestyle="--", label=f"Mean: {mean_failures} Failures")
    median_failures = int(round(df["failures"].median()))
    plt.axvline(x=median_failures, color="green", linestyle="--", label=f"Median: {median_failures} Failures")
    plt.legend()

    plt.tight_layout()
    plt.savefig(output_path)
    print(f"Saved chart as {output_path}")

def main():
    """Main function to process and chart E2E job failures."""
    if not os.path.exists(LOG_FILE):
        print(f"Error: Log file {LOG_FILE} not found.")
        return

    failures = load_failure_data(LOG_FILE)
    
    if not failures:
        print("No failures found.")
        return

    df = aggregate_failures(failures)
    plot_failures(df, OUTPUT_IMAGE)

if __name__ == "__main__":
    main()