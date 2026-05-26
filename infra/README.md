# Infra — trains.aleksrudzitis.com

AWS CDK stack for the static site:

- **Route 53 hosted zone** for `trains.aleksrudzitis.com` (delegated from
  the parent `aleksrudzitis.com` zone — this stack just creates the
  subdomain zone; you manually add the `NS` record under the parent).
- **ACM certificate** in us-east-1, DNS-validated against the new zone.
- **S3 bucket** (private, OAC-only access, retained on stack delete).
- **CloudFront distribution** — HTTPS-only, HTTP/2+3, gzip+brotli, OAC to
  S3, 403/404 → `/index.html` with a 200 status so the in-page picker
  handles unknown paths.
- **A + AAAA alias records** on the subdomain pointing at CloudFront.

Everything lives in `us-east-1` so we can attach the ACM cert directly to
CloudFront without CDK cross-region references.

## First-time deploy

```bash
npm install
npx cdk bootstrap                       # once per AWS account+region
npx cdk deploy TrainsSiteStack
```

The deploy will pause on `Certificate validation` for a few minutes.
While it waits, copy the four nameservers from the `NameServers` output
(or `aws route53 get-hosted-zone --id <HostedZoneId>`) and create an
**`NS` record set** named `trains` under the parent
`aleksrudzitis.com` hosted zone (in whatever account holds it) with
those four values. Once DNS resolves, ACM validates and `deploy`
finishes.

After the first successful deploy, the `BucketName` and `DistributionId`
outputs are what `../scripts/deploy.sh` reads to push code updates.

## Useful commands

```bash
npx cdk diff             # what will change on next deploy
npx cdk synth            # synthesize CloudFormation to cdk.out/
npx cdk deploy           # apply changes
npx cdk destroy          # tear down (the S3 bucket is RETAIN — manual cleanup)
```

## Notes

- The S3 bucket is `RemovalPolicy.RETAIN` so an accidental `cdk destroy`
  doesn't take the content with it.
- `priceClass = PRICE_CLASS_100` (US + Europe edge locations only). Cheap.
- If you ever move the parent zone to a different AWS account or
  registrar, you only need to update the `NS` record set — the subdomain
  zone created here keeps the same name servers across redeploys.
