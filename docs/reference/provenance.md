# Pepr Release Provenance

Current Pepr releases publish provenance for the npm package. Consumers can use
it to verify the package's source repository, workflow, commit, and digest.

## Scope

This guidance applies to the `pepr-<version>.tgz` npm package. It does not cover
Pepr container images, source archives, or other release artifacts.

Pepr publishes two records for the package:

| Record | Subject | Digest | Verify with |
| --- | --- | --- | --- |
| GitHub Artifact Attestation | `pepr-<version>.tgz` | SHA-256 | `gh attestation verify` |
| npm provenance | `pkg:npm/pepr@<version>` | SHA-512 | `npm audit signatures` |

The subject names and digest algorithms differ, but both records identify the
same published package bytes.

## Verify a Release

Always verify an explicit version instead of a mutable tag such as `latest`.
These examples require recent versions of the GitHub CLI, npm, and `jq`.

Download the package and verify its GitHub attestation:

```bash
version="2.0.2"
artifact=$(npm pack "pepr@$version" --json | jq -r '.[0].filename')

gh attestation verify "$artifact" \
  --repo defenseunicorns/pepr \
  --signer-workflow defenseunicorns/pepr/.github/workflows/release.yml
```

The command fails if the file's digest has no valid attestation from the
expected repository and workflow.

To inspect the provenance details:

```bash
gh attestation verify "$artifact" \
  --repo defenseunicorns/pepr \
  --format json \
  --jq '.[].verificationResult | {
    subject: .statement.subject,
    predicateType: .statement.predicateType,
    certificate: .signature.certificate,
    provenance: .statement.predicate,
    timestamps: .verifiedTimestamps
  }'
```

In a project where Pepr is installed and recorded in the package lock, verify
the npm registry signature and provenance with:

```bash
npm audit signatures
```

Use `npm audit signatures --json --include-attestations` to inspect the full
verified Sigstore bundles.

## Understand the Result

The verified fields answer different questions about the package:

| Field | Expected value | Meaning |
| --- | --- | --- |
| Subject | The downloaded tarball's name and digest | Identifies the exact bytes covered by the attestation |
| Source repository | `defenseunicorns/pepr` | Identifies the source repository used by the build |
| Signer workflow | `defenseunicorns/pepr/.github/workflows/release.yml` | Identifies the workflow that issued the attestation |
| Source commit | The commit for the selected release tag | Identifies the source revision used by the build |
| Builder, ref, and event | GitHub-hosted runner, `refs/heads/main`, and `push` | Describes the expected release context |

Verification proves that the attestation is authentic and covers the downloaded
bytes. Consumers must still decide whether the repository, workflow, commit,
and build context satisfy their policy. A valid signature from an unexpected
workflow should not be accepted as a Pepr release.

> [!CAUTION]
> Provenance links an artifact to its source and build instructions. It does not
> prove that the artifact is free of vulnerabilities or malicious code.

## SLSA Assurance

The `https://slsa.dev/provenance/v1` predicate identifies the provenance
format. The `v1` in that URL is a schema version, not a SLSA Build level.

Pepr's npm tarball has signed provenance generated on a GitHub-hosted runner.
GitHub classifies this standard Artifact Attestation model as SLSA v1.0 Build
Level 2. It protects against undetected changes after the build and provides a
verifiable link to the source and build instructions.

Pepr does not currently claim Build Level 3 for this artifact. Build Level 3 is
an additional property of the build platform's isolation and resistance to
tampering during the build; it cannot be inferred from the predicate format or
a successful verification result.

## How Pepr Preserves Artifact Identity

Pepr's release workflow maintains one package identity across jobs:

1. The `slsa` job builds one npm tarball and records its SHA-256 digest.
2. The attestation job downloads the tarball, checks that digest, and attests
   the verified file with `actions/attest`.
3. The publish job downloads the same tarball, checks the same digest, and
   publishes that file through npm trusted publishing.
4. The provenance verification job downloads the published version from npm,
   compares its digest with the build output, verifies its GitHub attestation,
   and runs `npm audit signatures`.
5. The OCI package job repeats the digest check before pushing the tarball to
   the downstream registry.

This prevents later jobs from silently rebuilding or substituting the package.
npm trusted publishing adds the npm provenance record, while `actions/attest`
adds the separate GitHub Artifact Attestation.

Release workflow changes must preserve these properties:

- Build the npm tarball once and use the same file for attestation and
  publication.
- Record its digest after the build and verify it after each cross-job transfer.
- Do not rebuild or modify the package after attestation.
- Publish the verified tarball path rather than running another pack or build.
- Limit OIDC and attestation permissions to the jobs that need them.
- Keep third-party actions pinned and retain npm trusted publishing.
- Treat the repository, signer workflow, subject name, and release trigger as
  part of the public verification contract.

The provenance verification job runs after npm publication and in parallel with
the OCI package and controller image jobs. Its failure marks the release
workflow unsuccessful but cannot undo a completed npm publication.

## Historical Releases

| Release | npm provenance | GitHub Artifact Attestation |
| --- | --- | --- |
| `2.0.0` | SLSA provenance v0.2 from the former SLSA GitHub generator | Not available through the Pepr repository attestation API |
| `2.0.2` | SLSA provenance v1 from npm trusted publishing | SLSA provenance v1 for the npm tarball |

A missing GitHub attestation for an older release does not mean that npm
provenance is also missing. Release `2.0.2` is the baseline for the current
two-record verification process.

## References

- [GitHub Artifact Attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [GitHub guidance for SLSA Build Level 3](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/increase-security-rating)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements/)
- [npm signature verification](https://docs.npmjs.com/cli/v11/commands/npm-audit/#audit-signatures)
- [SLSA security levels](https://slsa.dev/spec/v1.2/build-track-basics)
