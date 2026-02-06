/*
  Warnings:

  - You are about to drop the `recipients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `smtpAccountId` on the `campaigns` table. All the data in the column will be lost.
  - Added the required column `smtpAccountIds` to the `campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "recipients";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "customData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "failedReason" TEXT,
    "smtpAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "smtpAccountIds" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "pausedAt" DATETIME,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" REAL NOT NULL DEFAULT 0.0,
    "settings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_campaigns" ("bounceCount", "bounceRate", "completedAt", "createdAt", "failedCount", "id", "name", "pausedAt", "scheduledAt", "sentCount", "settings", "startedAt", "status", "templateId", "totalRecipients", "updatedAt", "userId") SELECT "bounceCount", "bounceRate", "completedAt", "createdAt", "failedCount", "id", "name", "pausedAt", "scheduledAt", "sentCount", "settings", "startedAt", "status", "templateId", "totalRecipients", "updatedAt", "userId" FROM "campaigns";
DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
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
    CONSTRAINT "email_logs_smtpAccountId_fkey" FOREIGN KEY ("smtpAccountId") REFERENCES "smtp_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_email_logs" ("bounceReason", "campaignId", "createdAt", "errorMessage", "failedAt", "id", "messageId", "recipientId", "sentAt", "smtpAccountId", "status", "subject", "updatedAt") SELECT "bounceReason", "campaignId", "createdAt", "errorMessage", "failedAt", "id", "messageId", "recipientId", "sentAt", "smtpAccountId", "status", "subject", "updatedAt" FROM "email_logs";
DROP TABLE "email_logs";
ALTER TABLE "new_email_logs" RENAME TO "email_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
