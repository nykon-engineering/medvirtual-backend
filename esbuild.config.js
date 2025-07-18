const esbuild = require('esbuild');
const { nodeExternalsPlugin } = require('esbuild-node-externals');
const copyStaticFiles = require('esbuild-copy-static-files');

const allowedFiles = [
    'swagger-ui.css',
    'swagger-ui-bundle.js',
    'swagger-ui-standalone-preset.js',
    'favicon-16x16.png',
    'favicon-32x32.png'
  ];


esbuild.build({
  entryPoints: ['./src/lambda.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: 'dist/index.js',
  sourcemap: true,
  minify: false,
  external: ['aws-sdk', 'class-transformer/storage', 'he'],
  banner: {
    js: 'exports.handler = require("./index").handler;',
  },
  plugins: [
    nodeExternalsPlugin(),
    copyStaticFiles({
      src: './node_modules/swagger-ui-dist',
      dest: './dist/swagger-ui-dist',
      filter: (filePath) => {
        return allowedFiles.some(file => filePath.endsWith(file))
      },
    }),
  ],
}).catch((e) => {
    console.error(e);
    process.exit(1)
});
