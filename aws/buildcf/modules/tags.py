from troposphere import \
    Parameter, Tags, \
    Ref, \
    NoValue, If, Equals, Not, Or, \
    encode_to_dict


class TagsList(Tags):
    def __init__(self, *args):
        self.tags = []
        for v in args:
            self.tags.append(v)

    def to_dict(self):
        return [encode_to_dict(tag) for tag in self.tags]


def build_tags_list(t):
    has_conditions = []
    tags_list = []
    for x in range(1, 11):
        name = t.add_parameter(Parameter(
            "Tag%sName" % x,
            Type = "String",
            Default = "-NONE-",
        ))

        value = t.add_parameter(Parameter(
            "Tag%sValue" % x,
            Type = "String",
            Default = "-NONE-",
        ))

        t.add_condition(
            "HasTag%s" % x,
            Not(
                Or(
                    Equals(Ref(name), "-NONE-"),
                    Equals(Ref(value), "-NONE-"),
                ),
            ),
        )

        has_conditions.append({
            "Fn::Condition": "HasTag%s" % x
        })

        tags_list.append(
            If(
                "HasTag%s" % x,
                {
                    "Key": Ref(name),
                    "Value": Ref(value),
                },
                NoValue,
            ),
        )

    t.add_condition(
        "HasTags",
        Or(*has_conditions),
    )

    return If(
        "HasTags",
        TagsList(
            *tags_list
        ),
        NoValue,
    )
