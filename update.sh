#!/usr/bin/env bash

# "Temporary" update script until something more permanent is put in place
if [[ ! -O "./package.json" ]]; then
	echo "Please run as correct user"
	return 1
fi

git fetch --tags

LAST_REV=$(git rev-list --tags --max-count=1)

LAST_TAG=$(git describe --tags $LAST_REV)

git checkout $LAST_TAG --force

npm install
