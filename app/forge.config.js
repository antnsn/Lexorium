const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'assets/icon',
    platform: ['darwin'],
    arch: ['arm64'],
    osxSign: {
      identity: null, // Let electron-forge detect the identity
      'hardened-runtime': true,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
      'signature-flags': 'library'
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'lexorium',
        setupIcon: 'assets/icon.ico',
        setupExe: 'LexoriumSetup.exe'
      },
      platforms: ['win32']
    },
    {
      name: '@electron-forge/maker-zip',
      config: {
        platforms: ['darwin'],
        arch: ['arm64']
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
      platforms: ['linux']
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
      platforms: ['linux']
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'antnsn',
          name: 'lexorium'
        },
        prerelease: false,
        draft: false
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
