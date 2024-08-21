#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MyLandingZoneStack } from '../lib/landing-zone-cdk-stack';

import { AtlasBootstrapExample, AtlasServerlessBasicStack  } from '../lib/landing-zone-cdk-stack';




const app = new cdk.App();


// AWS Stack for MyLandinZoneStack

new MyLandingZoneStack(app, 'LandingZoneCdkStack', {
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
  orgId: '12343434', //update with your Atlas Org ID 
};

const MONGODB_PROFILE_NAME = 'development';



// // MongoDB Atlas Private Endpoint Stack

const serverlessStack = new AtlasServerlessBasicStack(app, 'atlas-serverless-basic-stack', {
  env,
  ipAccessList: '0.0.0.0',  //input your static IP Address from NAT Gateway
  profile: MONGODB_PROFILE_NAME,
  ...MyAccount,
});