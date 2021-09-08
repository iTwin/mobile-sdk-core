#! /bin/zsh

function sync_to_dest {
  destDir=${1}/node_modules/@itwin/mobile-core
  # If destDir is a symlink, it probably came from nmp link or a file: package.json reference. Delete the link.
  [ -L "${destDir}" ] && rm "${destDir}"
  [ -d "${destDir}" ] || mkdir -p "${destDir}"
  rsync -aL --delete lib LICENSE.md package.json README.md "${destDir}/"
}

if [ "$1" != "" ]; then
  appDir=$1
elif [ "$ITM_TEST_APP_DIR" != "" ]; then
  appDir=$ITM_TEST_APP_DIR
elif [ -d "../mobile-sdk-samples/iOS/MobileStarter/react-app" ]; then
  appDir=../mobile-sdk-samples/iOS/MobileStarter/react-app
fi

sync_to_dest $appDir
sync_to_dest "../mobile-ui-react"
