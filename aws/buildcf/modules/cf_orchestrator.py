import os

from .tags import build_tags_list

from troposphere import \
    Template, Parameter, Output, Name, \
    Ref, Sub, GetAtt, \
    Equals, Not, If, NoValue, Split
from troposphere.iam import Role, Policy, PolicyType
from troposphere.kms import Key, Alias
from troposphere.awslambda import Function, Code, Permission, Environment
from troposphere.apigateway import \
    RestApi, Resource, \
    Method, MethodResponse, \
    Integration, IntegrationResponse
from troposphere.logs import LogGroup
from troposphere.stepfunctions import StateMachine

# Access Control
from awacs.aws import Action, Allow, Statement, Principal, PolicyDocument

from awacs import \
    sts as ac_sts, \
    dynamodb as ac_dynamodb, \
    states as ac_states, \
    execute_api as ac_execute_api, \
    s3 as ac_s3, \
    ssm as ac_ssm, \
    kms as ac_kms, \
    logs as ac_logs, \
    awslambda as ac_lambda

vAWSRegion = "${AWS::Region}"
vAWSAccountId = "${AWS::AccountId}"

vWebhookLambdaKMSActions = [ac_kms.Encrypt, ac_kms.Decrypt]
vStepLambdaKMSActions = [ac_kms.Encrypt, ac_kms.Decrypt]
vApiLambdaKMSActions = [ac_kms.Encrypt, ac_kms.Decrypt]


