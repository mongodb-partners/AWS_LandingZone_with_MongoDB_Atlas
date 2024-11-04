#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
// import { MyLandingZoneStack } from '../lib/landing-zone-cdk-stack';

// import { AtlasServerlessBasicStack , AtlasBootstrapExample, MyLandingZoneStack} from '../lib/landing-zone-cdk-stack';
// import { AtlasBasicStack, AtlasBootstrapExample, MyLandingZoneStack } from "../lib/landing-zone-cdk-atlas-basic";
import { AtlasPrivateEndpointStack, MyLandingZoneStack, AtlasBootstrapExample } from  "../lib/landing-zone-cdk-atlas-private-endpoint"
// import { AtlasBootstrapExample, MyLandingZoneStack, AtlasPrivateEndpointStack } from  "../lib/landing-zone-atlas-cfn-resources"


// import { MongoAtlasBootstrap } from "../index"

const app = new cdk.App();

// AWS Stack for MyLandinZoneStack
const lz = new MyLandingZoneStack(app, 'LandingZoneCdkStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
  * want to deploy the stack to. */
   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

// MongoDB Atlas Bootstrap Stack
const env = { region: process.env.CDK_DEFAULT_REGION, account: process.env.CDK_DEFAULT_ACCOUNT };
new AtlasBootstrapExample(app, 'mongodb-atlas-bootstrap-stack', { env });

type AccountConfig = {
  readonly orgId: string;
  readonly projectId?: string;
}

const MyAccount: AccountConfig = {
  orgId: process.env.ATLAS_ORG_ID || '599f016c9f78f769464f5f94', // update with your Atlas Org ID 
};

const MONGODB_PROFILE_NAME = 'development';

// MongoDB Atlas Serverless Stack

// const serverlessStack = new AtlasServerlessBasicStack(app, 'atlas-serverless-basic-stack', {
//   env,
//   ipAccessList: process.env.IP_ACCESS_LIST || '0.0.0.0/0',  // input your static IP Address from NAT Gateway
//   profile: MONGODB_PROFILE_NAME,
//   ...MyAccount,
// });

// MongoDB Atlas Basic Stack

// const basicStack = new AtlasBasicStack(app, 'atlas-basic-stack', {
//   env,
//   ip: process.env.IP_ACCESS_LIST || '0.0.0.0/0',  // input your static IP Address from NAT Gateway
//   profile: MONGODB_PROFILE_NAME,
//   ...MyAccount,
// });

// MongoDB Atlas Private Endpoint Stack using L3 resources
const pvtEndpoint = new AtlasPrivateEndpointStack(app, 'atlas-private-endpoint-stack', {
    env
});

// MongoDB Atlas Private Endpoint Stack using individual CFN resources

// const pvtEndpoint = new AtlasPrivateEndpointStack(app, 'atlas-private-endpoint-stack', {
//   env
// });