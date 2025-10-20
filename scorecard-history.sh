#!/usr/bin/env bash
set -euo pipefail

REPO="github.com/defenseunicorns/pepr"
OUTFILE="scorecard-results.csv"
export GITHUB_AUTH_TOKEN=$(gh auth token)

# CSV header
echo "tag,commit,date,overall_score,Binary-Artifacts,Branch-Protection,CI-Tests,CII-Best-Practices,Code-Review,Contributors,Dangerous-Workflow,Dependency-Update-Tool,Fuzzing,License,Maintained,Packaging,Pinned-Dependencies,SAST,Security-Policy,Signed-Releases,Token-Permissions,Vulnerabilities" > "$OUTFILE"

TAGS=$(git tag --sort=version:refname | grep -E '^v0\.[0-9]+\.0$' | awk -F. '{ if ($2+0 >= 20) print }')
TOTAL=$(echo "$TAGS" | wc -l | tr -d ' ')
COUNT=0

for TAG in $TAGS; do
  COUNT=$((COUNT + 1))
  COMMIT=$(git rev-list -n 1 "$TAG")
  TAG_DATE=$(git log -1 --format=%aI "$TAG")

  echo "[$COUNT/$TOTAL] Running scorecard for $TAG ($COMMIT)..."

  # Run scorecard and capture JSON output
  JSON=$(scorecard --repo="$REPO" --commit="$COMMIT" --format=json 2>/dev/null || echo '{"score":-1}')

  # Extract overall score
  OVERALL=$(echo "$JSON" | jq -r '.score // -1')

  # Extract individual check scores into a associative-style lookup
  ROW="$TAG,$COMMIT,$TAG_DATE,$OVERALL"
  for CHECK in "Binary-Artifacts" "Branch-Protection" "CI-Tests" "CII-Best-Practices" "Code-Review" "Contributors" "Dangerous-Workflow" "Dependency-Update-Tool" "Fuzzing" "License" "Maintained" "Packaging" "Pinned-Dependencies" "SAST" "Security-Policy" "Signed-Releases" "Token-Permissions" "Vulnerabilities"; do
    SCORE=$(echo "$JSON" | jq -r --arg c "$CHECK" '.checks[] | select(.name == $c) | .score // -1' 2>/dev/null || echo "-1")
    [ -z "$SCORE" ] && SCORE="-1"
    ROW="$ROW,$SCORE"
  done

  echo "$ROW" >> "$OUTFILE"
  echo "  -> Score: $OVERALL"
done

echo ""
echo "Done! Results saved to $OUTFILE"
