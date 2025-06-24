const path = require('path');
const webpack = require('webpack'); // <- Importa o webpack corretamente

module.exports = {
  entry: './src/lambda.ts',
  target: 'node',
  mode: 'production',
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }],
  },
  resolve: { extensions: ['.ts', '.js'] },
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
    // Ignora o AWS SDK porque ele já está disponível no ambiente Lambda
    'aws-sdk': 'commonjs aws-sdk',
  },
};
