#!/bin/bash

set -e  # Para o script parar em caso de erro
export PATH="./node_modules/.bin:$PATH"

echo "🛠️ Limpando pacotes anteriores..."
rm -rf lambda-package lambda.zip

echo "📦 Gerando build com Webpack..."
npx webpack --config webpack.config.js

echo "🔧 Gerando Prisma Client..."
npx prisma generate

echo "📁 Criando diretório de empacotamento..."
mkdir lambda-package

echo "📂 Copiando arquivos necessários..."

cp -r dist/* lambda-package/
cp -r prisma lambda-package/
cp package.prod.json lambda-package/
cp .env lambda-package/ 2>/dev/null || echo "⚠️  Arquivo .env não encontrado, ignorando..."

echo "📦 Instalando apenas dependências de produção..."
cd lambda-package
npm install --omit=dev

echo "🗜️ Gerando arquivo zip para Lambda..."
zip -r ../lambda.zip . > /dev/null

echo "✅ Deploy package pronto: lambda.zip"
