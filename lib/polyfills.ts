// Required polyfills for @solana/web3.js and Mobile Wallet Adapter to work
// in React Native. Must be imported before anything that touches Solana
// crypto — this file is imported first thing in app/_layout.tsx.

import "react-native-get-random-values";
import { Buffer } from "buffer";

if (typeof global.Buffer === "undefined") {
  // @ts-ignore
  global.Buffer = Buffer;
}
