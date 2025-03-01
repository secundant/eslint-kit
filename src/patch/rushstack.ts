// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// This is a workaround for https://github.com/eslint/eslint/issues/3458

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import fs from 'fs'
import path from 'path'

const isModuleResolutionError: (ex: unknown) => boolean = (ex) =>
  typeof ex === 'object' &&
  ex !== null &&
  'code' in ex &&
  (ex as { code: unknown }).code === 'MODULE_NOT_FOUND'

// Module path for eslintrc.cjs
// Example: ".../@eslint/eslintrc/dist/eslintrc.cjs"
let eslintrcBundlePath: string | undefined

// Module path for config-array-factory.js
// Example: ".../@eslint/eslintrc/lib/config-array-factory"
let configArrayFactoryPath: string | undefined

// Module path for relative-module-resolver.js
// Example: ".../@eslint/eslintrc/lib/shared/relative-module-resolver"
let moduleResolverPath: string | undefined

// Folder path where ESLint's package.json can be found
// Example: ".../node_modules/eslint"
let eslintFolder: string | undefined

// Probe for the ESLint >=8.0.0 layout:
for (let currentModule = module; ; ) {
  if (!eslintrcBundlePath) {
    // For ESLint >=8.0.0, all @eslint/eslintrc code is bundled at this path:
    //   .../@eslint/eslintrc/dist/eslintrc.cjs
    try {
      const eslintrcFolder = path.dirname(
        require.resolve('@eslint/eslintrc/package.json', {
          paths: [currentModule.path],
        })
      )

      // Make sure we actually resolved the module in our call path
      // and not some other spurious dependency.
      if (
        path.join(eslintrcFolder, 'dist/eslintrc.cjs') ===
        currentModule.filename
      ) {
        eslintrcBundlePath = path.join(eslintrcFolder, 'dist/eslintrc.cjs')
      }
    } catch (error: unknown) {
      // Module resolution failures are expected, as we're walking
      // up our require stack to look for eslint. All other errors
      // are rethrown.
      if (!isModuleResolutionError(error)) {
        throw error
      }
    }
  } else {
    // Next look for a file in ESLint's folder
    //   .../eslint/lib/cli-engine/cli-engine.js
    try {
      const eslintCandidateFolder = path.dirname(
        require.resolve('eslint/package.json', {
          paths: [currentModule.path],
        })
      )

      // Make sure we actually resolved the module in our call path
      // and not some other spurious dependency.
      if (
        path.join(eslintCandidateFolder, 'lib/cli-engine/cli-engine.js') ===
        currentModule.filename
      ) {
        eslintFolder = eslintCandidateFolder
        break
      }
    } catch (error: unknown) {
      // Module resolution failures are expected, as we're walking
      // up our require stack to look for eslint. All other errors
      // are rethrown.
      if (!isModuleResolutionError(error)) {
        throw error
      }
    }
  }

  if (!currentModule.parent) {
    break
  }
  currentModule = currentModule.parent
}

if (!eslintFolder) {
  // Probe for the ESLint >=7.8.0 layout:
  for (let currentModule = module; ; ) {
    if (!configArrayFactoryPath) {
      // For ESLint >=7.8.0, config-array-factory.js is at this path:
      //   .../@eslint/eslintrc/lib/config-array-factory.js
      try {
        const eslintrcFolder = path.dirname(
          require.resolve('@eslint/eslintrc/package.json', {
            paths: [currentModule.path],
          })
        )

        if (
          path.join(eslintrcFolder, '/lib/config-array-factory.js') ===
          currentModule.filename
        ) {
          configArrayFactoryPath = path.join(
            eslintrcFolder,
            'lib/config-array-factory.js'
          )
          moduleResolverPath = path.join(
            eslintrcFolder,
            'lib/shared/relative-module-resolver'
          )
        }
      } catch (error: unknown) {
        // Module resolution failures are expected, as we're walking
        // up our require stack to look for eslint. All other errors
        // are rethrown.
        if (!isModuleResolutionError(error)) {
          throw error
        }
      }
    } else {
      // Next look for a file in ESLint's folder
      //   .../eslint/lib/cli-engine/cli-engine.js
      try {
        const eslintCandidateFolder = path.dirname(
          require.resolve('eslint/package.json', {
            paths: [currentModule.path],
          })
        )

        if (
          path.join(eslintCandidateFolder, 'lib/cli-engine/cli-engine.js') ===
          currentModule.filename
        ) {
          eslintFolder = eslintCandidateFolder
          break
        }
      } catch (error: unknown) {
        // Module resolution failures are expected, as we're walking
        // up our require stack to look for eslint. All other errors
        // are rethrown.
        if (!isModuleResolutionError(error)) {
          throw error
        }
      }
    }

    if (!currentModule.parent) {
      break
    }
    currentModule = currentModule.parent
  }
}

if (!eslintFolder) {
  // Probe for the <7.8.0 layout:
  for (let currentModule = module; ; ) {
    // For ESLint <7.8.0, config-array-factory.js was at this path:
    //   .../eslint/lib/cli-engine/config-array-factory.js
    if (
      /[\\/]eslint[\\/]lib[\\/]cli-engine[\\/]config-array-factory\.js$/i.test(
        currentModule.filename
      )
    ) {
      eslintFolder = path.join(path.dirname(currentModule.filename), '../..')
      configArrayFactoryPath = path.join(
        eslintFolder,
        'lib/cli-engine/config-array-factory'
      )
      moduleResolverPath = path.join(
        eslintFolder,
        'lib/shared/relative-module-resolver'
      )
      break
    }

    if (!currentModule.parent) {
      // This was tested with ESLint 6.1.0 .. 7.12.1.
      throw new Error(
        'Failed to patch ESLint because the calling module was not recognized.\n' +
          'If you are using a newer ESLint version that may be unsupported, please create a GitHub issue:\n' +
          'https://github.com/microsoft/rushstack/issues'
      )
    }
    currentModule = currentModule.parent
  }
}

// Detect the ESLint package version
const eslintPackageJson = fs
  .readFileSync(path.join(eslintFolder, 'package.json'))
  .toString()
const eslintPackageObject = JSON.parse(eslintPackageJson)
const eslintPackageVersion = eslintPackageObject.version
const versionMatch = /^([0-9]+)\./.exec(eslintPackageVersion) // parse the SemVer MAJOR part
if (!versionMatch) {
  throw new Error('Unable to parse ESLint version: ' + eslintPackageVersion)
}
const eslintMajorVersion = Number(versionMatch[1])
if (!(eslintMajorVersion >= 6 && eslintMajorVersion <= 8)) {
  throw new Error(
    'The patch-eslint.js script has only been tested with ESLint version 6.x, 7.x, and 8.x.' +
      ` (Your version: ${eslintPackageVersion})\n` +
      'Consider reporting a GitHub issue:\n' +
      'https://github.com/microsoft/rushstack/issues'
  )
}

interface ModuleResolver {
  resolve: (request: string, relativeTo: string) => string
}

export const ModuleResolver: ModuleResolver =
  eslintMajorVersion === 8
    ? require(eslintrcBundlePath!).Legacy.ModuleResolver
    : require(moduleResolverPath!)
