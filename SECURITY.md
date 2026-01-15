# Security Policy

## Security Report

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/defenseunicorns/pepr/badge)](https://securityscorecards.dev/viewer/?uri=github.com/defenseunicorns/pepr)

Pepr strives to achieve and maintain top scores on the [OSSF Scorecard](https://securityscorecards.dev/viewer/?uri=github.com/defenseunicorns/pepr).
Rest assured, Pepr is secure; however, it is possible for users to introduce their own vulnerabilities.

## User Responsibilities

While Pepr itself is designed with security in mind, users can introduce vulnerabilities through insecure dependencies, hardcoded secrets, unscanned container images, excessive permissions, and inadequate testing.
Always audit npm packages, use proper secret management, scan controller images regularly, follow least privilege principles for RBAC, and implement code reviews before deploying to production.

## Reporting a Vulnerability

If you discover a security vulnerability in Pepr, please report it to us by sending an email to [pepr@defenseunicorns.com](mailto:pepr@defenseunicorns.com?subject=Vulnerability) or directly through the [GitHub UI](https://github.com/defenseunicorns/pepr/security/advisories/new).

Please include the following details in your report:

- A clear description of the vulnerability
- Steps to reproduce the vulnerability
- Any additional information that may be helpful in understanding and fixing the issue

We appreciate your help in making Pepr more secure and will acknowledge your contribution in the remediation PR.

## Contact

If you have any questions or concerns regarding the security of Pepr, please contact us at [pepr@defenseunicorns.com](mailto:pepr@defenseunicorns.com).
