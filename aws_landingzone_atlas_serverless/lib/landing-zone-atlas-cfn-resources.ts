import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  MongoAtlasBootstrap,
  MongoAtlasBootstrapProps,
  AtlasBasicResources,
  AtlasBasicPrivateEndpoint,
  CfnProject,
  CfnCluster,
  CfnPrivateEndpointService,
  CfnPrivateEndpointServicePropsCloudProvider,
  CfnPrivateEndpointAws,
  CfnProjectIpAccessList
} from "awscdk-resources-mongodbatlas";
import {
  aws_secretsmanager as secretsmanager,
} from "aws-cdk-lib";
// import * as path from "path";
// import { SubnetType } from "aws-cdk-lib/aws-ec2";

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
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC, // Public subnet
        }
      ],
    });

    this.subnetId = this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId).join(", ");
    // this.subnetId = this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId)

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
    // const userData = ec2Instance.userData;
    // userData.addCommands(
    //   "yum update -y",
    //   "yum install -y amazon-cloudwatch-agent",
    //   "cat <<EOF > /opt/aws/amazon-cloudwatch-agent/bin/config.json",
    //   JSON.stringify({
    //     logs: {
    //       logs_collected: {
    //         files: {
    //           collect_list: [
    //             {
    //               file_path: "/var/log/messages",
    //               log_group_name: logGroup.logGroupName,
    //               log_stream_name: "{instance_id}",
    //             },
    //           ],
    //         },
    //       },
    //     },
    //   }),
    //   "EOF",
    //   "/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json -s"
    // );

  }
}

// add a mongodb atlas bootstrap
export class AtlasBootstrapExample extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const roleName = "MongoDB-Atlas-CDK-Excecution";
    const mongoDBProfile = "default";

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

// Add a dedicated cluster in atlas
// export interface AtlasStackProps extends cdk.StackProps {
//   readonly orgId: string;
//   readonly profile: string;
//   readonly ip: string;
// }

interface AtlasStackProps {
  readonly orgId: string;
  readonly profile: string;
  readonly clusterName: string;
  readonly region: string;
  readonly ip: string;
  readonly vpcId: string;
  readonly subnetId: string;
}

export class AtlasPrivateEndpointStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps
  ) {
    super(scope, id, props);

    const projectName = "LZ-Atlas-Private-Endpoint";
    // const vpcId = this.node.tryGetContext('vpcId') ?? "null";
    // const subnetId = this.node.tryGetContext('subnetId') ?? "null";
    const atlasProps = this.getContextProps()
    new secretsmanager.Secret(this, "DatabaseUserSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "db-user" }),
        generateStringKey: "password",
        excludeCharacters: "%+~`#$&*()|[]{}:;<>?!'/@\"\\=-.,",
      },
    });

    // Creating a new project
    const projectRes = new CfnProject(this, 'ProjectResource', {
        name: projectName,
        orgId: atlasProps.orgId,
        profile: atlasProps.profile
    });

    // Adding IP on the access list
    const myProjectIpAccessList = new CfnProjectIpAccessList(this, 'MyCfnProjectIpAccessList', {
        projectId: projectRes.attrId,
        profile: atlasProps.profile,
        accessList: [
          {
            ipAddress: atlasProps.ip,
            comment: "My First IP Address"
          }
        ]
    });

    myProjectIpAccessList.addDependency(projectRes)

    // Creating a cluster
    const clusterRes = new CfnCluster(this, 'ClusterResource', {
        name: atlasProps.clusterName,
        projectId: projectRes.attrId,
        profile: atlasProps.profile,
        clusterType: "REPLICASET",
        backupEnabled: true,
        pitEnabled: false,
        replicationSpecs: [{
          numShards: 1,
          advancedRegionConfigs: [{
            autoScaling: {
              diskGb: {
                enabled: true,
              },
              compute: {
                enabled: false,
                scaleDownEnabled: false,
              },
            },
            electableSpecs: {
              ebsVolumeType: "STANDARD",
              instanceSize: "M10",
              nodeCount: 3,
            },
            priority: 7,
            regionName: atlasProps.region,
          }]
        }]
      });

      clusterRes.addDependency(myProjectIpAccessList)

      const atlasService = new CfnPrivateEndpointService(this, "AtlasPrivateEndpointService", {
        projectId: projectRes.attrId,
        profile: atlasProps.profile,
        region: atlasProps.region,
        cloudProvider: CfnPrivateEndpointServicePropsCloudProvider.AWS
      });
  
      const awsPrivateEndpoint = new ec2.CfnVPCEndpoint(this, 'AWSPrivateEndpoint', {
        serviceName: atlasService.attrEndpointServiceName,
        subnetIds: [atlasProps.subnetId],
        vpcEndpointType: 'Interface',
        vpcId: atlasProps.vpcId,
      });
  
      awsPrivateEndpoint.addDependency(atlasService)
  
      const myPrivateEndpoint = new CfnPrivateEndpointAws(this, "AtlasPrivateEndpoint", {
        projectId: projectRes.attrId,
        profile: atlasProps.profile,
        endpointServiceId: atlasService.attrId,
        id: awsPrivateEndpoint.ref,
      });
  
      myPrivateEndpoint.addDependency(myPrivateEndpoint)
  
  }

  getContextProps(): AtlasStackProps {
    const orgId = this.node.tryGetContext('orgId') ?? "599f016c9f78f769464f5f94";
    if (!orgId){
      throw "No context value specified for orgId. Please specify via the cdk context."
    }

    const profile = this.node.tryGetContext('profile') ?? 'default';
    const clusterName = this.node.tryGetContext('clusterName') ?? 'AtlasPvtEndpoint';
    const region = this.node.tryGetContext('region') ?? "US_EAST_1";
    const ip = this.node.tryGetContext('ip') ?? "0.0.0.0/0";
    const vpcId = this.node.tryGetContext('vpcId') ?? "vpc-02c56a9e787538509";
    const subnetId = this.node.tryGetContext('subnetId') ?? "subnet-0f32d001f223adcc8";
    // console.log(profile, clusterName, region, ip, vpcId, subnetId)

    return {
      orgId,
      profile,
      clusterName,
      region,
      ip,
      vpcId,
      subnetId
    }
  }
}