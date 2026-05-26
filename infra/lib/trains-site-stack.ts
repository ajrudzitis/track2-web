import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

export interface TrainsSiteStackProps extends cdk.StackProps {
  /** Fully-qualified domain name (e.g. `trains.aleksrudzitis.com`). */
  readonly domainName: string;
}

export class TrainsSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TrainsSiteStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    // Dedicated hosted zone for the subdomain. The parent zone
    // (aleksrudzitis.com) lives elsewhere; after `cdk deploy` you'll get
    // four NS records from this zone — add them as an NS record set under
    // aleksrudzitis.com to delegate.
    const hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: domainName,
      comment: `Subdomain zone for ${domainName}`,
    });

    // Private bucket; only CloudFront (via OAC) can read it.
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: undefined, // CDK-generated, avoids global-name collisions
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ACM cert for the domain. Lives in us-east-1 (this stack's region)
    // so CloudFront can use it directly.
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${domainName} static site`,
      defaultRootObject: 'index.html',
      domainNames: [domainName],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      // The picker is the single root view; any unknown path should fall
      // through to it. Serve index.html on 403/404 (S3 returns 403 for
      // missing keys when public access is blocked) with a 200 status.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    new route53.ARecord(this, 'AliasA', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new route53.AaaaRecord(this, 'AliasAAAA', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new cdk.CfnOutput(this, 'BucketName', { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'HostedZoneId', { value: hostedZone.hostedZoneId });
    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(',', hostedZone.hostedZoneNameServers ?? []),
      description: 'Add these as an NS record under aleksrudzitis.com to delegate the subdomain.',
    });
    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${domainName}/` });
  }
}
