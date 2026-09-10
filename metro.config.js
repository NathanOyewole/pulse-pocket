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

// Force Metro to use package "exports"
config.resolver.unstable_enablePackageExports = true;

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
