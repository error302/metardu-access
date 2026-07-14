const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

// Watch workspace packages (engine, shared)
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Support .sqlite, .gsi, .rinex assets
config.resolver.assetExts.push('sqlite', 'gsi', 'rinex', 'jobxml', 'rw5', 'dxf');

module.exports = withNativeWind(config, { input: './global.css' });
