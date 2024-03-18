# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Pepr, please report it to us by sending an email to [pepr@defenseunicorns.com](mailto:pepr@defenseunicorns.com?subject=Vulnerability) or directly through the [GitHub UI](https://github.com/defenseunicorns/pepr/security/advisories/new).

Please include the following details in your report:

- A clear description of the vulnerability
- Steps to reproduce the vulnerability
- Any additional information that may be helpful in understanding and fixing the issue

We appreciate your help in making Pepr more secure and will acknowledge your contribution in the remediation PR.

## Security Best Practices

To enhance the security of your Pepr Controller, we recommend following these best practices:

- Regularly update Pepr to the latest stable release.
- Secure Pepr through RBAC building in [scoped mode](https://docs.pepr.dev/main/user-guide/rbac/#scoped) taking into account access to the Kubernetes API server needed in the callbacks.
- Practice the principle of least privilege when assigning roles and permissions and avoid giving the service account more permissions than necessary.
- Use NetworkPolicy to restrict traffic from Pepr Controllers to the minimum required.
- Limit calls from Pepr to the Kubernetes API server to the minimum required.

By following these best practices, you can help protect your Pepr Controller from potential security threats.

## Contact

If you have any questions or concerns regarding the security of Pepr, please contact us at pepr@defenseunicorns.com.
