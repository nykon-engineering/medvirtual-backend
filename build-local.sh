#!/bin/bash

set -e

echo "🧹 Limpando pacotes anteriores"
rm -rf lambda-package lambda.zip

echo "📦 Instalando dependências"
npm ci

echo "🧼 Removendo binários do macOS"
rm -rf node_modules/.prisma

echo "⚙️ Atualizando binaryTargets para produção"
sed -i '' 's/binaryTargets = \["native"\]/binaryTargets = \["rhel-openssl-1.0.x"\]/' prisma/schema.prisma

echo "⚙️ Gerando Prisma Client com Docker"
docker run --rm -v $(pwd):/app -w /app -e PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 node:18 npx prisma generate

echo "🔨 Build com webpack"
npx webpack --config webpack.config.js

echo "📁 Montando lambda-package"
mkdir -p lambda-package/prisma
cp -r dist/* lambda-package/
cp -r prisma/schema.prisma lambda-package/prisma/
cp package.prod.json lambda-package/package.json
[ -f .env ] && cp .env lambda-package/

echo "📦 Instalando dependências de produção"
cd lambda-package
npm install --omit=dev
cd ..

echo "📦 Copiando binários do Prisma"
mkdir -p lambda-package/node_modules/.prisma
cp -r node_modules/.prisma/* lambda-package/node_modules/.prisma/

echo "🗑️ Removendo arquivos desnecessários"
find lambda-package -name "*.map" -type f -delete

echo "📦 Criando arquivo lambda.zip"
cd lambda-package
zip -r ../lambda.zip . > /dev/null
cd ..

echo "✅ Arquivo lambda.zip gerado com sucesso!"
