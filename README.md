# Email Automation Platform 📧

A comprehensive self-hosted email automation platform that allows multiple users to safely send scheduled, rate-limited emails from multiple SMTP accounts with advanced deliverability features.

## 🚀 Live Demo
- **Frontend**: Deploy on Vercel (Free)
- **Backend**: Deploy on Render (Free)
- **Total Cost**: $0/month for MVP testing

## ✨ Features

- **Multi-User Authentication**: Secure JWT-based user registration and login
- **SMTP Management**: Add, configure, and manage multiple SMTP accounts
- **Template Engine**: Create dynamic email templates with variables
- **File Upload**: Import recipients from Excel files with validation
- **Campaign Scheduling**: Create, start, pause, and resume email campaigns
- **Email Automation**: Background job processing with Redis queues
- **Rate Limiting**: Prevent spam with configurable sending limits
- **Office Hours**: Send emails only during business hours
- **Bounce Tracking**: Automatic campaign pause on high bounce rates
- **Dashboard**: Real-time campaign monitoring and statistics

## 🏗️ System Architecture

```
Frontend (React + Vite)
    ↓ HTTP/HTTPS
Backend API (Node.js + Express)
    ↓
┌─────────────────┬─────────────────┐
│   PostgreSQL    │     Redis       │
│   (User Data)   │   (Job Queue)   │
└─────────────────┴─────────────────┘
    ↑                      ↓
Email Worker Process ──────┘
    ↓
SMTP Servers → Recipients
```

## 🛠️ Tech Stack

### Backend
- **Framework**: Node.js with Express
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis with Bull for job processing
- **Authentication**: JWT tokens
- **Email**: Nodemailer for SMTP sending
- **File Processing**: xlsx for Excel parsing
- **Security**: bcrypt, helmet, rate limiting

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Forms**: React Hook Form
- **Icons**: Heroicons
- **Notifications**: React Hot Toast

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Git

### Quick Start

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd email-automation-platform
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   
   # Run database migrations
   npx prisma migrate dev
   npx prisma generate
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend API
   cd backend
   npm run dev
   
   # Terminal 2 - Email Worker
   npm run worker
   
   # Terminal 3 - Frontend
   cd frontend
   npm run dev
   ```

5. **Access Application**
   - Frontend: http://localhost:5173
   - API: http://localhost:3000
   - Health Check: http://localhost:3000/health

## 🔧 Configuration

### Environment Variables

Create `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/email_automation_db"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Security
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Email Configuration
SMTP_FROM_NAME="Your Company"
SMTP_FROM_EMAIL="noreply@yourdomain.com"

# File Upload
MAX_FILE_SIZE=5242880  # 5MB
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Email Limits
DEFAULT_DAILY_LIMIT=500
MIN_DELAY_BETWEEN_EMAILS=30
MAX_DELAY_BETWEEN_EMAILS=180

# Office Hours (24-hour format)
OFFICE_HOURS_START=9
OFFICE_HOURS_END=17

# Safety
MAX_BOUNCE_RATE=5  # percentage

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key
BCRYPT_ROUNDS=12
```

## 📊 Database Schema

### Core Tables
- **users**: User accounts and authentication
- **smtp_accounts**: SMTP configuration and credentials (encrypted)
- **templates**: Email templates with dynamic variables
- **campaigns**: Email campaigns and scheduling
- **recipients**: Campaign recipient lists from Excel uploads
- **email_logs**: Individual email sending status and tracking
- **daily_sending_limits**: SMTP account usage tracking

## 🔄 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### SMTP Management
- `GET /api/smtp` - List SMTP accounts
- `POST /api/smtp` - Create SMTP account
- `PUT /api/smtp/:id` - Update SMTP account
- `DELETE /api/smtp/:id` - Delete SMTP account
- `POST /api/smtp/:id/test` - Test SMTP connection

### Templates
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/preview` - Preview template

### Recipients
- `POST /api/recipients/upload` - Upload Excel file
- `POST /api/recipients/validate-emails` - Validate email list
- `POST /api/recipients/create-recipients` - Add recipients to campaign

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `POST /api/campaigns/:id/stop` - Stop campaign
- `GET /api/campaigns/:id/stats` - Campaign statistics
- `GET /api/campaigns/:id/logs` - Email logs

## 🎯 Usage Guide

### 1. Setup SMTP Account
1. Navigate to "SMTP Accounts"
2. Click "Add SMTP Account"
3. Enter SMTP server details (host, port, credentials)
4. Test connection before saving

### 2. Create Email Template
1. Go to "Templates"
2. Click "Create Template"
3. Design your email with variables like `{{firstName}}`, `{{company}}`
4. Include unsubscribe link: `{{unsubscribe_url}}`

### 3. Upload Recipients
1. Prepare Excel file with columns: email, firstName, lastName, company
2. In campaign creation, upload your Excel file
3. Review parsed data and fix any validation errors

### 4. Create Campaign
1. Navigate to "Campaigns"
2. Select SMTP account and template
3. Upload recipients
4. Schedule or start immediately
5. Monitor progress in real-time

## 🔒 Security Features

### Email Compliance
- Mandatory unsubscribe links in templates
- Office hours restrictions (no weekend/night sending)
- Rate limiting and daily sending limits
- Automatic bounce rate monitoring
- Gradual sending with random delays

### Data Security
- JWT authentication with secure tokens
- SMTP passwords encrypted at rest
- Rate limiting on API endpoints
- Input validation and sanitization
- SQL injection prevention with Prisma

### Infrastructure Security
- Helmet.js security headers
- CORS protection
- File upload restrictions
- Environment variable protection
- Process isolation with PM2

## 📈 Monitoring & Analytics

### Campaign Metrics
- Total recipients vs sent count
- Success/failure rates
- Bounce rate tracking
- Send rate over time
- SMTP account utilization

### System Health
- API response times
- Queue processing status
- Database connection health
- Redis connectivity
- Email worker status

## 🚀 Production Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for comprehensive VPS deployment instructions including:
- Server setup and configuration
- Database and Redis installation
- SSL certificate setup
- Nginx reverse proxy configuration
- PM2 process management
- Backup and monitoring setup

## 🧪 Development

### Running Tests
```bash
cd backend
npm test
```

### Code Quality
```bash
# Lint backend
cd backend
npm run lint

# Lint frontend
cd frontend
npm run lint
```

### Database Management
```bash
# Reset database
npx prisma migrate reset

# View data
npx prisma studio
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the [deployment guide](docs/DEPLOYMENT.md)
- Review API documentation
- Check logs for error details
- Ensure all services are running

## ⚠️ Important Notes

- This platform is designed for legitimate email marketing only
- Always comply with CAN-SPAM, GDPR, and local regulations
- Use authenticated SMTP servers to prevent spam classification
- Monitor bounce rates and maintain clean email lists
- Respect recipient unsubscribe requests immediately

## 🎉 Features Roadmap

- [ ] Click and open tracking
- [ ] A/B testing for campaigns
- [ ] Advanced analytics dashboard
- [ ] Email template marketplace
- [ ] API webhooks for integrations
- [ ] Multi-language support
- [ ] Advanced segmentation
- [ ] Automated drip campaigns