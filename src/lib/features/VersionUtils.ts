// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * Parse a semantic version string into its components
 *
 * @param version The version string in semver format (e.g., "1.2.3" or "1.2.3-alpha.1")
 * @returns Object containing parsed version parts and prerelease information
 */
export function parseVersion(version: string): { parts: number[]; prerelease: string | null } {
  const [versionPart, prereleasePart] = version.split("-");
  return {
    parts: versionPart.split(".").map(Number),
    prerelease: prereleasePart || null,
  };
}

/**
 * Compare two semantic versions
 *
 * @param v1 First version
 * @param v2 Second version
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(
  v1: { parts: number[]; prerelease: string | null },
  v2: { parts: number[]; prerelease: string | null },
): number {
  // Compare major.minor.patch
  for (let i = 0; i < 3; i++) {
    if (v1.parts[i] !== v2.parts[i]) {
      return v1.parts[i] > v2.parts[i] ? 1 : -1;
    }
  }

  // If major.minor.patch are equal, check prerelease
  // No prerelease is greater than any prerelease version
  if (v1.prerelease === null && v2.prerelease !== null) return 1;
  if (v1.prerelease !== null && v2.prerelease === null) return -1;
  if (v1.prerelease === v2.prerelease) return 0;

  // Both have prerelease, lexically compare them
  return v1.prerelease! < v2.prerelease! ? -1 : 1;
}

/**
 * Check if a version is within a specified range
 *
 * @param version Current version to check
 * @param minVersion Minimum required version (inclusive)
 * @param maxVersion Maximum allowed version (inclusive), or null if no upper bound
 * @returns boolean indicating if version is within range
 */
export function isVersionInRange(
  version: string,
  minVersion: string,
  maxVersion: string | null,
): boolean {
  const currentV = parseVersion(version);
  const sinceV = parseVersion(minVersion);

  // Check if current version is at least the minimum version
  const isSinceConditionMet = compareVersions(currentV, sinceV) >= 0;

  // Check upper bound if it exists
  if (maxVersion) {
    const untilV = parseVersion(maxVersion);
    // Version is in range if since condition is met AND current is less than or equal to until
    return isSinceConditionMet && compareVersions(currentV, untilV) <= 0;
  }

  // If no upper bound, version is in range if it's at least the minimum version
  return isSinceConditionMet;
}

/**
 * Validate a semantic version string format
 *
 * @param version The version string to validate
 * @returns boolean indicating if the version is valid
 * @throws Error if version format is invalid
 */
export function validateVersion(version: string): boolean {
  // Validate semver format (x.y.z)
  const semverRegex = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;
  if (!semverRegex.test(version)) {
    throw new Error(`Invalid version format: ${version}. Must be a valid semver in format x.y.z`);
  }
  return true;
}
