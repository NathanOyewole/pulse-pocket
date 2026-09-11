const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Help pnpm
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Explicitly map the package + its subpath
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@solana-mobile/mobile-wallet-adapter-protocol': path.resolve(
    __dirname,
    'node_modules/@solana-mobile/mobile-wallet-adapter-protocol'
  ),
};

// IMPORTANT: must stay false. @solana/web3.js's dependency chain
// (rpc-websockets, @noble/hashes) isn't compatible with Metro's strict
// package.json "exports" resolution yet and crashes the bundler entirely
// ("TypeError: dependencies is not iterable") when this is true. The
// mobile-wallet-adapter-protocol "/encoding" subpath issue that this flag
// was flipped on to fix is instead handled explicitly below via
// resolveRequest, which runs before Metro's default export-based
// resolution and doesn't need this flag on to work.
config.resolver.unstable_enablePackageExports = false;

// Nuclear option – manually resolve the /encoding subpath
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@solana-mobile/mobile-wallet-adapter-protocol/encoding') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/@solana-mobile/mobile-wallet-adapter-protocol/lib/cjs/encoding.native.js'
      ),
      type: 'sourceFile',
    };
  }

  // Fall back to the default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
