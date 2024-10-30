# Create a VPC
resource "aws_vpc" "my_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
}

# Create private subnet
resource "aws_subnet" "my_private_subnet" {
  vpc_id                  = aws_vpc.my_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = false
}

# Create a security group allowing SSH access
resource "aws_security_group" "my_security_group" {
  name        = "MySecurityGroup"
  description = "Allow SSH access to EC2 instances"
  vpc_id      = aws_vpc.my_vpc.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Create a CloudWatch Log Group
resource "aws_cloudwatch_log_group" "my_log_group" {
  name              = "/aws/my-log-group"
  retention_in_days = 30
}

# Create IAM Role for EC2
resource "aws_iam_role" "my_ec2_role" {
  name = "MyEC2Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Attach necessary policies to IAM role
resource "aws_iam_role_policy_attachment" "ssm_managed_policy" {
  role       = aws_iam_role.my_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent_policy" {
  role       = aws_iam_role.my_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Create EC2 instance in private subnet
resource "aws_instance" "my_ec2_instance" {
  ami                  = "ami-00f251754ac5da7f0" # Amazon Linux 2 AMI
  instance_type        = "t2.micro"
  subnet_id            = aws_subnet.my_private_subnet.id
  security_groups      = [aws_security_group.my_security_group.id]
  iam_instance_profile = aws_iam_instance_profile.my_ec2_instance_profile.id

  tags = {
    Name = "MyEC2Instance"
  }
}

# IAM instance profile for EC2
resource "aws_iam_instance_profile" "my_ec2_instance_profile" {
  name = "MyInstanceProfile"
  role = aws_iam_role.my_ec2_role.name
}

# MongoDB Atlas Project and Cluster Creation
resource "mongodbatlas_project" "lz-private-endpoint" {
  org_id = var.mongodb_atlas_org_id
  name   = "LZ-Atlas-Dedicated-Private-Endpoint"
}

resource "mongodbatlas_advanced_cluster" "aws_private_connection" {
  project_id     = mongodbatlas_project.lz-private-endpoint.id
  name           = var.cluster_name
  cluster_type   = "REPLICASET"
  backup_enabled = true

  replication_specs {
    region_configs {
      priority      = 7
      provider_name = "AWS"
      region_name   = "US_EAST_1"
      electable_specs {
        instance_size = "M10"
        node_count    = 3
      }
    }
  }
}

# MongoDB Atlas Access List
resource "mongodbatlas_project_ip_access_list" "my_ip_access_list" {
  project_id = mongodbatlas_project.lz-private-endpoint.id
  cidr_block = "0.0.0.0/0"
  comment    = "My first IP address"
}

# Initiate the private endpoint creation in Atlas
resource "mongodbatlas_privatelink_endpoint" "pe_east" {
  project_id    = mongodbatlas_project.lz-private-endpoint.id
  provider_name = "AWS"
  region        = "us-east-1"
  timeouts {
    create = "20m"
    delete = "20m"
  }
}

# Connect Atlas Private Endpoint to the VPC endpoint in AWS
resource "mongodbatlas_privatelink_endpoint_service" "pe_east_service" {
  project_id          = mongodbatlas_privatelink_endpoint.pe_east.project_id
  private_link_id     = mongodbatlas_privatelink_endpoint.pe_east.id
  endpoint_service_id = aws_vpc_endpoint.vpce_east.id
  provider_name       = "AWS"
}

# Create AWS VPC endpoint
resource "aws_vpc_endpoint" "vpce_east" {
  vpc_id             = aws_vpc.my_vpc.id
  service_name       = mongodbatlas_privatelink_endpoint.pe_east.endpoint_service_name
  vpc_endpoint_type  = "Interface"
  subnet_ids         = [aws_subnet.my_private_subnet.id]
  security_group_ids = [aws_security_group.my_security_group.id]
}