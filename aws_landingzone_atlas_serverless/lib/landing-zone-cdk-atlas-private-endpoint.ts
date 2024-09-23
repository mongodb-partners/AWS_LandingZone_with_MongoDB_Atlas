import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import {
  MongoAtlasBootstrap,
  MongoAtlasBootstrapProps,
  AtlasBasicResources,
  AtlasBasic,
  CfnPrivateEndpointService,
  CfnPrivateEndpointAws,
  CfnPrivateEndpointServicePropsCloudProvider,
  CfnProject,
  CfnCluster,
  AtlasBasicPrivateEndpoint,
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

export class MyLandingZoneStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly subnetId;
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with 2 private subnets
    this.vpc = new ec2.Vpc(this, "MyVPC", {
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

    this.subnetId = this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId)[0];

    // Create a Security Group
    const securityGroup = new ec2.SecurityGroup(this, "MySecurityGroup", {
      vpc: this.vpc,
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
      vpc: this.vpc,
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
    //       typesToActivate: ["ServerlessInstance", ...AtlasBasicResources],
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

// add a mongodb atlas bootstrap
export class AtlasBootstrapExample extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const mongoDBProfile = "development";
    const roleName = "MongoDB-Atlas-CDK-Excecution";

    const bootstrapProperties: MongoAtlasBootstrapProps = {
      roleName: roleName,
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

// Add a dedicated cluster in atlas
export interface AtlasStackProps extends cdk.StackProps {
  readonly orgId: string;
  readonly profile: string;
  readonly ip: string;
}

export class AtlasPrivateEndpointStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    landingzone: MyLandingZoneStack,
    props: AtlasStackProps
  ) {
    super(scope, id, props);

    const projectName = "LZ-Atlas-Dedicated-Private-Endpoint";

    const dbuserSecret = new secretsmanager.Secret(this, "DatabaseUserSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "db-user" }),
        generateStringKey: "password",
        excludeCharacters: "%+~`#$&*()|[]{}:;<>?!'/@\"\\=-.,",
      },
    });

    const AtlasPvtendpoint = new AtlasBasicPrivateEndpoint(this, "AtlasBasic", {
      atlasBasicProps: {
        clusterProps: {
          name: "LZPrivateEndpoint",
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
        },

        ipAccessListProps: {
          accessList: [{ ipAddress: props.ip, comment: "My first IP address" }],
        },
      },
      privateEndpointProps: {
        awsVpcId: landingzone.vpc.vpcId,
        awsSubnetId: landingzone.subnetId
      },
      profile: props.profile,
      region: "US_EAST_1"
    });
  }
}
