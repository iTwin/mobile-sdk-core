# Package Versions in package.json Files

Apps built using the iTwin Mobile SDK will make use of many npm packages from
[`itwinjs-core`](https://github.com/iTwin/itwinjs-core), but they may also make use of many npm
packages that have an `@itwin/` prefix but aren't part of `itwinjs-core`. It can be difficult to
know which packages use the `itwinjs-core` version, and which don't. The mobile sample app makes use
of the following npm packages that have an `@itwin/` prefix but aren't part of `itwinjs-core`, split
into groups based on origin:

## iTwin Mobile SDK packages:
* `@itwin/mobile-sdk-core`
* `@itwin/mobile-ui-react`

## [iTwin appui](https://github.com/iTwin/appui) packages:
* `@itwin/appui-layout-react`
* `@itwin/appui-react`
* `@itwin/components-react`
* `@itwin/core-react`
* `@itwin/imodel-components-react`

__Note:__ `@itwin/appui-abstract` is part of `itwinjs-core`, and __not__ part of `@itwin/appui`.

## [iTwin imodels-access](https://github.com/iTwin/imodels-clients/tree/main/itwin-platform-access) packages:
* `@itwin/imodels-access-backend`
* `@itwin/imodels-access-frontend`

## [iTwin imodels-clients](https://github.com/iTwin/imodels-clients) package:
* `@itwin/imodels-client-management`

__Note:__ Even though the imodels-access packages are in the imodels-client GitHub repository, they
are maintained separately, and can have different version numbers.

## [iTwin presentation](https://github.com/iTwin/presentation) package:
* `@itwin/presentation-components`

## Miscellaneous packages:
* `@itwin/eslint-plugin`
* `@itwin/itwins-client`
* `@itwin/measure-tools-react`

If you use any or all of the above packages, you need to make sure to use a version that is
compatible with the version of `itwinjs-core` that is being used by your app. The `itwinjs-core`
version is determined by the version of iTwin Mobile SDK that you are using. The easiest way to find
the right versions is to look in the `cross-platform/react-app/package.json` file from the
`@itwin/mobile-samples` [GitHub repository](https://github.com/iTwin/mobile-samples).

Make sure to look at the version of that file that matches the version of the iTwin Mobile SDK that
you are using. For example, the version of the file for the iTwin Mobile SDK version 0.20.2 is
[here](https://github.com/iTwin/mobile-samples/blob/0.20.2/cross-platform/react-app/package.json).

All other npm packages with an `@itwin/` prefix should contain the `itwinjs-core` version that
corresponds to the given iTwin Mobile SDK release. You can see that version in the `package.json`
file above. Look at the version used by `@itwin/core-common`.
