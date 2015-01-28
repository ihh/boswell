#!/bin/bash
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PROCS=`ps waux | grep [s]imple-node-test-server`
if [ -z "$PROCS" ]; then
  echo "Test server not running; starting." 1>&2
  cd $DIR/..; nohup make server &
  exit 1
else
  echo "Test server is running."
fi
