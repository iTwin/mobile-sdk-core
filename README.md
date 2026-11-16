# iTwin mobile-sdk-core

Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](./LICENSE.md) for license terms and full copyright notice.

## Warning

This is pre-release software and provided as-is.

## About this Repository

This repository contains the core npm module for creating [iTwin.js](http://www.itwinjs.org) applications on mobile devices via [iTwin/mobile-sdk-ios](https://github.com/iTwin/mobile-sdk-ios) and [iTwin/mobile-sdk-android](https://github.com/iTwin/mobile-sdk-android). See [iTwin/mobile-ui-react](https://github.com/iTwin/mobile-ui-react) for React-specific mobile functionality and [iTwin/mobile-samples](https://github.com/iTwin/mobile-samples) for sample iOS and Android apps.

Please see [VERSIONS.md](./VERSIONS.md) for instructions on determining the proper version for npm
modules with an `@itwin/` prefix.

## Frontend messaging

`Messenger` exchanges queries and responses with the native Android/iOS SDK using authenticated
document sessions. Query data is snapshotted when submitted; startup queries wait for the
document handshake. Query failures, document
teardown, and session replacement reject pending Promises.

Only the configured main frame is authorized. This does not
isolate trusted-origin scripts from each other or protect against trusted-origin XSS.

Run `npm test` for the focused Android/iOS frontend transport contract tests (including the build)
and `npm run lint` for the package lint gate.
