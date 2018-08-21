from .tags import build_tags_list

from troposphere import Template, Parameter, Ref
from troposphere.dynamodb import \
    Table, KeySchema, \
    AttributeDefinition, ProvisionedThroughput, \
    TimeToLiveSpecification, GlobalSecondaryIndex, \
    Projection


def create_template():
    t = Template()

    t.add_description("The DynamoDB tables stack for CBuildCI.")

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

    p_config_table_rcu = t.add_parameter(Parameter(
        "ConfigTableRCU",
        Type = "Number",
        Default = "5",
    ))

    p_config_table_wcu = t.add_parameter(Parameter(
        "ConfigTableWCU",
        Type = "Number",
        Default = "1",
    ))

    p_locks_table_rcu = t.add_parameter(Parameter(
        "LocksTableRCU",
        Type = "Number",
        Default = "5",
    ))

    p_locks_table_wcu = t.add_parameter(Parameter(
        "LocksTableWCU",
        Type = "Number",
        Default = "2",
    ))

    p_sessions_table_rcu = t.add_parameter(Parameter(
        "SessionsTableRCU",
        Type = "Number",
        Default = "5",
    ))

    p_sessions_table_wcu = t.add_parameter(Parameter(
        "SessionsTableWCU",
        Type = "Number",
        Default = "2",
    ))

    p_executions_table_rcu = t.add_parameter(Parameter(
        "ExecutionsTableRCU",
        Type = "Number",
        Default = "15",
    ))

    p_executions_table_wcu = t.add_parameter(Parameter(
        "ExecutionsTableWCU",
        Type = "Number",
        Default = "5",
    ))

    p_executions_search_indexes_rcu = t.add_parameter(Parameter(
        "ExecutionsSearchIndexesRCU",
        Type = "Number",
        Default = "5",
    ))

    p_executions_search_indexes_wcu = t.add_parameter(Parameter(
        "ExecutionsSearchIndexesWCU",
        Type = "Number",
        Default = "1",
    ))

    # Replace with custom tags if desired.
    tags = build_tags_list(t)

    t.add_resource(Table(
        "ConfigDBTable",
        DeletionPolicy = "Retain",
        TableName = Ref(p_config_table_name),
        KeySchema = [
            KeySchema(
                KeyType = "HASH",
                AttributeName = "id",
            ),
        ],
        AttributeDefinitions = [
            AttributeDefinition(
                AttributeName = "id",
                AttributeType = "S",
            ),
        ],
        ProvisionedThroughput = ProvisionedThroughput(
            ReadCapacityUnits = Ref(p_config_table_rcu),
            WriteCapacityUnits = Ref(p_config_table_wcu)
        ),
        Tags = tags,
    ))

    t.add_resource(Table(
        "LocksTable",
        DeletionPolicy = "Retain",
        TableName = Ref(p_locks_table_name),
        KeySchema = [
            KeySchema(
                KeyType = "HASH",
                AttributeName = "id",
            ),
        ],
        AttributeDefinitions = [
            AttributeDefinition(
                AttributeName = "id",
                AttributeType = "S",
            ),
        ],
        ProvisionedThroughput = ProvisionedThroughput(
            ReadCapacityUnits = Ref(p_locks_table_rcu),
            WriteCapacityUnits = Ref(p_locks_table_wcu)
        ),
        Tags = tags,
    ))

    t.add_resource(Table(
        "SessionsTable",
        DeletionPolicy = "Retain",
        TableName = Ref(p_sessions_table_name),
        KeySchema = [
            KeySchema(
                KeyType = "HASH",
                AttributeName = "id",
            ),
        ],
        AttributeDefinitions = [
            AttributeDefinition(
                AttributeName = "id",
                AttributeType = "S",
            ),
        ],
        ProvisionedThroughput = ProvisionedThroughput(
            ReadCapacityUnits = Ref(p_sessions_table_rcu),
            WriteCapacityUnits = Ref(p_sessions_table_wcu)
        ),
        TimeToLiveSpecification = TimeToLiveSpecification(
            Enabled = True,
            AttributeName = "ttlTime",
        ),
        Tags = tags,
    ))

    t.add_resource(Table(
        "ExecutionsTable",
        DeletionPolicy = "Retain",
        TableName = Ref(p_executions_table_name),
        KeySchema = [
            KeySchema(
                KeyType = "HASH",
                AttributeName = "repoId",
            ),
            KeySchema(
                KeyType = "RANGE",
                AttributeName = "executionId",
            ),
        ],
        AttributeDefinitions = [
            AttributeDefinition(
                AttributeName = "repoId",
                AttributeType = "S",
            ),
            AttributeDefinition(
                AttributeName = "executionId",
                AttributeType = "S",
            ),
            AttributeDefinition(
                AttributeName = "createTime",
                AttributeType = "S",
            ),
        ],
        ProvisionedThroughput = ProvisionedThroughput(
            ReadCapacityUnits = Ref(p_executions_table_rcu),
            WriteCapacityUnits = Ref(p_executions_table_wcu)
        ),
        Tags = tags,
        GlobalSecondaryIndexes = [
            GlobalSecondaryIndex(
                IndexName = "search-repoId-createTime-index",
                KeySchema = [
                    KeySchema(
                        KeyType = "HASH",
                        AttributeName = "repoId",
                    ),
                    KeySchema(
                        KeyType = "RANGE",
                        AttributeName = "createTime",
                    ),
                ],
                Projection = Projection(
                    NonKeyAttributes = [
                        "repoId",
                        "executionId",
                        "createTime",
                        "updateTime",
                        "status",
                        "conclusion",
                        "conclusionTime",
                        "meta",
                    ],
                    ProjectionType = "INCLUDE",
                ),
                ProvisionedThroughput = ProvisionedThroughput(
                    ReadCapacityUnits = Ref(p_executions_search_indexes_rcu),
                    WriteCapacityUnits = Ref(p_executions_search_indexes_wcu),
                ),
            ),
            GlobalSecondaryIndex(
                IndexName = "search-repoId-executionId-index",
                KeySchema = [
                    KeySchema(
                        KeyType = "HASH",
                        AttributeName = "repoId",
                    ),
                    KeySchema(
                        KeyType = "RANGE",
                        AttributeName = "executionId",
                    ),
                ],
                Projection = Projection(
                    NonKeyAttributes = [
                        "repoId",
                        "executionId",
                        "createTime",
                        "updateTime",
                        "status",
                        "conclusion",
                        "conclusionTime",
                        "meta",
                    ],
                    ProjectionType = "INCLUDE",
                ),
                ProvisionedThroughput = ProvisionedThroughput(
                    ReadCapacityUnits = Ref(p_executions_search_indexes_rcu),
                    WriteCapacityUnits = Ref(p_executions_search_indexes_wcu),
                ),
            ),
        ],
    ))

    return t
