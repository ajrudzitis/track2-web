#!/usr/bin/env bash
#
# Build the web app, sync the result to the S3 bucket created by the CDK
# stack, and invalidate the CloudFront distribution so the change goes
# live within a minute or so.
#
# Requires the AWS CLI authenticated to an account / region where
# `TrainsSiteStack` has already been deployed. See `infra/README.md` (or
# the project README) for the one-time setup.

set -euo pipefail

STACK_NAME="${STACK_NAME:-TrainsSiteStack}"
AWS_REGION="${AWS_REGION:-us-east-1}"

cd "$(dirname "$0")/.."

echo "Building static site (npm run build)…"
npm run build

echo "Querying stack outputs from $STACK_NAME ($AWS_REGION)…"

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

BUCKET=$(stack_output BucketName)
DIST_ID=$(stack_output DistributionId)

if [[ -z "$BUCKET" || -z "$DIST_ID" ]]; then
  echo "Failed to resolve BucketName / DistributionId from $STACK_NAME outputs." >&2
  echo "Is the stack deployed? Try 'cd infra && npx cdk deploy'." >&2
  exit 1
fi

echo "  bucket: $BUCKET"
echo "  distribution: $DIST_ID"

echo "Syncing dist/ to s3://$BUCKET/ …"
# Two-pass sync: hashed asset filenames get a long cache header, everything
# else (notably index.html) is no-cache so changes are picked up immediately.
aws s3 sync dist/ "s3://$BUCKET/" \
  --region "$AWS_REGION" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --region "$AWS_REGION" \
  --cache-control "no-cache, must-revalidate"

echo "Invalidating CloudFront distribution $DIST_ID …"
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --output text \
  --query "Invalidation.Id" \
  > /tmp/trains-invalidation-id
echo "  invalidation: $(cat /tmp/trains-invalidation-id)"
rm -f /tmp/trains-invalidation-id

echo "Done."
