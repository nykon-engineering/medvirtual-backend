# MedVirtual Backend

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/AWS_Lambda-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS Lambda" />
</p>

## 📋 Description

Backend API for the MedVirtual system, developed with [NestJS](https://github.com/nestjs/nest) framework. This system manages medical hiring processes, candidate management, and automated notifications.

## 🚀 Features

- **User Management**: Authentication, roles, and organization management
- **Hire Requests**: Complete hiring workflow management
- **Candidate Management**: Integration with HubSpot CRM
- **Ticket System**: Support and issue tracking
- **Notifications**: Automated email notifications via Resend
- **AI Integration**: OpenAI integration for text processing
- **Database**: PostgreSQL with Prisma ORM

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Email Service**: Resend
- **CRM Integration**: HubSpot
- **AI**: OpenAI API
- **Deployment**: AWS Lambda

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/medvirtual"

# JWT
JWT_SECRET="your-jwt-secret"
TOKEN_TIME_EXPIRED="7d"

# Email
RESEND_API_KEY="your-resend-api-key"

# HubSpot
HUBSPOT_ACCESS_TOKEN="your-hubspot-token"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Frontend
FRONTEND_URL="http://localhost:3001"
```

## 🚀 Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Debug mode (VS Code)
# Use the provided launch.json configuration
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 📚 API Documentation

Once the application is running, visit:
- **Swagger UI**: `http://localhost:3000/api`
- **Health Check**: `http://localhost:3000/health`

## 🔗 Main Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/signin` - User login
- `POST /auth/invite` - Invite user
- `POST /auth/invited-user-signup` - Complete invitation

### Hire Requests
- `GET /hire-request` - List hire requests
- `POST /hire-request` - Create hire request
- `PATCH /hire-request/:id` - Update hire request
- `POST /hire-request/change-winner/:id` - Select winner

### Tickets
- `GET /tickets` - List tickets
- `POST /tickets` - Create ticket
- `POST /tickets/reassign/:id` - Reassign ticket
- `POST /tickets/update-status/:id` - Update ticket status

### Notifications
- `POST /notifications` - Send custom email
- `POST /notifications/hire-request/:id/placement-completed` - Notify placement completed
- `POST /notifications/ticket/:id/created` - Notify ticket created

## 🏗️ Project Structure

```
src/
├── auth/                 # Authentication module
├── hire-request/         # Hire request management
├── ticket/              # Ticket system
├── notifications/       # Email notifications
├── user/               # User management
├── candidate/          # Candidate management
├── hubspot/           # HubSpot integration
├── openai/            # OpenAI integration
├── prisma/            # Database service
├── common/            # Shared utilities
└── main.ts           # Application entry point
```

## 🚀 Deployment

The application is deployed to AWS Lambda using GitHub Actions:

```bash
# Deploy to production
npm run deploy

# Build for production
npm run build
```

## 📝 Development

### VS Code Configuration

The project includes VS Code configurations for debugging:
- **Debug NestJS**: Debug the main application
- **Debug Tests**: Debug unit tests
- **Debug Current Test File**: Debug specific test file

### Database Management

```bash
# View database in Prisma Studio
npx prisma studio

# Reset database
npx prisma migrate reset

# Deploy migrations
npx prisma migrate deploy
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Support

For support and questions, please contact the development team.
