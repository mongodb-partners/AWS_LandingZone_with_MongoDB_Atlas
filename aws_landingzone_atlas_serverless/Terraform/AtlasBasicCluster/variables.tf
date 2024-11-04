variable "public_key" {
  description = "The public API key for MongoDB Atlas"
  type        = string
}
variable "private_key" {
  description = "The private API key for MongoDB Atlas"
  type        = string
}
variable "access_key" {
  description = "The access key for AWS Account"
  type        = string
}
variable "secret_key" {
  description = "The secret key for AWS Account"
  type        = string
}
variable "cluster_name" {
  description = "Atlas cluster name"
  default     = "LZ-Atlas-Basic"
  type        = string
}
variable "mongodb_atlas_org_id" {
  description = "Atlas Orgnisation ID"
  type = string
}