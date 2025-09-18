const path = require('path');
const webpack = require('webpack'); 
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/lambda.ts',
  target: 'node',
  mode: 'production',
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  },
  module: {
    rules: [{ 
      test: /\.ts$/, 
      use: 'ts-loader', 
      exclude: [/node_modules/, /\.spec\.ts$/, /test/] }],
  },
  optimization: {
    minimize: false, // Disable minimization for easier debugging
  },
  resolve: { 
    extensions: ['.ts', '.js'],
    fallback: {
      // Workaround for error 'class-transformer/storage' ausente
      'class-transformer/storage': false,
    },
  },
  output: {
    filename: 'index.js', //The lambda is configured to use index.js as the entry point
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
  },
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp: /^@nestjs\/websockets\/socket-module$/,
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^@grpc\/grpc-js|@grpc\/proto-loader|kafkajs|mqtt|nats|ioredis|amqplib|amqp-connection-manager$/,
    }),
    //Copy the Swagger UI assets to the dist folder
    new CopyWebpackPlugin({
      patterns: [
        path.resolve(__dirname, 'node_modules/swagger-ui-dist/swagger-ui.css'),
        path.resolve(__dirname, 'node_modules/swagger-ui-dist/swagger-ui-bundle.js'),
        path.resolve(__dirname, 'node_modules/swagger-ui-dist/swagger-ui-standalone-preset.js'),
        path.resolve(__dirname, 'node_modules/swagger-ui-dist/favicon-16x16.png'),
        path.resolve(__dirname, 'node_modules/swagger-ui-dist/favicon-32x32.png'),
      ],
    }),
  ],
  externals: [
    
    {
      // Ignore o AWS SDK because it is in lambda environment
      'aws-sdk': 'commonjs aws-sdk',
      'class-transformer/storage': 'commonjs class-transformer/storage',
    },
  ],
  //devtool: 'source-map', // Generate source maps for debugging
  devtool: false
};
