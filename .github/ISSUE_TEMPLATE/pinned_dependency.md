---
name: Pinned Dependency Remediation 
file: Release Action 
---

### Pinned Dependency Remediation

Under `Security > Code Scanning` there is a [pinned dependency issue](https://github.com/defenseunicorns/pepr/security/code-scanning/97) that needs to be addressed.

[File in question](https://github.com/defenseunicorns/pepr/blob/main/.github/workflows/release.yml)


### How to Remediate
[https://app.stepsecurity.io](https://app.stepsecurity.io/secureworkflow/defenseunicorns/pepr/release.yml/main?enable=pin) can be used to pin the dependencies in the file.

This tells us exactly which version of each dependency is installed at any time, and increases our [OpenSSF Scorecard Score](https://securityscorecards.dev/viewer/?uri=github.com/defenseunicorns/pepr). 

### Definition of Done
- [ ] Update the dependency to be pinned at the version indicated in the dependency issue
- [ ] Update all dependencies in the file that need to be pinned


