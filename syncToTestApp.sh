#! /bin/zsh

function sync_to_dest {
  destDir=${1}/node_modules/@itwin/mobile-core
  # If destDir is a symlink, it probably came from nmp link or a file: package.json reference. Delete the link.
  [ -L "${destDir}" ] && rm "${destDir}"
  [ -d "${destDir}" ] || mkdir -p "${destDir}"
  rsync -aL --delete lib LICENSE.md package.json README.md "${destDir}/"
}

if [ "$1" != "" ]; then
  sync_to_dest $1
elif [ "$ITM_TEST_APP_DIR" != "" ]; then
  sync_to_dest $ITM_TEST_APP_DIR
  cd "../itwin-mobileui-react"
  [ -d lib ] && ./syncToTestApp.sh
  cd -
fi
sync_to_dest "../itwin-mobileui-react"
