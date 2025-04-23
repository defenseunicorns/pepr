%title: Measuring Mayhem: A data-driven approach to CI stability in Pepr
%author: Sam Mayer, Defense Unicorns
%date: 2025-04-09

# tl;dr

> **Rule 2.** Measure. 
> Don't tune for speed until you've measured,
>  and even then don't unless one part of the code overwhelms the rest.

- [Rob Pike's Rules of Programming](https://users.ece.utexas.edu/~adnan/pike.html)

-------------------------------------------------

# Learning Objectives

- State the difference between test-level failures and workflow-level failures.
- Identify how failures at test and workflow levels impact debugging.
- Summarize how GitHub CLI and Python scripting can analyze test failures within CI/CD.

-------------------------------------------------

# What was the Problem?

A small amount of flaky tests snowballed into outsized frustrations for developers.

[E2E - Pepr Excellent Examples](https://github.com/defenseunicorns/pepr/actions/runs/14586396962) in GitHub Actions

-------------------------------------------------

# Why Didn't We Have Enough Information?

1. Tests usually passed when re-ran.
2. Use of [nick-fields/retry](https://github.com/nick-fields/retry) concealed true scope of problem.
3. Other priorities at the time.

-------------------------------------------------

# How Did We Understand the Problem?

1. Download logs 
2. Get workflow ID of "E2E - Pepr Excellent Examples"
3. Given a workflow ID, get run IDs within the past ` N ` days
4. Process the log file for failure messages
5. Produce a JSON entry for each log file
6. Chart it!

-------------------------------------------------

# The Shape of the Metadata

```JSON
{
  "job_name": string,
  "total_runs": integer,
  "failures": integer,
  "test_failure_count": integer,
  "failure_rate": float
  // Other fields omitted
}
```

-------------------------------------------------

# Data Visualization

[Histogram of Failures by Job Name](https://github.com/defenseunicorns/pepr/issues/1872#issuecomment-2730721497)
[Stacked Histogram of Failure Types by Job Name](https://github.com/defenseunicorns/pepr/issues/1872#issuecomment-2730721497)

-------------------------------------------------

# Lessons Learned


The real impact on developer experience is now quantified:

* Over a 30 day period we see a 1% test failure rate (150 of 11,150 tests).
* In practice, it feels like a 16% failure rate (65 of 406 workflows).
* Agentic coding workflow success story (BASH -> Python)

-------------------------------------------------

# Future Work

* Resolve flaky tests
    * [pepr/#1953](https://github.com/defenseunicorns/pepr/issues/1953)
    * [pepr/#1954](https://github.com/defenseunicorns/pepr/issues/1954)
    * [pepr/#1955](https://github.com/defenseunicorns/pepr/issues/1955)
    * [pepr/#1956](https://github.com/defenseunicorns/pepr/issues/1956)
* Better CI performance monitoring (grafana, gitboard, others?)
* Share scripts?

-------------------------------------------------

# Learning Objectives

- State the difference between test-level failures and workflow-level failures.
- Identify how failures at test and workflow levels impact debugging.
- Summarize how GitHub CLI and Python scripting can analyze test failures within CI/CD.
