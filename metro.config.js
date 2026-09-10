const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// IMPORTANT: must be false. @solana/web3.js's dependency chain
// (rpc-websockets, @noble/hashes) isn't fully compatible with Metro's
// strict package.json "exports" resolution yet — enabling this crashes
// the bundler entirely with "TypeError: dependencies is not iterable"
// deep inside Metro's dependency graph builder. This is a known issue
// in the Solana + React Native/Expo ecosystem, not a bug in this project.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
