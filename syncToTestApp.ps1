
function Sync-Destination {
  Param([String]$AppDir)
  
  $destDir = "$AppDir/node_modules/@itwin/mobile-sdk-core"
  
  # If destDir is a symlink, it probably came from npm link or a file: package.json reference. Delete the link.
  $isSymlink = ((Get-Item $destDir).Attributes.ToString() -match "ReparsePoint")
  if ($isSymlink) {
    Get-Item $destDir | %{$_.Delete()}
  }
  
  # If node_modules exists in destDir, that means that the module was installed by npm; nuke the install.
  if (Test-Path -Path "$destDir/node_modules") {
    Remove-Item $destDir -Recurse
  }
  
  if (-Not (Test-Path -Path $destDir)) {
    New-Item -ItemType "directory" -Path $destDir
  }
  
  # sync the wanted subdirectories 
  foreach ($dir in "lib", "src") {
    ROBOCOPY $dir "$destDir/$dir" /MIR
  }
  # Copy the wanted files
  foreach ($file in "LICENSE.md", "package.json", "README.md") {
    Copy-Item $file -Destination $destDir
  }
}

if ($args[0] -ne $null) {
  $appDir = $args[0]
} elseif ($Env:ITM_TEST_APP_DIR -ne $null) {
  $appDir = $Env:ITM_TEST_APP_DIR
} elseif (Test-Path -Path "../mobile-samples/cross-platform/react-app") {
  $appDir = "../mobile-samples/cross-platform/react-app"
} else {
  echo "Destination must be specified either as argument or in ITM_TEST_APP_DIR variable."
  exit 1
}

Sync-Destination -AppDir $appDir
Sync-Destination -AppDir "../mobile-ui-react"
