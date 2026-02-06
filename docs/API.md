# API Documentation

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://yourdomain.com/api`

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Response Format
All API responses follow this format:
```json
{
  "message": "Success message",
  "data": { ... },
  "error": "Error message (if any)"
}
```

## Endpoints

### Authentication

#### Register User
```
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-20T10:00:00Z"
  },
  "token": "jwt_token_here"
}
```

#### Login
```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Get Profile
```
GET /auth/me
```
*Requires authentication*

### SMTP Accounts

#### List SMTP Accounts
```
GET /smtp
```
*Requires authentication*

#### Create SMTP Account
```
POST /smtp
```
*Requires authentication*

**Request Body:**
```json
{
  "name": "Main Marketing Account",
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "username": "your-email@gmail.com",
  "password": "app-specific-password",
  "fromName": "Your Company",
  "fromEmail": "marketing@yourcompany.com",
  "dailyLimit": 500,
  "delayMin": 30,
  "delayMax": 180
}
```

#### Test SMTP Connection
```
POST /smtp/:id/test
```
*Requires authentication*

### Templates

#### List Templates
```
GET /templates
```
*Requires authentication*

#### Create Template
```
POST /templates
```
*Requires authentication*

**Request Body:**
```json
{
  "name": "Welcome Email",
  "subject": "Welcome {{firstName}}!",
  "htmlBody": "<h1>Welcome {{firstName}}!</h1><p>Thanks for joining {{company}}!</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>",
  "variables": ["firstName", "company"]
}
```

#### Preview Template
```
POST /templates/:id/preview
```
*Requires authentication*

**Request Body:**
```json
{
  "sampleData": {
    "firstName": "John",
    "company": "Acme Corp"
  }
}
```

### Recipients

#### Upload Excel File
```
POST /recipients/upload
```
*Requires authentication*
*Content-Type: multipart/form-data*

**Form Data:**
- `file`: Excel file (.xls or .xlsx)

**Response:**
```json
{
  "message": "File parsed successfully",
  "data": {
    "totalRows": 100,
    "validRows": 95,
    "invalidRows": 5,
    "recipients": [...],
    "errors": ["Row 15: Invalid email format"]
  }
}
```

#### Validate Email List
```
POST /recipients/validate-emails
```
*Requires authentication*

**Request Body:**
```json
{
  "emails": ["user1@example.com", "user2@example.com", "invalid-email"]
}
```

### Campaigns

#### List Campaigns
```
GET /campaigns
```
*Requires authentication*

#### Create Campaign
```
POST /campaigns
```
*Requires authentication*

**Request Body:**
```json
{
  "name": "Product Launch Campaign",
  "smtpAccountId": "smtp_account_id",
  "templateId": "template_id",
  "scheduledAt": "2024-01-25T10:00:00Z",
  "settings": {}
}
```

#### Start Campaign
```
POST /campaigns/:id/start
```
*Requires authentication*

#### Pause Campaign
```
POST /campaigns/:id/pause
```
*Requires authentication*

#### Stop Campaign
```
POST /campaigns/:id/stop
```
*Requires authentication*

#### Get Campaign Statistics
```
GET /campaigns/:id/stats
```
*Requires authentication*

**Response:**
```json
{
  "totalRecipients": 1000,
  "sentCount": 750,
  "failedCount": 25,
  "bounceCount": 10,
  "bounceRate": 1.33,
  "pendingCount": 225,
  "emailStatusBreakdown": {
    "SENT": 750,
    "FAILED": 25,
    "PENDING": 225
  }
}
```

#### Get Campaign Logs
```
GET /campaigns/:id/logs?page=1&limit=50&status=SENT
```
*Requires authentication*

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `status`: Filter by email status (optional)

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limits

- **Default**: 100 requests per 15 minutes per IP
- **File Upload**: 5MB maximum file size
- **Email Sending**: Configurable per SMTP account

## Webhooks (Future)

Webhook endpoints will be available for:
- Campaign status changes
- Email delivery status
- Bounce notifications
- System alerts

Example webhook payload:
```json
{
  "event": "campaign.completed",
  "data": {
    "campaignId": "campaign_id",
    "stats": { ... }
  },
  "timestamp": "2024-01-20T10:00:00Z"
}
```