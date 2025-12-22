// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// PowerSync requires disabling inline requires
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: {
      blockList: {
        [require.resolve('@powersync/react-native')]: true,
      },
    },
  },
});

// Exclude other apps in monorepo from Metro watcher to prevent ENOENT errors
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

config.watchFolders = [workspaceRoot];
config.resolver.blockList = [
  // Exclude web app's .next directory
  /apps\/web\/\.next\/.*/,
  // Exclude backend
  /apps\/backend\/.*/,
];

module.exports = config;
