-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daily_sending_limits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "smtpAccountId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_sending_limits_smtpAccountId_fkey" FOREIGN KEY ("smtpAccountId") REFERENCES "smtp_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_daily_sending_limits" ("createdAt", "date", "id", "sentCount", "smtpAccountId", "updatedAt") SELECT "createdAt", "date", "id", "sentCount", "smtpAccountId", "updatedAt" FROM "daily_sending_limits";
DROP TABLE "daily_sending_limits";
ALTER TABLE "new_daily_sending_limits" RENAME TO "daily_sending_limits";
CREATE UNIQUE INDEX "daily_sending_limits_smtpAccountId_date_key" ON "daily_sending_limits"("smtpAccountId", "date");
CREATE TABLE "new_email_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "smtpAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "sentAt" DATETIME,
    "failedAt" DATETIME,
    "errorMessage" TEXT,
    "messageId" TEXT,
    "bounceReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "email_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "email_logs_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "campaign_recipients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "email_logs_smtpAccountId_fkey" FOREIGN KEY ("smtpAccountId") REFERENCES "smtp_accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_email_logs" ("bounceReason", "campaignId", "createdAt", "errorMessage", "failedAt", "id", "messageId", "recipientId", "sentAt", "smtpAccountId", "status", "subject", "updatedAt") SELECT "bounceReason", "campaignId", "createdAt", "errorMessage", "failedAt", "id", "messageId", "recipientId", "sentAt", "smtpAccountId", "status", "subject", "updatedAt" FROM "email_logs";
DROP TABLE "email_logs";
ALTER TABLE "new_email_logs" RENAME TO "email_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
