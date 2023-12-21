import {
  testApp,
  testAppConfigExtensions,
  testFunctionExtension,
  testTaxCalculationExtension,
  testThemeExtensions,
  testUIExtension,
  testWebPixelExtension,
  testWebhookExtensions,
} from '../app/app.test-data.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'
import {ExtensionBuildOptions} from '../../services/build/extension.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {Writable} from 'stream'

function functionConfiguration(): FunctionConfigType {
  return {
    name: 'foo',
    type: 'function',
    api_version: '2023-07',
    configuration_ui: true,
    metafields: [],
    build: {},
  }
}

describe('watchPaths', async () => {
  test('returns an array for a single path', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: 'src/single-path.foo',
    }
    const extensionInstance = await testFunctionExtension({
      config,
      dir: 'foo',
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual([joinPath('foo', 'src', 'single-path.foo'), joinPath('foo', '**', '!(.)*.graphql')])
  })

  test('returns default paths for javascript', async () => {
    const config = functionConfiguration()
    config.build = {}
    const extensionInstance = await testFunctionExtension({
      config,
      entryPath: 'src/index.js',
      dir: 'foo',
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual([joinPath('foo', 'src', '**', '*.{js,ts}'), joinPath('foo', '**', '!(.)*.graphql')])
  })

  test('returns js and ts paths for esbuild extensions', async () => {
    const extensionInstance = await testUIExtension({directory: 'foo'})

    const got = extensionInstance.watchPaths

    expect(got).toEqual([joinPath('foo', 'src', '**', '*.{ts,tsx,js,jsx}')])
  })

  test('return empty array for non-function non-esbuild extensions', async () => {
    const extensionInstance = await testTaxCalculationExtension('foo')

    const got = extensionInstance.watchPaths

    expect(got).toEqual([])
  })

  test('returns configured paths and input query', async () => {
    const config = functionConfiguration()
    config.build = {
      watch: ['src/**/*.rs', 'src/**/*.foo'],
    }
    const extensionInstance = await testFunctionExtension({
      config,
      dir: 'foo',
    })

    const got = extensionInstance.watchPaths

    expect(got).toEqual([
      joinPath('foo', 'src/**/*.rs'),
      joinPath('foo', 'src/**/*.foo'),
      joinPath('foo', '**', '!(.)*.graphql'),
    ])
  })

  test('returns null if not javascript and not configured', async () => {
    const config = functionConfiguration()
    config.build = {}
    const extensionInstance = await testFunctionExtension({
      config,
    })

    const got = extensionInstance.watchPaths

    expect(got).toBeNull()
  })
})

describe('isDraftable', () => {
  test('returns false for theme extensions', async () => {
    const extensionInstance = await testThemeExtensions()

    const got1 = extensionInstance.isDraftable()

    expect(got1).toBe(false)
  })

  test('returns false for app config extensions', async () => {
    const extensionInstance = await testAppConfigExtensions()

    const got1 = extensionInstance.isDraftable()

    expect(got1).toBe(false)
  })

  test('returns true for web pixel extensions', async () => {
    const extensionInstance = await testWebPixelExtension()

    const got = extensionInstance.isDraftable()

    expect(got).toBe(true)
  })

  test('returns true for ui extensions', async () => {
    const extensionInstance = await testUIExtension()

    const got = extensionInstance.isDraftable()

    expect(got).toBe(true)
  })

  test('returns true for functions', async () => {
    const extensionInstance = await testFunctionExtension()

    const got = extensionInstance.isDraftable()

    expect(got).toBe(true)
  })
})

describe('build', async () => {
  test('creates a valid JS file for tax calculation extensions', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionInstance = await testTaxCalculationExtension(tmpDir)
      const options: ExtensionBuildOptions = {
        stdout: new Writable(),
        stderr: new Writable(),
        app: testApp(),
        environment: 'production',
      }

      const outputFilePath = joinPath(tmpDir, `dist/${extensionInstance.outputFileName}`)

      // When
      await extensionInstance.build(options)

      // Then
      const outputFileContent = await readFile(outputFilePath)
      expect(outputFileContent).toEqual('(()=>{})();')
    })
  })
})

describe('deployConfig', async () => {
  test('returns deployConfig when defined', async () => {
    const extensionInstance = await testThemeExtensions()

    const got = await extensionInstance.deployConfig({token: 'token', apiKey: 'apiKey'})

    expect(got).toMatchObject({theme_extension: {files: {}}})
  })

  test('returns transformed config when defined', async () => {
    const extensionInstance = await testAppConfigExtensions()

    const got = await extensionInstance.deployConfig({token: 'token', apiKey: 'apiKey'})

    expect(got).toMatchObject({embedded: true})
  })

  test('returns undefined when the transformed config is empty', async () => {
    const extensionInstance = await testAppConfigExtensions(true)

    const got = await extensionInstance.deployConfig({token: 'token', apiKey: 'apiKey'})

    expect(got).toBeUndefined()
  })
})

describe('bundleConfig', async () => {
  test('returns the uuid from extensions when the extension is uuid managed', async () => {
    const extensionInstance = await testThemeExtensions()

    const got = await extensionInstance.bundleConfig({
      identifiers: {
        extensions: {'theme-extension-name': 'theme-uuid'},
        extensionIds: {},
        app: 'My app',
        extensionsNonUuidManaged: {},
      },
      token: 'token',
      apiKey: 'apiKey',
    })

    expect(got).toEqual(
      expect.objectContaining({
        uuid: 'theme-uuid',
      }),
    )
  })

  test('returns the uuid from extensionsNonUuidManaged when the extension is not uuid managed', async () => {
    const extensionInstance = await testAppConfigExtensions()

    const got = await extensionInstance.bundleConfig({
      identifiers: {
        extensions: {},
        extensionIds: {},
        app: 'My app',
        extensionsNonUuidManaged: {'point-of-sale': 'uuid'},
      },
      token: 'token',
      apiKey: 'apiKey',
    })

    expect(got).toEqual(
      expect.objectContaining({
        uuid: 'uuid',
      }),
    )
  })

  test.only('returns arrays formatted properly inside the config', async () => {
    const extensionInstance = await testWebhookExtensions()

    const got = await extensionInstance.bundleConfig({
      identifiers: {
        extensions: {},
        extensionIds: {},
        app: 'My app',
        extensionsNonUuidManaged: {webhooks: 'uuid'},
      },
      token: 'token',
      apiKey: 'apiKey',
    })

    expect(got).toEqual(
      expect.objectContaining({
        config: '{"subscriptions":[{"endpoint":"https://my-app.com/webhooks/my-neat-path","topic":"orders/delete"}]}',
      }),
    )
  })
})
