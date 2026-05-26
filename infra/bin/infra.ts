#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TrainsSiteStack } from '../lib/trains-site-stack';

const app = new cdk.App();

// CloudFront requires its certificate in us-east-1; the rest of the
// resources (S3, Route 53) are region-agnostic, so we keep everything in
// us-east-1 to avoid CDK cross-region references.
new TrainsSiteStack(app, 'TrainsSiteStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  domainName: 'trains.aleksrudzitis.com',
  description: 'trains.aleksrudzitis.com — S3 + CloudFront + Route 53',
});
