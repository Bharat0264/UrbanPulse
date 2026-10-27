#!/usr/bin/env bash
# Source this from the urbanpulse directory before Spark commands.
if [ -d "$PWD/.runtime" ]; then
  for candidate in "$PWD"/.runtime/jdk*/Contents/Home; do
    if [ -x "$candidate/bin/java" ]; then export JAVA_HOME="$candidate"; break; fi
  done
fi
export SPARK_LOCAL_IP=127.0.0.1
export PYSPARK_PYTHON="$PWD/.venv/bin/python"
