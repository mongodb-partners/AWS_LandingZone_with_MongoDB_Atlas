# AWS Landing Zone with MongoDB Atlas 

## Introduction

AWS Landing Zone is a solution that helps enterprises quickly set up a secure, multi-account AWS environment based on best practices. With AWS Landing Zone, enterprises can easily manage multiple AWS accounts, enforce security and compliance policies, and streamline resource provisioning. By leveraging AWS Landing Zone, enterprises can accelerate their cloud adoption journey and ensure a consistent and secure infrastructure across their organization.

This repository enables developers to setup a standard AWS Landing Zone with MongoDB Atlas.

## Usage

Developers can use this repository as a starting point for deploying Landing zones in AWS with MongoDB Atlas. It provides a blank project with the necessary setup to create an AWS Landing Zone with a VPC, Subnet, Routes , Security Group , CloudWatch and integrate it with MongoDB Atlas.

## Prerequisite

- [MongoDB Organization access](https://www.mongodb.com/docs/atlas/tutorial/manage-organizations/) for creating API keys
- Create an [AWS Account](https://aws.amazon.com/resources/create-account/)
- Install [Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)

## Deployment Steps

### Step 1 : Set up the MongoDB Atlas Organization API access

Login to the MongoDB Atlas
Create a Organization Access through [API](https://www.mongodb.com/docs/atlas/configure-api-access-org/#in---go-to-the-organization-access-manager-page.)

### Step 2: Git clone

Git clone the repository:

` git clone https://github.com/mongodb-partners/AWS_LandingZone_with_MongoDB_Atlas.git `

### Step 3: Initialize Terraform 

Run `terraform init` to initialize the working directory and download the necessary packages.

### Step 4: Create an execution plan

Run `terraform plan` to create an execution plan and visualize the changes that terraform will make to your infrastructure.

### Step 5: Deploy the changes

Run `terraform apply` to make the changes to your infrastructure as described in the code.

### Step 6: Testing

Validate the components created/modified by terraform in your infrastructure.

### Step 7: Cleanup

Once you are done testing, run `terraform destroy` to destroy the resources deployed in your infrastructure.