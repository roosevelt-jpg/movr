#!/usr/bin/env bash
# Create the ECS cluster, task definition, and service when they do not exist,
# then roll the service onto the image that was just pushed.
# Uses only ECS, STS, CloudWatch Logs, and EC2 describe calls so a deploy user
# does not need iam:CreateRole or ec2:CreateSecurityGroup.
set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${ECS_CLUSTER:?ECS_CLUSTER is required}"
: "${ECS_SERVICE:?ECS_SERVICE is required}"
: "${IMAGE_URI:?IMAGE_URI is required}"

FAMILY="${ECS_TASK_FAMILY:-movr-api}"
LOG_GROUP="${ECS_LOG_GROUP:-/ecs/${FAMILY}}"
CPU="${ECS_CPU:-512}"
MEMORY="${ECS_MEMORY:-1024}"
ASSIGN_PUBLIC_IP="${ECS_ASSIGN_PUBLIC_IP:-ENABLED}"
CONTAINER_NAME="${ECS_CONTAINER_NAME:-movr-api}"
ROLE_NAME="${ECS_EXECUTION_ROLE_NAME:-ecsTaskExecutionRole}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
if [[ -n "${ECS_EXECUTION_ROLE_ARN:-}" ]]; then
  EXEC_ROLE_ARN="${ECS_EXECUTION_ROLE_ARN}"
else
  EXEC_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
fi
echo "Execution role: ${EXEC_ROLE_ARN}"

echo "Ensuring ECS cluster ${ECS_CLUSTER} in ${AWS_REGION}"
CLUSTER_STATUS="$(aws ecs describe-clusters --clusters "${ECS_CLUSTER}" --query 'clusters[0].status' --output text 2>/dev/null || true)"
if [[ "${CLUSTER_STATUS}" != "ACTIVE" ]]; then
  # First cluster in an account needs this role. Ignore "already exists".
  aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com >/dev/null 2>&1 || true
  if ! aws ecs create-cluster --cluster-name "${ECS_CLUSTER}" --no-cli-pager; then
    echo "Could not create ECS cluster ${ECS_CLUSTER}."
    echo "The deploy IAM user needs ecs:CreateCluster. If the error mentions the service-linked role, it also needs iam:CreateServiceLinkedRole (or create AWSServiceRoleForECS once in the IAM console)."
    exit 254
  fi
  echo "Created cluster ${ECS_CLUSTER}"
else
  echo "Cluster ${ECS_CLUSTER} already active"
fi

aws logs create-log-group --log-group-name "${LOG_GROUP}" >/dev/null 2>&1 || true

if [[ -z "${ECS_SUBNETS:-}" ]]; then
  VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
  if [[ -z "${VPC_ID}" || "${VPC_ID}" == "None" ]]; then
    echo "No default VPC. Set the GitHub variable ECS_SUBNETS to comma-separated subnet IDs."
    exit 1
  fi
  ECS_SUBNETS="$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=map-public-ip-on-launch,Values=true" \
    --query 'Subnets[].SubnetId' \
    --output text | tr '\t' ',')"
  if [[ -z "${ECS_SUBNETS}" || "${ECS_SUBNETS}" == "None" ]]; then
    ECS_SUBNETS="$(aws ec2 describe-subnets \
      --filters "Name=vpc-id,Values=${VPC_ID}" \
      --query 'Subnets[].SubnetId' \
      --output text | tr '\t' ',')"
  fi
fi
ECS_SUBNETS="${ECS_SUBNETS// /}"
ECS_SUBNETS="${ECS_SUBNETS%%,}"
echo "Subnets: ${ECS_SUBNETS}"
if [[ -z "${ECS_SUBNETS}" || "${ECS_SUBNETS}" == "None" ]]; then
  echo "No subnets found. Set the GitHub variable ECS_SUBNETS."
  exit 1
fi

if [[ -z "${ECS_SECURITY_GROUPS:-}" ]]; then
  FIRST_SUBNET="${ECS_SUBNETS%%,*}"
  VPC_ID="$(aws ec2 describe-subnets --subnet-ids "${FIRST_SUBNET}" --query 'Subnets[0].VpcId' --output text)"
  ECS_SECURITY_GROUPS="$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=default" \
    --query 'SecurityGroups[0].GroupId' --output text)"
  # Best-effort: open the API port. Ignore if the deploy user cannot change security groups.
  aws ec2 authorize-security-group-ingress \
    --group-id "${ECS_SECURITY_GROUPS}" \
    --protocol tcp --port 3000 --cidr 0.0.0.0/0 >/dev/null 2>&1 || true
fi
echo "Security groups: ${ECS_SECURITY_GROUPS}"

export FAMILY LOG_GROUP CPU MEMORY EXEC_ROLE_ARN CONTAINER_NAME IMAGE_URI AWS_REGION
python3 - <<'PY'
import json, os
task = {
  "family": os.environ["FAMILY"],
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": os.environ["CPU"],
  "memory": os.environ["MEMORY"],
  "executionRoleArn": os.environ["EXEC_ROLE_ARN"],
  "containerDefinitions": [{
    "name": os.environ["CONTAINER_NAME"],
    "image": os.environ["IMAGE_URI"],
    "essential": True,
    "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "APP_PORT", "value": "3000"},
      {"name": "APP_URL", "value": "https://api.mymovr.io"},
      {"name": "PUBLIC_WEB_URL", "value": "https://mymovr.io"},
      {"name": "ADMIN_URL", "value": "https://admin.mymovr.io"},
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": os.environ["LOG_GROUP"],
        "awslogs-region": os.environ["AWS_REGION"],
        "awslogs-stream-prefix": "ecs",
      },
    },
  }],
}
with open("/tmp/movr-taskdef.json", "w", encoding="utf-8") as fh:
    json.dump(task, fh)
PY

set +e
REGISTER_OUT="$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/movr-taskdef.json \
  --query 'taskDefinition.revision' \
  --output text 2>&1)"
REGISTER_CODE=$?
set -e
if [[ "${REGISTER_CODE}" -ne 0 ]]; then
  echo "${REGISTER_OUT}"
  echo "Could not register task definition ${FAMILY}."
  echo "Confirm role ${EXEC_ROLE_ARN} exists, and that the deploy user has ecs:RegisterTaskDefinition and iam:PassRole on that role."
  exit 254
fi
TASK_DEF="${FAMILY}:${REGISTER_OUT}"
echo "Registered task definition ${TASK_DEF}"

ACTIVE_COUNT="$(aws ecs describe-services \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE}" \
  --query "length(services[?status=='ACTIVE'])" \
  --output text)"

NETWORK="awsvpcConfiguration={subnets=[${ECS_SUBNETS}],securityGroups=[${ECS_SECURITY_GROUPS}],assignPublicIp=${ASSIGN_PUBLIC_IP}}"

if [[ "${ACTIVE_COUNT}" == "1" ]]; then
  aws ecs update-service \
    --cluster "${ECS_CLUSTER}" \
    --service "${ECS_SERVICE}" \
    --task-definition "${TASK_DEF}" \
    --desired-count 1 \
    --force-new-deployment \
    --no-cli-pager
  echo "Updated service ${ECS_SERVICE} to ${TASK_DEF}"
else
  aws ecs create-service \
    --cluster "${ECS_CLUSTER}" \
    --service-name "${ECS_SERVICE}" \
    --task-definition "${TASK_DEF}" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "${NETWORK}" \
    --no-cli-pager
  echo "Created service ${ECS_SERVICE} on ${TASK_DEF}"
fi
