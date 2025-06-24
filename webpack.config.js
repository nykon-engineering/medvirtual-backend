const path = require('path');
const webpack = require('webpack'); 

module.exports = {
  entry: './src/lambda.ts',
  target: 'node',
  mode: 'production',
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
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
  ],
  externals: {
    // Ignore o AWS SDK because it is in lambda environment
    'aws-sdk': 'commonjs aws-sdk',
    'class-transformer/storage': 'commonjs class-transformer/storage',
  },

  devtool: 'source-map', // Generate source maps for debugging
};
