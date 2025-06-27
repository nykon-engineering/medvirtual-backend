#!/bin/bash

set -e 
export PATH="./node_modules/.bin:$PATH"

echo "-> Cleaning previous packages..."
rm -rf lambda-package lambda.zip

echo "-> Issuing Prisma Client..."
docker run --rm -v $(pwd):/app -w /app node:18 npx prisma generate #need to generate with docker because the AWS run in linux binaries | My local machine is MAC

echo "-> building with webpack..."
npx webpack --config webpack.config.js

echo "-> Building directory..."
mkdir lambda-package

echo "-> Copying requirements folders..."
cp -r dist/* lambda-package/
cp -r prisma lambda-package/
cp package.prod.json lambda-package/package.json
cp .env lambda-package/ 2>/dev/null || echo "⚠️  Arquivo .env não encontrado, ignorando..."

echo "-> Installing just prod dependencies..."
cd lambda-package
npm install --omit=dev

echo "-> Copying Prisma engine binaries..."
mkdir -p node_modules/.prisma
cp -r ../node_modules/.prisma/* node_modules/.prisma/

echo "-> Issuing zip file..."
zip -r ../lambda.zip . > /dev/null

echo "-> Deploy file ready: lambda.zip"

echo "Move file to aws lamba by CLI"
cd ..
aws lambda update-function-code --function-name MedVirtualBackendNest --zip-file fileb://lambda.zip --no-cli-pager

echo "-> Cleaning package and directory..."
rm -rf lambda-package lambda.zip