def create_template():
    t = Template()

    t.add_description("The orchestrator stack for CBuildCI.")

    p_base_url = t.add_parameter(Parameter(
        "BaseUrl",
        Description = "The base URL of the application, e.g. \"https://cbuildci.mycompany.com/\"",
        Type = "String",
    ))

    p_secrets_kms_arn = t.add_parameter(Parameter(
        "SecretsKMSArn",
        Description = "Set to \"-CREATE-\" (default) to create a new KMS key (default), or enter the ARN of an existing key to use.",
        Type = "String",
        Default = "-CREATE-",
    ))

    p_secrets_kms_alias = t.add_parameter(Parameter(
        "SecretsKMSAlias",
        Description = "If SecretsKMSArn is set to \"-CREATE-\", the alias for KMS key. Defaults to \"${AWS::StackName}-kms-key\"",
        Type = "String",
        Default = "-DEFAULT-",
    ))

    p_secrets_kms_user_arns = t.add_parameter(Parameter(
        "SecretsKMSUserArns",
        Description = "If SecretsKMSArn is set to \"-CREATE-\", IAM User or role ARNs will have \"user\" access to the KMS key.",
        Type = "String",
        Default = "-NONE-",
    ))

    p_secrets_kms_admin_arns = t.add_parameter(Parameter(
        "SecretsKMSAdminArns",
        Description = "If SecretsKMSArn is set to \"-CREATE-\", IAM User or role ARNs will have \"admin\" access to the KMS key.",
        Type = "String",
        Default = "-REQUIRED-IF-CREATE-",
    ))

    p_config_table_name = t.add_parameter(Parameter(
        "ConfigTableName",
        Type = "String",
    ))

    p_locks_table_name = t.add_parameter(Parameter(
        "LocksTableName",
        Type = "String",
    ))

    p_sessions_table_name = t.add_parameter(Parameter(
        "SessionsTableName",
        Type = "String",
    ))

    p_executions_table_name = t.add_parameter(Parameter(
        "ExecutionsTableName",
        Type = "String",
    ))

    p_artifact_bucket_name = t.add_parameter(Parameter(
        "ArtifactBucketName",
        Type = "String",
    ))

    p_app_static_key_prefix = t.add_parameter(Parameter(
        "AppStaticKeyPrefix",
        Description = "Path prefix where the static UI application resources will be stored.",
        Type = "String",
        Default = "github-app-static/",
    ))

    p_artifact_key_prefix = t.add_parameter(Parameter(
        "ArtifactKeyPrefix",
        Description = "Path prefix for storing artifacts in the artifact bucket.",
        Type = "String",
        Default = "github-artifacts/",
    ))

    p_source_key_prefix = t.add_parameter(Parameter(
        "SourceKeyPrefix",
        Description = "Path prefix for source zips in the artifact bucket.",
        Type = "String",
        Default = "github-source/",
    ))

    p_github_url = t.add_parameter(Parameter(
        "GitHubUrl",
        Type = "String",
        Default = "https://github.com/",
    ))

    p_github_api_url = t.add_parameter(Parameter(
        "GitHubApiUrl",
        Type = "String",
        Default = "https://api.github.com/",
    ))

    p_github_app_id = t.add_parameter(Parameter(
        "GitHubAppId",
        Description = "The client ID number of the GitHub App",
        Type = "String",
    ))

    p_github_client_id = t.add_parameter(Parameter(
        "GitHubOAuthClientId",
        Description = "The OAuth client ID for the GitHub App.",
        Type = "String",
    ))

    p_github_client_secret_param_name = t.add_parameter(Parameter(
        "GitHubClientSecretParamName",
        Description = "SSM parameter that stores the GitHub App OAuth client secret.",
        Type = "String",
    ))

    p_github_webhook_secret_param_name = t.add_parameter(Parameter(
        "GitHubWebhookSecretParamName",
        Description = "SSM parameter that stores the GitHub App webhook secret for HMAC validation.",
        Type = "String",
    ))

    p_github_app_private_key_param_name = t.add_parameter(Parameter(
        "GitHubAppPrivateKeyParamName",
        Description = "SSM parameter that stores the GitHub App private key.",
        Type = "String",
    ))

    p_github_use_checks = t.add_parameter(Parameter(
        "GitHubUseChecks",
        Description = "Set to false to disable the use of GitHub Checks. See https://developer.github.com/v3/checks/",
        Type = "String",
        AllowedValues = ["true", "false"],
        Default = "true",
    ))

    p_session_secrets_param_name = t.add_parameter(Parameter(
        "SessionSecretsParamName",
        Description = "Comma delimited list of secrets used to sign session cookies.",
        Type = "String",
    ))

    p_logs_retention_days = t.add_parameter(Parameter(
        "LogsRetentionDays",
        Description = "Number of days to keep CloudWatch logs for this stack's lambda function.",
        Type = "Number",
        Default = "30",
    ))

    p_lambda_zip_s3_bucket = t.add_parameter(Parameter(
        "LambdaZipS3Bucket",
        Description = "S3 bucket name where this stack's lambda code is stored as a zip file.",
        Type = "String",
    ))

    p_lambda_zip_s3_key = t.add_parameter(Parameter(
        "LambdaZipS3Key",
        Description = "Object key in LambdaZipS3Bucket for this stack's lambda code.",
        Type = "String",
    ))

    p_wait_seconds_default = t.add_parameter(Parameter(
        "WaitSecondsDefault",
        Description = "Default number of seconds to wait between checking the status of running builds.",
        Type = "Number",
        Default = "30",
        MinValue = 10,
        MaxValue = 120,
    ))

    p_lock_timeout_seconds = t.add_parameter(Parameter(
        "LockTimeoutSeconds",
        Description = "Number of seconds until an orphaned execution lock will expired. Must not be less than WaitSecondsDefault x 2.",
        Type = "Number",
        Default = "300",
        MinValue = 60,
    ))

    p_max_session_minutes = t.add_parameter(Parameter(
        "MaxSessionMinutes",
        Description = "Number of minutes until a login session expires.",
        Type = "Number",
        Default = "30",
        MinValue = 10,
    ))

    p_builds_yml_file = t.add_parameter(Parameter(
        "BuildsYmlFile",
        Description = "The path to the file in the repo that contains the build configuration.",
        Type = "String",
        Default = ".cbuildci.yml",
    ))

    t.add_condition(
        "DoCreateKMSKey",
        Equals(Ref(p_secrets_kms_arn), "-CREATE-"),
    )

    t.add_condition(
        "UseDefaultAliasName",
        Equals(Ref(p_secrets_kms_alias), "-DEFAULT-"),
    )

    t.add_condition(
        "HasKMSUserArns",
        Not(Equals(Ref(p_secrets_kms_user_arns), "-NONE-")),
    )

    # Replace with custom tags if desired.
    tags = build_tags_list(t)

    script_dir = os.path.dirname(os.path.realpath(__file__))

    path_state_machine_definition = os.path.normpath(os.path.join(
        script_dir,
        "state-machine-definition.json",
    ))

    with open(path_state_machine_definition, "r") as stream:
        state_machine_definition = stream.read()

    r_webhook_lambda_role = t.add_resource(Role(
        "WebhookLambdaRole",
        Path = "/service-role/",
        AssumeRolePolicyDocument = PolicyDocument(
            Statement = [
                Statement(
                    Effect = Allow,
                    Action = [ac_sts.AssumeRole],
                    Principal = Principal("Service", ["lambda.amazonaws.com"]),
                ),
            ],
        ),
        Policies = [
            Policy(
                PolicyName = "lambda-policy",
                PolicyDocument = PolicyDocument(
                    Statement = [
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_config_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_locks_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_executions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_dynamodb.GetItem,
                                ac_dynamodb.BatchGetItem,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_locks_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_executions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_dynamodb.PutItem,
                                ac_dynamodb.UpdateItem,
                                ac_dynamodb.DeleteItem,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_ssm.ARN(
                                    resource = "parameter/${%s}"
                                               % p_github_webhook_secret_param_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_ssm.ARN(
                                    resource = "parameter/${%s}"
                                               % p_github_app_private_key_param_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_ssm.GetParameter,
                            ],
                        ),
                    ]
                )
            )
        ],
    ))

    # Permissions for the general API.
    # The general API should not have read access to unencrypted secrets.
    r_api_lambda_role = t.add_resource(Role(
        "ApiLambdaRole",
        Path = "/service-role/",
        AssumeRolePolicyDocument = PolicyDocument(
            Statement = [
                Statement(
                    Effect = Allow,
                    Action = [ac_sts.AssumeRole],
                    Principal = Principal("Service", ["lambda.amazonaws.com"]),
                ),
            ],
        ),
        Policies = [
            Policy(
                PolicyName = "lambda-policy",
                PolicyDocument = PolicyDocument(
                    Statement = [
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_config_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_locks_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_sessions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_executions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_dynamodb.GetItem,
                                ac_dynamodb.BatchGetItem,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_locks_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_sessions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_executions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_dynamodb.UpdateItem,
                                ac_dynamodb.DeleteItem,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_ssm.ARN(
                                    resource = "parameter/${%s}"
                                               % p_github_client_secret_param_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_ssm.ARN(
                                    resource = "parameter/${%s}"
                                               % p_session_secrets_param_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_ssm.GetParameter,
                                ac_ssm.PutParameter,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_ssm.ARN(
                                    resource = "parameter/${%s}"
                                               % p_github_webhook_secret_param_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_ssm.ARN(
                                    resource = "parameter/${%s}"
                                               % p_github_app_private_key_param_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_ssm.PutParameter,
                            ],
                        ),
                    ]
                )
            )
        ],
    ))

    r_step_lambda_role = t.add_resource(Role(
        "StepLambdaRole",
        Path = "/service-role/",
        AssumeRolePolicyDocument = PolicyDocument(
            Statement = [
                Statement(
                    Effect = Allow,
                    Action = [ac_sts.AssumeRole],
                    Principal = Principal("Service", ["lambda.amazonaws.com"]),
                ),
            ],
        ),
        Policies = [
            Policy(
                PolicyName = "lambda-policy",
                PolicyDocument = PolicyDocument(
                    Statement = [
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_locks_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_executions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_dynamodb.GetItem,
                                ac_dynamodb.BatchGetItem,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_locks_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Sub(ac_dynamodb.ARN(
                                    resource = "table/${%s}" % p_executions_table_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_dynamodb.PutItem,
                                ac_dynamodb.UpdateItem,
                                ac_dynamodb.DeleteItem,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_s3.ARN(
                                    resource = "${%s}/*" % p_artifact_bucket_name.title,
                                )),
                            ],
                            Action = [
                                ac_s3.GetObject,
                                ac_s3.GetObjectVersion,
                                ac_s3.PutObject,
                            ],
                        ),
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_ssm.ARN(
                                    resource = "parameter/${%s}"
                                               % p_github_app_private_key_param_name.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                            ],
                            Action = [
                                ac_ssm.GetParameter,
                            ],
                        ),
                    ]
                )
            )
        ],
    ))

    r_secrets_kms_key = t.add_resource(Key(
        "SecretsKMSKey",
        Condition = "DoCreateKMSKey",
        DeletionPolicy = "Retain",
        Description = Sub("Encrypts secrets (e.g. private keys) for the CBuildCI stack \"${AWS::StackName}\""),
        KeyPolicy = {
            "Version": "2012-10-17",
            "Statement": [
                If(
                    "HasKMSUserArns",
                    Statement(
                        Sid = "Allow use of the key",
                        Effect = Allow,
                        Resource = ["*"],
                        Principal = Principal(
                            "AWS",
                            Split(",", Ref(p_secrets_kms_user_arns)),
                        ),
                        Action = [
                            ac_kms.Encrypt,
                            ac_kms.Decrypt,
                            ac_kms.ReEncrypt,
                            ac_kms.GenerateDataKey,
                            ac_kms.GenerateDataKeyWithoutPlaintext,
                            ac_kms.DescribeKey,
                        ],
                    ),
                    NoValue,
                ),
                Statement(
                    Sid = "Allow access for Key Administrators",
                    Effect = Allow,
                    Resource = ["*"],
                    Principal = Principal(
                        "AWS",
                        Split(",", Ref(p_secrets_kms_admin_arns)),
                    ),
                    Action = [
                        Action("kms", "Create*"),
                        Action("kms", "Describe*"),
                        Action("kms", "Enable*"),
                        Action("kms", "List*"),
                        Action("kms", "Put*"),
                        Action("kms", "Update*"),
                        Action("kms", "Revoke*"),
                        Action("kms", "Disable*"),
                        Action("kms", "Get*"),
                        Action("kms", "Delete*"),
                        ac_kms.TagResource,
                        ac_kms.UntagResource,
                        ac_kms.ScheduleKeyDeletion,
                        ac_kms.CancelKeyDeletion,
                    ],
                ),
                Statement(
                    Sid = "Grant actions to WebhookLambda",
                    Effect = Allow,
                    Resource = ["*"],
                    Principal = Principal(
                        "AWS",
                        GetAtt(r_webhook_lambda_role, "Arn"),
                    ),
                    Action = vWebhookLambdaKMSActions,
                ),
                Statement(
                    Sid = "Grant actions to StepLambda",
                    Effect = Allow,
                    Resource = ["*"],
                    Principal = Principal(
                        "AWS",
                        GetAtt(r_step_lambda_role, "Arn"),
                    ),
                    Action = vStepLambdaKMSActions,
                ),
                Statement(
                    Sid = "Grant actions to ApiLambda",
                    Effect = Allow,
                    Resource = ["*"],
                    Principal = Principal(
                        "AWS",
                        GetAtt(r_api_lambda_role, "Arn"),
                    ),
                    Action = vApiLambdaKMSActions,
                ),
            ]
        },
        Tags = tags,
    ))

    r_secrets_kms_key_alias = t.add_resource(Alias(
        "SecretsKMSKeyAlias",
        Condition = "DoCreateKMSKey",
        AliasName = If(
            "UseDefaultAliasName",
            Sub("alias/${AWS::StackName}-kms-key"),
            Sub("alias/${%s}" % p_secrets_kms_alias.title),
        ),
        TargetKeyId = Ref(r_secrets_kms_key),
    ))

    def grant_kms_actions(role, actions):
        # Add a policy to the Webhook lambda role so it can encrypt/decrypt using
        # the KMS key. This is done using PolicyType to avoid a circular reference.
        t.add_resource(PolicyType(
            "%sKMSPolicy" % role.title,
            Roles = [
                Ref(role),
            ],
            PolicyName = Sub(
                "%s-kms" % r_webhook_lambda_role.title
            ),
            PolicyDocument = PolicyDocument(
                Version = "2012-10-17",
                Statement = [
                    Statement(
                        Effect = Allow,
                        Resource = [
                            If(
                                "DoCreateKMSKey",
                                Sub(ac_kms.ARN(
                                    resource = "key/${%s}" % r_secrets_kms_key.title,
                                    region = vAWSRegion,
                                    account = vAWSAccountId,
                                )),
                                Ref(p_secrets_kms_arn),
                            )
                        ],
                        Action = actions,
                    ),
                ]
            ),
        ))

    # Grant KMS actions to lambda roles
    grant_kms_actions(r_webhook_lambda_role, vWebhookLambdaKMSActions)
    grant_kms_actions(r_step_lambda_role, vStepLambdaKMSActions)
    grant_kms_actions(r_api_lambda_role, vApiLambdaKMSActions)

    lambda_env_vars = Environment(
        Variables = {
            "LOCK_TIMEOUT_SECONDS": Ref(p_lock_timeout_seconds),
            "MAX_SESSION_MINUTES": Ref(p_max_session_minutes),
            "BUILDS_YML_FILE": Ref(p_builds_yml_file),
            "BASE_URL": Ref(p_base_url),
            "TABLE_CONFIG_NAME": Ref(p_config_table_name),
            "TABLE_LOCKS_NAME": Ref(p_locks_table_name),
            "TABLE_SESSIONS_NAME": Ref(p_sessions_table_name),
            "TABLE_EXECUTIONS_NAME": Ref(p_executions_table_name),
            "STATE_MACHINE_ARN": Sub(
                ac_states.ARN(
                    resource = "stateMachine:${AWS::StackName}-statemachine",
                    region = vAWSRegion,
                    account = vAWSAccountId,
                ),
            ),
            "STATE_MACHINE_WAIT_SECONDS_DEFAULT": Ref(p_wait_seconds_default),
            "SOURCE_S3_BUCKET_DEFAULT": Ref(p_artifact_bucket_name),
            "SOURCE_S3_KEY_PREFIX_DEFAULT": Sub(
                "${%s}{GitHubDomain}/{GitHubUser}/{GitHubRepo}/"
                % p_source_key_prefix.title
            ),
            "ARTIFACT_S3_BUCKET_DEFAULT": Ref(p_artifact_bucket_name),
            "ARTIFACT_S3_KEY_PREFIX_DEFAULT": Sub(
                "${%s}{GitHubDomain}/{GitHubUser}/{GitHubRepo}/"
                % p_artifact_key_prefix.title
            ),
            "GH_URL": Ref(p_github_url),
            "GH_API_URL": Ref(p_github_api_url),
            "GH_APP_ID": Ref(p_github_app_id),
            "GH_APP_CLIENT_ID": Ref(p_github_client_id),
            "GH_APP_CLIENT_SECRET_PARAM_NAME": Ref(p_github_client_secret_param_name),
            "GH_APP_HMAC_SECRET_PARAM_NAME": Ref(p_github_webhook_secret_param_name),
            "GH_APP_PRIVATE_KEY_PARAM_NAME": Ref(p_github_app_private_key_param_name),
            "GITHUB_USE_CHECKS": Ref(p_github_use_checks),
            "SESSION_SECRETS_PARAM_NAME": Ref(p_session_secrets_param_name),
            "SECRETS_KMS_ARN": If(
                "DoCreateKMSKey",
                Sub(ac_kms.ARN(
                    resource = "key/${%s}" % r_secrets_kms_key.title,
                    region = vAWSRegion,
                    account = vAWSAccountId,
                )),
                Ref(p_secrets_kms_arn),
            ),
        }
    )

    r_webhook_lambda = t.add_resource(Function(
        "WebhookLambda",
        Description = "Handles webhook API requests",
        Code = Code(
            S3Bucket = Ref(p_lambda_zip_s3_bucket),
            S3Key = Ref(p_lambda_zip_s3_key),
        ),
        Handler = "src/lambda/webhook/index.handler",
        MemorySize = 128,
        Role = GetAtt(r_webhook_lambda_role, "Arn"),
        Runtime = "nodejs8.10",
        Timeout = 60,
        Environment = lambda_env_vars,
        Tags = tags,
    ))

    r_api_lambda = t.add_resource(Function(
        "ApiLambda",
        Description = "Handles general API requests",
        Code = Code(
            S3Bucket = Ref(p_lambda_zip_s3_bucket),
            S3Key = Ref(p_lambda_zip_s3_key),
        ),
        Handler = "src/lambda/api/index.handler",
        MemorySize = 128,
        Role = GetAtt(r_api_lambda_role, "Arn"),
        Runtime = "nodejs8.10",
        Timeout = 60,
        Environment = lambda_env_vars,
        Tags = tags,
    ))

    r_step_lambda = t.add_resource(Function(
        "StepLambda",
        Description = "Manages the execution of CodeBuilds for a commit",
        Code = Code(
            S3Bucket = Ref(p_lambda_zip_s3_bucket),
            S3Key = Ref(p_lambda_zip_s3_key),
        ),
        Handler = "src/lambda/execution/index.handler",
        MemorySize = 128,
        Role = GetAtt(r_step_lambda_role, "Arn"),
        Runtime = "nodejs8.10",
        Timeout = 60,
        Environment = lambda_env_vars,
        Tags = tags,
    ))

    def create_lambda_log_group(lambda_function, role):
        log_group = t.add_resource(LogGroup(
            "%sLogGroup" % Name(lambda_function).data,
            LogGroupName = Sub(
                "/aws/lambda/${%s}" % lambda_function.title,
            ),
            RetentionInDays = Ref(p_logs_retention_days),
        ))

        t.add_resource(PolicyType(
            "%sLogGroupPolicy" % Name(lambda_function).data,
            Roles = [
                Ref(role),
            ],
            PolicyName = Sub(
                "${%s}-policy"
                % Name(role).data,
            ),
            PolicyDocument = PolicyDocument(
                Version = "2012-10-17",
                Statement = [
                    Statement(
                        Effect = Allow,
                        Resource = [
                            GetAtt(log_group, "Arn"),
                        ],
                        Action = [
                            ac_logs.CreateLogGroup,
                            ac_logs.CreateLogStream,
                            ac_logs.PutLogEvents,
                        ],
                    )
                ]
            ),
        ))

        return log_group

    create_lambda_log_group(r_webhook_lambda, r_webhook_lambda_role)
    create_lambda_log_group(r_api_lambda, r_api_lambda_role)
    create_lambda_log_group(r_step_lambda, r_step_lambda_role)

    r_state_machine_execution_role = t.add_resource(Role(
        "StateMachineExecutionRole",
        Path = "/service-role/",
        AssumeRolePolicyDocument = PolicyDocument(
            Statement = [
                Statement(
                    Effect = Allow,
                    Action = [ac_sts.AssumeRole],
                    Principal = Principal(
                        "Service",
                        Sub(
                            "states.%s.amazonaws.com"
                            % vAWSRegion
                        ),
                    ),
                ),
            ],
        ),
        Policies = [
            Policy(
                PolicyName = "states-execution-policy",
                PolicyDocument = PolicyDocument(
                    Version = "2012-10-17",
                    Statement = [
                        Statement(
                            Effect = Allow,
                            Resource = [
                                GetAtt(r_step_lambda, "Arn"),
                            ],
                            Action = [
                                ac_lambda.InvokeFunction,
                            ],
                        ),
                    ],
                ),
            ),
        ],
    ))

    r_build_state_machine = t.add_resource(StateMachine(
        "BuildStateMachine",
        StateMachineName = Sub("${AWS::StackName}-statemachine"),
        RoleArn = GetAtt(r_state_machine_execution_role, "Arn"),
        DefinitionString = Sub(state_machine_definition),
    ))

    # Allow the API to start step functions.
    t.add_resource(PolicyType(
        "StepLambdaStateMachinePolicy",
        Roles = [
            Ref(r_webhook_lambda_role),
            Ref(r_api_lambda_role),
        ],
        PolicyName = Sub(
            "${%s.Name}-policy"
            % r_build_state_machine.title
        ),
        PolicyDocument = PolicyDocument(
            Version = "2012-10-17",
            Statement = [
                Statement(
                    Effect = Allow,
                    Resource = [
                        Ref(r_build_state_machine),
                    ],
                    Action = [
                        ac_states.StartExecution,
                    ],
                )
            ]
        ),
    ))

    r_rest_api_app_static_s3_role = t.add_resource(Role(
        "ApiGatewayAppStaticS3Role",
        Path = "/service-role/",
        AssumeRolePolicyDocument = PolicyDocument(
            Statement = [
                Statement(
                    Effect = Allow,
                    Action = [ac_sts.AssumeRole],
                    Principal = Principal(
                        "Service",
                        "apigateway.amazonaws.com",
                    ),
                ),
            ],
        ),
        Policies = [
            Policy(
                PolicyName = "s3-read-static-resources-policy",
                PolicyDocument = PolicyDocument(
                    Statement = [
                        Statement(
                            Effect = Allow,
                            Resource = [
                                Sub(ac_s3.ARN(
                                    resource = "${%s}/${%s}*" % (
                                        p_artifact_bucket_name.title,
                                        p_app_static_key_prefix.title,
                                    ),
                                )),
                            ],
                            Action = [
                                ac_s3.GetObject,
                            ],
                        ),
                    ],
                ),
            ),
        ],
    ))

    r_rest_api = t.add_resource(RestApi(
        "RestApi",
        DependsOn = [
            r_api_lambda,
            r_rest_api_app_static_s3_role,
            r_webhook_lambda,
        ],
        Name = Sub("${AWS::StackName}-api"),
        # Body = apigateway_swagger,
    ))

    t.add_resource(Method(
        "AppGetMethod",
        RestApiId = Ref(r_rest_api),
        ResourceId = GetAtt(r_rest_api, "RootResourceId"),
        HttpMethod = "GET",
        AuthorizationType = "NONE",
        MethodResponses = [
            MethodResponse(
                StatusCode = "200",
                ResponseParameters = {
                    "method.response.header.Content-Type": True,
                },
            ),
        ],
        Integration = Integration(
            Type = "AWS",
            Credentials = GetAtt(r_rest_api_app_static_s3_role, "Arn"),
            IntegrationHttpMethod = "GET",
            PassthroughBehavior = "WHEN_NO_TEMPLATES",
            Uri = Sub(
                "arn:aws:apigateway:%s:s3:path/%s/%s"
                % (
                    "${AWS::Region}",
                    "${ArtifactBucketName}",
                    "${AppStaticKeyPrefix}index.html",
                )
            ),
            IntegrationResponses = [
                IntegrationResponse(
                    StatusCode = "200",
                    ResponseParameters = {
                        "method.response.header.Content-Type":
                            "integration.response.header.Content-Type",
                    },
                ),
            ],
        ),
    ))

    r_app_resource = t.add_resource(Resource(
        "AppResource",
        RestApiId = Ref(r_rest_api),
        PathPart = "static",
        ParentId = GetAtt(r_rest_api, "RootResourceId"),
    ))

    r_app_proxy_resource = t.add_resource(Resource(
        "AppProxyResource",
        RestApiId = Ref(r_rest_api),
        PathPart = "{item}",
        ParentId = Ref(r_app_resource),
    ))

    t.add_resource(Method(
        "AppProxyMethod",
        RestApiId = Ref(r_rest_api),
        ResourceId = Ref(r_app_proxy_resource),
        HttpMethod = "GET",
        AuthorizationType = "NONE",
        RequestParameters = {
            "method.request.path.item": True,
        },
        MethodResponses = [
            MethodResponse(
                StatusCode = "200",
                ResponseParameters = {
                    "method.response.header.Content-Type": True,
                },
            ),
        ],
        Integration = Integration(
            Type = "AWS",
            Credentials = GetAtt(r_rest_api_app_static_s3_role, "Arn"),
            IntegrationHttpMethod = "GET",
            PassthroughBehavior = "WHEN_NO_TEMPLATES",
            Uri = Sub(
                "arn:aws:apigateway:%s:s3:path/%s/%s"
                % (
                    "${AWS::Region}",
                    "${ArtifactBucketName}",
                    "${AppStaticKeyPrefix}{object}",
                )
            ),
            RequestParameters = {
                "integration.request.path.object": "method.request.path.item",
            },
            IntegrationResponses = [
                IntegrationResponse(
                    StatusCode = "200",
                    ResponseParameters = {
                        "method.response.header.Content-Type":
                            "integration.response.header.Content-Type",
                    },
                ),
            ],
        ),
    ))

    r_webhook_resource = t.add_resource(Resource(
        "WebhookResource",
        RestApiId = Ref(r_rest_api),
        PathPart = "webhook",
        ParentId = GetAtt(r_rest_api, "RootResourceId"),
    ))

    r_webhook_proxy_resource = t.add_resource(Resource(
        "WebhookProxyResource",
        RestApiId = Ref(r_rest_api),
        PathPart = "{proxy+}",
        ParentId = Ref(r_webhook_resource),
    ))

    t.add_resource(Method(
        "WebhookProxyMethod",
        RestApiId = Ref(r_rest_api),
        ResourceId = Ref(r_webhook_proxy_resource),
        HttpMethod = "ANY",
        AuthorizationType = "NONE",
        Integration = Integration(
            Type = "AWS_PROXY",
            IntegrationHttpMethod = "POST",
            PassthroughBehavior = "WHEN_NO_TEMPLATES",
            Uri = Sub(
                "arn:aws:apigateway:%s:lambda:path/2015-03-31/functions/%s/invocations"
                % (
                    "${AWS::Region}",
                    "${%s.Arn}" % r_webhook_lambda.title,
                )
            ),
            IntegrationResponses = [
                IntegrationResponse(
                    StatusCode = "200",
                ),
            ],
        ),
    ))

    t.add_resource(Permission(
        "WebhookLambdaInvokePermission",
        Action = "lambda:InvokeFunction",
        Principal = "apigateway.amazonaws.com",
        FunctionName = GetAtt(r_webhook_lambda, "Arn"),
        SourceArn = Sub(
            ac_execute_api.ARN(
                resource = "${%s}/*/*/webhook/*" % r_rest_api.title,
                region = vAWSRegion,
                account = vAWSAccountId,
            ),
        ),
    ))

    r_api_resource = t.add_resource(Resource(
        "ApiResource",
        RestApiId = Ref(r_rest_api),
        PathPart = "api",
        ParentId = GetAtt(r_rest_api, "RootResourceId"),
    ))

    r_api_proxy_resource = t.add_resource(Resource(
        "ApiProxyResource",
        RestApiId = Ref(r_rest_api),
        PathPart = "{proxy+}",
        ParentId = Ref(r_api_resource),
    ))

    t.add_resource(Method(
        "ApiProxyMethod",
        RestApiId = Ref(r_rest_api),
        ResourceId = Ref(r_api_proxy_resource),
        HttpMethod = "ANY",
        AuthorizationType = "NONE",
        Integration = Integration(
            Type = "AWS_PROXY",
            IntegrationHttpMethod = "POST",
            PassthroughBehavior = "WHEN_NO_TEMPLATES",
            Uri = Sub(
                "arn:aws:apigateway:%s:lambda:path/2015-03-31/functions/%s/invocations"
                % (
                    "${AWS::Region}",
                    "${%s.Arn}" % r_api_lambda.title,
                )
            ),
            IntegrationResponses = [
                IntegrationResponse(
                    StatusCode = "200",
                ),
            ],
        ),
    ))

    t.add_resource(Permission(
        "ApiLambdaInvokePermission",
        Action = "lambda:InvokeFunction",
        Principal = "apigateway.amazonaws.com",
        FunctionName = GetAtt(r_api_lambda, "Arn"),
        SourceArn = Sub(
            ac_execute_api.ARN(
                resource = "${%s}/*/*/api/*" % r_rest_api.title,
                region = vAWSRegion,
                account = vAWSAccountId,
            ),
        ),
    ))

    t.add_output(Output(
        "SecretsKMSArn",
        Value = If(
            "DoCreateKMSKey",
            Sub(ac_kms.ARN(
                resource = "key/${%s}" % r_secrets_kms_key.title,
                region = vAWSRegion,
                account = vAWSAccountId,
            )),
            Ref(p_secrets_kms_arn),
        ),
    ))

    t.add_output(Output(
        "SecretsKMSAlias",
        Value = If(
            "DoCreateKMSKey",
            Ref(r_secrets_kms_key_alias),
            "N/A",
        ),
    ))

    t.add_output(Output(
        "RestApiId",
        Value = Ref(r_rest_api),
    ))

    t.add_output(Output(
        "BuildStateMachine",
        Value = Ref(r_build_state_machine),
    ))

    t.add_output(Output(
        "WebhookLambda",
        Value = Ref(r_webhook_lambda),
    ))

    t.add_output(Output(
        "WebhookLambdaRole",
        Value = Ref(r_webhook_lambda_role),
    ))

    t.add_output(Output(
        "ApiLambda",
        Value = Ref(r_api_lambda),
    ))

    t.add_output(Output(
        "ApiLambdaRole",
        Value = Ref(r_api_lambda_role),
    ))

    t.add_output(Output(
        "StepLambda",
        Value = Ref(r_step_lambda),
    ))

    t.add_output(Output(
        "StepLambdaRole",
        Value = Ref(r_step_lambda_role),
    ))

    return t
