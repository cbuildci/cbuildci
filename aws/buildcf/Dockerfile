FROM python:3.6

RUN pip install \
    troposphere \
    awacs \
    pyyaml \
    yapf==0.11.0 \
    flake8 \
    autoflake \
    awscli \
    codeclimate-test-reporter \
    rainbow_logging_handler

RUN mkdir -p /app
WORKDIR /app
