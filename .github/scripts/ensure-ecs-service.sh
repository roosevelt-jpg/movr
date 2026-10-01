#!/usr/bin/env bash
# Create the ECS cluster, task definition, and service when they do not exist,
# then roll the service onto the image that was just pushed.
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

echo "Ensuring ECS cluster ${ECS_CLUSTER} in ${AWS_REGION}"
CLUSTER_STATUS="$(aws ecs describe-clusters --clusters "${ECS_CLUSTER}" --query 'clusters[0].status' --output text 2>/dev/null || true)"
if [[ "${CLUSTER_STATUS}" != "ACTIVE" ]]; then
  aws ecs create-cluster --cluster-name "${ECS_CLUSTER}" --no-cli-pager >/dev/null
  echo "Created cluster ${ECS_CLUSTER}"
else
  echo "Cluster ${ECS_CLUSTER} already active"
fi

aws logs create-log-group --log-group-name "${LOG_GROUP}" >/dev/null 2>&1 || true

if [[ -n "${ECS_EXECUTION_ROLE_ARN:-}" ]]; then
  EXEC_ROLE_ARN="${ECS_EXECUTION_ROLE_ARN}"
else
  EXEC_ROLE_ARN="$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text 2>/dev/null || true)"
  if [[ -z "${EXEC_ROLE_ARN}" || "${EXEC_ROLE_ARN}" == "None" ]]; then
    echo "Creating IAM role ${ROLE_NAME}"
    cat > /tmp/ecs-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
    aws iam create-role \
      --role-name "${ROLE_NAME}" \
      --assume-role-policy-document file:///tmp/ecs-trust.json \
      --no-cli-pager >/dev/null
    aws iam attach-role-policy \
      --role-name "${ROLE_NAME}" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
    EXEC_ROLE_ARN="$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)"
  fi
fi
echo "Execution role: ${EXEC_ROLE_ARN}"

if [[ -z "${ECS_SUBNETS:-}" ]]; then
  VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
  if [[ -z "${VPC_ID}" || "${VPC_ID}" == "None" ]]; then
    echo "No default VPC. Set the GitHub variable ECS_SUBNETS to comma-separated subnet IDs."
    exit 1
  fi
  ECS_SUBNETS="$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=${VPC_ID}" \
    --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' \
    --output text | tr '\t' ',')"
  if [[ -z "${ECS_SUBNETS}" || "${ECS_SUBNETS}" == "None" ]]; then
    ECS_SUBNETS="$(aws ec2 describe-subnets \
      --filters "Name=vpc-id,Values=${VPC_ID}" \
      --query 'Subnets[].SubnetId' \
      --output text | tr '\t' ',')"
  fi
fi
ECS_SUBNETS="${ECS_SUBNETS// /}"
echo "Subnets: ${ECS_SUBNETS}"

if [[ -z "${ECS_SECURITY_GROUPS:-}" ]]; then
  FIRST_SUBNET="${ECS_SUBNETS%%,*}"
  VPC_ID="$(aws ec2 describe-subnets --subnet-ids "${FIRST_SUBNET}" --query 'Subnets[0].VpcId' --output text)"
  SG_ID="$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=${VPC_ID}" "Name=group-name,Values=movr-api" \
    --query 'SecurityGroups[0].GroupId' --output text)"
  if [[ -z "${SG_ID}" || "${SG_ID}" == "None" ]]; then
    echo "Creating security group movr-api"
    SG_ID="$(aws ec2 create-security-group \
      --group-name movr-api \
      --description "Movr API Fargate tasks" \
      --vpc-id "${VPC_ID}" \
      --query GroupId --output text)"
    aws ec2 authorize-security-group-ingress \
      --group-id "${SG_ID}" \
      --ip-permissions 'IpProtocol=tcp,FromPort=3000,ToPort=3000,IpRanges=[{CidrIp=0.0.0.0/0,Description=movr-api}]' \
      >/dev/null
  fi
  ECS_SECURITY_GROUPS="${SG_ID}"
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

REVISION=""
for attempt in 1 2 3 4 5 6; do
  if REVISION="$(aws ecs register-task-definition \
      --cli-input-json file:///tmp/movr-taskdef.json \
      --query 'taskDefinition.revision' \
      --output text)"; then
    break
  fi
  echo "Registering task definition failed (attempt ${attempt}). Waiting for IAM propagation..."
  REVISION=""
  sleep 10
done
if [[ -z "${REVISION}" || "${REVISION}" == "None" ]]; then
  echo "Could not register task definition ${FAMILY}."
  exit 1
fi
TASK_DEF="${FAMILY}:${REVISION}"
echo "Registered task definition ${TASK_DEF}"

ACTIVE_COUNT="$(aws ecs describe-services \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE}" \
  --query "length(services[?status=='ACTIVE'])" \
  --output text)"

NETWORK="awsvpcConfiguration={subnets=[${ECS_SUBNETS}],securityGroups=[${ECS_SECURITY_GROUPS}],assignPublicIp=${ASSIGN_PUBLIC_IP}}"

LB_ARGS=()
if [[ -n "${ECS_TARGET_GROUP_ARN:-}" ]]; then
  LB_ARGS=(
    --load-balancers "targetGroupArn=${ECS_TARGET_GROUP_ARN},containerName=${CONTAINER_NAME},containerPort=3000"
    --health-check-grace-period-seconds 120
  )
fi

if [[ "${ACTIVE_COUNT}" == "1" ]]; then
  aws ecs update-service \
    --cluster "${ECS_CLUSTER}" \
    --service "${ECS_SERVICE}" \
    --task-definition "${TASK_DEF}" \
    --desired-count 1 \
    --force-new-deployment \
    --no-cli-pager >/dev/null
  echo "Updated service ${ECS_SERVICE} to ${TASK_DEF}"
else
    aws ecs create-service \
    --cluster "${ECS_CLUSTER}" \
    --service-name "${ECS_SERVICE}" \
    --task-definition "${TASK_DEF}" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "${NETWORK}" \
    --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true}" \
    "${LB_ARGS[@]}" \
    --no-cli-pager >/dev/null
