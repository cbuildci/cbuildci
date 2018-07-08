import cfn_flip
import argparse
import os
import sys
sys.path.insert(0, "./")

from modules.cf_orchestrator import create_template as create_cf_orchestrator
from modules.cf_individual import create_template as create_cf_individual

parser = argparse.ArgumentParser(
    description='Create the CloudFormation templates for CBuildCI',
)

parser.add_argument(
    'outputdir',
    type=str,
    help='The path to output the CloudFormation templates',
)

args = parser.parse_args()

output_dir = os.path.normpath(os.path.join(
    os.getcwd(),
    args.outputdir,
))

if not os.path.isdir(output_dir):
    sys.stderr.write("Path specified by outputdir must be a directory")
    exit(1)

orchestrator_out = os.path.normpath(os.path.join(
    output_dir,
    "orchestrator.yaml",
))

individual_out = os.path.normpath(os.path.join(
    output_dir,
    "individual-codebuild.yaml",
))

print("Building Orchestrator CloudFormation template...")
t_orchestrator = create_cf_orchestrator()

t_orchestrator_yaml = cfn_flip.to_yaml(
    t_orchestrator.to_json(sort_keys = False),
    True,
)

print("Building Individual CloudFormation template...")
t_individual = create_cf_individual()

t_individual_yaml = cfn_flip.to_yaml(
    t_individual.to_json(sort_keys = False),
    True,
)

with open(orchestrator_out, "w") as stream:
    stream.write(t_orchestrator_yaml)
    stream.close()

with open(individual_out, "w") as stream:
    stream.write(t_individual_yaml)
    stream.close()
