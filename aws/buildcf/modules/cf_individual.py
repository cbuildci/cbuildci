from .tags import build_tags_list

from troposphere import \
    Template, Parameter, Output, Name, \
    Ref, Sub, GetAtt, \
    Not, Equals, If, NoValue, Split
from troposphere.iam import Role, Policy, PolicyType
from troposphere.logs import LogGroup
from troposphere.codebuild import \
    Project, Source, Artifacts, VpcConfig, Environment as CodeBuildEnvironment

# Access Control
from awacs.aws import Action, Allow, Statement, Principal, PolicyDocument

from awacs import \
    sts as ac_sts, \
    s3 as ac_s3, \
    ssm as ac_ssm, \
    kms as ac_kms, \
    logs as ac_logs, \
    ecr as ac_ecr, \
    codebuild as ac_codebuild

vAWSRegion = "${AWS::Region}"
vAWSAccountId = "${AWS::AccountId}"


def create_template():
    t = Template()

    t.add_description("The individual CodeBuild stack for CBuildCI.")

    p_build_description = t.add_parameter(Parameter(
        "BuildDescription",
        Description = "Used for the CodeBuild project description.",
        Type = "String",
    ))

    p_api_lambda_role = t.add_parameter(Parameter(
        "ApiLambdaRole",
        Description = "The IAM role used by the API lambda function, which will receive permission to monitor builds.",
        Type = "String",
    ))

    p_step_lambda_role = t.add_parameter(Parameter(
        "StepLambdaRole",
        Description = "The IAM role used by the lambda function, which will receive permission to start, stop and monitor builds.",
        Type = "String",
    ))

    p_source_bucket = t.add_parameter(Parameter(
        "SourceBucket",
        Type = "String",
    ))

    p_source_key_prefix = t.add_parameter(Parameter(
        "SourceKeyPrefix",
        Type = "String",
        Default = "github-source/",
    ))

    p_artifact_bucket = t.add_parameter(Parameter(
        "ArtifactBucket",
        Type = "String",
    ))

    p_artifact_key_prefix = t.add_parameter(Parameter(
        "ArtifactKeyPrefix",
        Type = "String",
        Default = "github-artifacts/",
    ))

    p_cache_bucket = t.add_parameter(Parameter(
        "CacheBucket",
        Type = "String",
    ))

    p_cache_key_prefix = t.add_parameter(Parameter(
        "CacheKeyPrefix",
        Type = "String",
        Default = "github-cache/",
    ))

    p_logs_retention_days = t.add_parameter(Parameter(
        "LogsRetentionDays",
        Description = "Number of days to keep CloudWatch logs for this stack's lambda function.",
        Type = "Number",
        Default = "30",
    ))

    p_code_build_role_policy_arns = t.add_parameter(Parameter(
        "CodeBuildRolePolicyArns",
        Description = "Optional list of IAM managed policy ARNs to attach to the CodeBuild role.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_read_ecr_arns = t.add_parameter(Parameter(
        "ReadECRArns",
        Description = "ECS Repository ARNs to give CodeBuild permission to pull images from.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_read_s3_arns = t.add_parameter(Parameter(
        "ReadS3Arns",
        Description = "S3 ARNs to give CodeBuild permission to S3.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_read_ssm_param_arns = t.add_parameter(Parameter(
        "ReadSSMParamArns",
        Description = "SSM parameters to give CodeBuild permission to read.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_read_kms_arns = t.add_parameter(Parameter(
        "ReadKMSArns",
        Description = "KMS keys to give CodeBuild permission to decrypt.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_vpc = t.add_parameter(Parameter(
        "VPC",
        Description = "Optional VPC to use for CodeBuild.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_security_groups = t.add_parameter(Parameter(
        "SecurityGroups",
        Description = "Security groups to use for CodeBuild.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_subnets = t.add_parameter(Parameter(
        "Subnets",
        Description = "Subnets to use for CodeBuild.",
        Type = "String",
        Default = "-NONE-",
    ))

    t.add_condition(
        "HasCodeBuildRolePolicyArns",
        Not(Equals(Ref(p_code_build_role_policy_arns), "-NONE-")),
    )

    t.add_condition(
        "HasReadECRArns",
        Not(Equals(Ref(p_read_ecr_arns), "-NONE-")),
    )

    t.add_condition(
        "HasReadS3Arns",
        Not(Equals(Ref(p_read_s3_arns), "-NONE-")),
    )

    t.add_condition(
        "HasReadSSMParamArns",
        Not(Equals(Ref(p_read_ssm_param_arns), "-NONE-")),
    )

    t.add_condition(
        "HasReadKMSArns",
        Not(Equals(Ref(p_read_kms_arns), "-NONE-")),
    )

    t.add_condition(
        "HasVPC",
        Not(Equals(Ref(p_vpc), "-NONE-")),
    )

    # Replace with custom tags if desired.
    tags = build_tags_list(t)

    r_log_group = t.add_resource(LogGroup(
        "CodeBuildLogGroup",
        LogGroupName = Sub("/aws/codebuild/${AWS::StackName}"),
        RetentionInDays = Ref(p_logs_retention_days),
    ))

    r_code_build_role = t.add_resource(Role(
        "CodeBuildRole",
        AssumeRolePolicyDocument = PolicyDocument(
            Version = "2012-10-17",
            Statement = [
                Statement(
                    Effect = Allow,
                    Action = [ac_sts.AssumeRole],
                    Principal = Principal("Service", ["codebuild.amazonaws.com"]),
                ),
            ],
        ),
        ManagedPolicyArns = If(
            "HasCodeBuildRolePolicyArns",
            Split(",", Ref(p_code_build_role_policy_arns)),
            NoValue,
        ),
        Policies = [
            Policy(
                PolicyName = "code-build-policy",
                PolicyDocument = {
                    "Statement": [
                        Statement(
                            Effect = Allow,
                            Resource = [
                                GetAtt(r_log_group, "Arn"),
                            ],
                            Action = [
                                ac_logs.CreateLogGroup,
                                ac_logs.CreateLogStream,
                                ac_logs.PutLogEvents,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_s3.ARN(
                                    resource = "${%s}/${%s}*" % (
                                        p_source_bucket.title,
                                        p_source_key_prefix.title,
                                    ),
                                )),
                            ],
                            Action = [
                                ac_s3.GetObject,
                                ac_s3.GetObjectVersion,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_s3.ARN(
                                    resource = "${%s}/${%s}*" % (
                                        p_artifact_bucket.title,
                                        p_artifact_key_prefix.title,
                                    ),
                                )),
                                Sub(ac_s3.ARN(
                                    resource = "${%s}/${%s}*" % (
                                        p_cache_bucket.title,
                                        p_cache_key_prefix.title,
                                    ),
                                )),
                            ],
                            Action = [
                                ac_s3.GetObject,
                                ac_s3.GetObjectVersion,
                                ac_s3.PutObject,
                            ],
                        ),
                        If(
                            "HasReadECRArns",
                            {
                                "Effect": Allow,
                                "Resource": Split(",", Ref(p_read_ecr_arns)),
                                "Action": [
                                    ac_ecr.BatchCheckLayerAvailability,
                                    ac_ecr.BatchGetImage,
                                    ac_ecr.GetDownloadUrlForLayer,
                                ],
                            },
                            NoValue,
                        ),
                        If(
                            "HasReadS3Arns",
                            {
                                "Effect": Allow,
                                "Resource": Split(",", Ref(p_read_s3_arns)),
                                "Action": [
                                    ac_s3.ListBucket,
                                    ac_s3.GetObject,
                                    ac_s3.GetObject,
                                    ac_s3.GetObjectVersion,
                                ],
                            },
                            NoValue,
                        ),
                        If(
                            "HasReadSSMParamArns",
                            {
                                "Effect": Allow,
                                "Resource": Split(",", Ref(p_read_ssm_param_arns)),
                                "Action": [
                                    ac_ssm.GetParameter,
                                ],
                            },
                            NoValue,
                        ),
                        If(
                            "HasReadKMSArns",
                            {
                                "Effect": Allow,
                                "Resource": Split(",", Ref(p_read_kms_arns)),
                                "Action": [
                                    ac_kms.Decrypt,
                                ],
                            },
                            NoValue,
                        ),
                    ]
                },
            ),
        ],
    ))

    r_code_build = t.add_resource(Project(
        "CodeBuild",
        Name = Ref("AWS::StackName"),
        Description = Ref(p_build_description),
        ServiceRole = Ref(r_code_build_role),
        Source = Source(
            Type = "CODEPIPELINE",
        ),
        Artifacts = Artifacts(
            Type = "CODEPIPELINE",
        ),
        VpcConfig = If(
            "HasVPC",
            VpcConfig(
                VpcId = Ref(p_vpc),
                Subnets = Ref(p_subnets),
                SecurityGroupIds = Ref(p_security_groups),
            ),
            NoValue,
        ),
        Environment = CodeBuildEnvironment(
            Type = "LINUX_CONTAINER",
            ComputeType = "BUILD_GENERAL1_SMALL",
            Image = "aws/codebuild/ubuntu-base:14.04",
        ),
        Tags = tags,
    ))

    t.add_resource(PolicyType(
        "ApiLambdaRolePolicy",
        Roles = [
            Ref(p_api_lambda_role),
        ],
        PolicyName = Sub("${AWS::StackName}-policy"),
        PolicyDocument = PolicyDocument(
            Statement = [
                Statement(
                    Effect = Allow,
                    Resource = [
                        GetAtt(r_code_build, "Arn")
                    ],
                    Action = [
                        ac_codebuild.BatchGetBuilds,
                    ],
                ),
                Statement(
                    Effect = Allow,
                    Resource = [
                        GetAtt(r_log_group, "Arn"),
                    ],
                    Action = [
                        ac_logs.GetLogEvents,
                    ],
                ),
            ],
        ),
    ))

    t.add_resource(PolicyType(
        "StepLambdaRolePolicy",
        Roles = [
            Ref(p_step_lambda_role),
        ],
        PolicyName = Sub("${AWS::StackName}-policy"),
        PolicyDocument = PolicyDocument(
            Statement = [
                Statement(
                    Effect = Allow,
                    Resource = [
                        GetAtt(r_code_build, "Arn")
                    ],
                    Action = [
                        ac_codebuild.StartBuild,
                        ac_codebuild.StopBuild,
                        ac_codebuild.BatchGetBuilds,
                    ],
                ),
            ],
        ),
    ))

    t.add_output(Output(
        "CodeBuildProjectName",
        Value = Ref(r_code_build),
    ))

    t.add_output(Output(
        "CodeBuildArn",
        Value = GetAtt(r_code_build, "Arn"),
    ))

    return t
