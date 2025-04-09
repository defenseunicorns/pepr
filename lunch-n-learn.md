%title: Measuring Mayhem: A data-driven approach to CI stability in Pepr
%author: Sam Mayer, Defense Unicorns
%date: 2025-04-09



# tl;dr

> **Rule 2.** Measure. Don't tune for speed until you've measured, and even then don't unless one part of the code overwhelms the rest.

- [Rob Pike's Rules of Programming](https://users.ece.utexas.edu/~adnan/pike.html)



-------------------------------------------------

# Learning Objectives

- Understand the difference between test-level failures and workflow-level failures.
- Understand how their reporting affects debugging efforts.
- Summarize the role of GitHub Actions, GitHub CLI, and Python scripting in analyzing test failures within CI environments.

-------------------------------------------------

# What was the Problem?

Our E2Es treat _any_ failed test as a full workflow failure.

**9/10 passing tests is still a failure.**

A small amount of flaky tests snowballed into outsized frustrations for developers.

-------------------------------------------------

# Why Didn't We Have Enough Information?

Use of [nick-fields/retry](https://github.com/nick-fields/retry) concealed true scope of problem.

Tests usually passed when re-ran

Other priorities at the time

-------------------------------------------------

# How Did We Understand the Problem?

1. Download logs from Github
2. Get workflow ID of "E2E - Pepr Excellent Examples"
3. Given a workflow ID, get run IDs within the past N days
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

* Over a 30 day period we see 11,150 test runs with 150 failures (**1% failure rate**).
* 65 failing workflows out of 406 workflow runs (**16% failure rate**).

* Shell scripts quickly grow out of hand after initial prototype is established
* Agentic workflow success story (Python conversion)

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
