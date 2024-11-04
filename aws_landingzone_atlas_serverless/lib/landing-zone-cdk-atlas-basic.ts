import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { v4 as uuidv4 } from "uuid";

import {
  MongoAtlasBootstrap,
  MongoAtlasBootstrapProps,
  AtlasBasicResources,
  AtlasBasic,
} from "awscdk-resources-mongodbatlas";

import * as path from "path";

import {
  App,
  Stack,
  StackProps,
  Duration,
  CfnOutput,
  SecretValue,
  aws_secretsmanager as secretsmanager,
} from "aws-cdk-lib";

import { SubnetType } from "aws-cdk-lib/aws-ec2";

// This script will help you deploy a dedicated atlas cluster

export class MyLandingZoneStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with 2 private subnets
    const vpc = new ec2.Vpc(this, "MyVPC", {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "PrivateSubnet1",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 24,
          name: "PrivateSubnet2",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create a Security Group
    const securityGroup = new ec2.SecurityGroup(this, "MySecurityGroup", {
      vpc,
      description: "Allow SSH access to EC2 instances",
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access from anywhere"
    );

    // Create a CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "MyLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    // Create an IAM Role for the EC2 instance
    const role = new iam.Role(this, "MyEC2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
    );

    // Create an EC2 instance in the private subnet
    const ec2Instance = new ec2.Instance(this, "MyEC2Instance", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: new ec2.AmazonLinuxImage(),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroup,
      role,
    });

    // add a mongodb atlas bootstrap

    // class AtlasBootstrapExample extends cdk.Stack {
    //   constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    //     super(scope, id, props);

    //     const roleName = "MongoDB-Atlas-CDK-Excecution";
    //     const mongoDBProfile = "development";

    //     const bootstrapProperties: MongoAtlasBootstrapProps = {
    //       roleName: roleName,
    //       secretProfile: mongoDBProfile,
    //       typesToActivate: AtlasBasicResources,
    //     };

    //     new MongoAtlasBootstrap(
    //       this,
    //       "mongodb-atlascdk-bootstrap",
    //       bootstrapProperties
    //     );
    //   }
    // }

    // Add User Data to configure CloudWatch Logs
    const userData = ec2Instance.userData;
    userData.addCommands(
      "yum update -y",
      "yum install -y amazon-cloudwatch-agent",
      "cat <<EOF > /opt/aws/amazon-cloudwatch-agent/bin/config.json",
      JSON.stringify({
        logs: {
          logs_collected: {
            files: {
              collect_list: [
                {
                  file_path: "/var/log/messages",
                  log_group_name: logGroup.logGroupName,
                  log_stream_name: "{instance_id}",
                },
              ],
            },
          },
        },
      }),
      "EOF",
      "/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json -s"
    );
  }
}

// Bootstrap the required resources in AWS to facilitate the creation of resources in atlas

export class AtlasBootstrapExample extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const roleName = "MongoDB-Atlas-CDK-Excecution";
    const mongoDBProfile = "development";

    const bootstrapProperties: MongoAtlasBootstrapProps = {
      roleName,
      secretProfile: mongoDBProfile,
      typesToActivate: AtlasBasicResources,
    };

    new MongoAtlasBootstrap(
      this,
      "mongodb-atlas-bootstrap",
      bootstrapProperties
    );
  }
}

// Add a MongoDB Atlas Dedicated Cluster

export interface AtlasStackProps extends cdk.StackProps {
  readonly orgId: string;
  readonly profile: string;
  readonly ip: string;
}

export class AtlasBasicStack extends cdk.Stack {
  readonly dbUserSecret: secretsmanager.ISecret;
  readonly connectionString: string;
  constructor(scope: Construct, id: string, props: AtlasStackProps) {
    super(scope, id, props);

    // const stack = Stack.of(this);
    // const atlasProps = this.getContextProps();
    const projectName = "LZ-Atlas-Dedicated";

    const dbuserSecret = new secretsmanager.Secret(this, "DatabaseUserSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "serverless-user" }),
        generateStringKey: "password",
        excludeCharacters: "%+~`#$&*()|[]{}:;<>?!'/@\"\\=-.,",
      },
    });

    this.dbUserSecret = dbuserSecret;
    const ipAccessList = props.ip;

    // Refer https://github.com/mongodb/awscdk-resources-mongodbatlas/blob/main/examples/l3-resources/atlas-basic.ts
    const atlasBasic = new AtlasBasic(this, "AtlasBasic", {
      clusterProps: {
        name: "AtlasDedicated",
        replicationSpecs: [
          {
            numShards: 1,
            advancedRegionConfigs: [
              {
                electableSpecs: {
                  ebsVolumeType: "STANDARD",
                  instanceSize: "M10",
                  nodeCount: 3,
                },
                priority: 7,
                regionName: "US_EAST_1",
              },
            ],
          },
        ],
      },
      projectProps: {
        orgId: props.orgId,
        name: projectName
      },

      ipAccessListProps: {
        accessList: [
          { ipAddress: ipAccessList, comment: "My first IP address" },
        ],
      },
      profile: props.profile,
    });

    this.connectionString = atlasBasic.mCluster
      .getAtt("ConnectionStrings.StandardSrv")
      .toString();
    new CfnOutput(this, "ProjectName", { value: projectName });
    new CfnOutput(this, "ConnectionString", { value: this.connectionString });
  }
}
