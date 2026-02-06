import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

export interface EmailValidationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
  domain: string;
  mxRecords?: any[];
  spfRecord?: string;
  dmarcRecord?: string;
}

export class EmailDeliverabilityService {
  // Email domain validation
  static async validateEmailDomain(email: string): Promise<EmailValidationResult> {
    const result: EmailValidationResult = {
      isValid: true,
      issues: [],
      suggestions: [],
      domain: email.split('@')[1]
    };

    try {
      const domain = result.domain;

      // Check MX records
      try {
        result.mxRecords = await resolveMx(domain);
        if (!result.mxRecords || result.mxRecords.length === 0) {
          result.issues.push('No MX records found for domain');
          result.isValid = false;
        }
      } catch (error) {
        result.issues.push('Cannot resolve MX records for domain');
        result.isValid = false;
      }

      // Check SPF record
      try {
        const txtRecords = await resolveTxt(domain);
        const spfRecord = txtRecords.find((record: string | string[]) => 
          Array.isArray(record) ? record.some((r: string) => r.startsWith('v=spf1')) : record.startsWith('v=spf1')
        );
        
        if (spfRecord) {
          result.spfRecord = Array.isArray(spfRecord) ? spfRecord.join('') : spfRecord;
        } else {
          result.issues.push('No SPF record found');
          result.suggestions.push('Add SPF record to improve deliverability');
        }
      } catch (error) {
        result.suggestions.push('Could not check SPF record');
      }

      // Check DMARC record
      try {
        const dmarcDomain = `_dmarc.${domain}`;
        const txtRecords = await resolveTxt(dmarcDomain);
        const dmarcRecord = txtRecords.find((record: string | string[]) => 
          Array.isArray(record) ? record.some((r: string) => r.startsWith('v=DMARC1')) : record.startsWith('v=DMARC1')
        );
        
        if (dmarcRecord) {
          result.dmarcRecord = Array.isArray(dmarcRecord) ? dmarcRecord.join('') : dmarcRecord;
        } else {
          result.issues.push('No DMARC record found');
          result.suggestions.push('Add DMARC record for better email authentication');
        }
      } catch (error) {
        result.suggestions.push('Could not check DMARC record');
      }

    } catch (error) {
      result.issues.push(`Domain validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  // Email blacklist checking
  static async checkEmailBlacklist(email: string): Promise<{ isBlacklisted: boolean; reason?: string }> {
    const domain = email.split('@')[1];
    
    // Common blacklisted domains/patterns
    const blacklistedDomains = [
      'tempmail.org', '10minutemail.com', 'guerrillamail.com', 
      'mailinator.com', 'yopmail.com', 'throwaway.email'
    ];
    
    const blacklistedPatterns = [
      /^noreply/i, /^no-reply/i, /^donotreply/i, /^do-not-reply/i,
      /^test@/i, /^admin@/i, /^root@/i
    ];

    // Check domain blacklist
    if (blacklistedDomains.includes(domain.toLowerCase())) {
      return { isBlacklisted: true, reason: 'Domain is in blacklist (temporary/disposable email)' };
    }

    // Check email patterns
    for (const pattern of blacklistedPatterns) {
      if (pattern.test(email)) {
        return { isBlacklisted: true, reason: 'Email pattern indicates non-personal email' };
      }
    }

    return { isBlacklisted: false };
  }

  // Bounce handling
  static categorizeBounceReason(errorMessage: string): { type: 'soft' | 'hard', category: string } {
    const message = errorMessage.toLowerCase();

    // Hard bounces
    if (message.includes('user unknown') || 
        message.includes('no such user') ||
        message.includes('invalid recipient') ||
        message.includes('recipient address rejected') ||
        message.includes('user not found')) {
      return { type: 'hard', category: 'invalid_recipient' };
    }

    if (message.includes('domain not found') ||
        message.includes('no mx record') ||
        message.includes('domain does not exist')) {
      return { type: 'hard', category: 'invalid_domain' };
    }

    // Soft bounces
    if (message.includes('mailbox full') ||
        message.includes('quota exceeded') ||
        message.includes('insufficient storage')) {
      return { type: 'soft', category: 'mailbox_full' };
    }

    if (message.includes('temporarily deferred') ||
        message.includes('try again later') ||
        message.includes('temporary failure')) {
      return { type: 'soft', category: 'temporary_failure' };
    }

    if (message.includes('rate limit') ||
        message.includes('too many emails') ||
        message.includes('sending quota')) {
      return { type: 'soft', category: 'rate_limited' };
    }

    // Default to soft bounce
    return { type: 'soft', category: 'unknown' };
  }

  // Email warm-up suggestions
  static generateWarmupPlan(dailyLimit: number): { 
    phase: number; 
    days: number; 
    dailyEmails: number; 
    description: string; 
  }[] {
    return [
      { phase: 1, days: 7, dailyEmails: Math.min(5, Math.floor(dailyLimit * 0.05)), description: 'Start slow - build sender reputation' },
      { phase: 2, days: 7, dailyEmails: Math.min(15, Math.floor(dailyLimit * 0.15)), description: 'Gradual increase - monitor deliverability' },
      { phase: 3, days: 7, dailyEmails: Math.min(30, Math.floor(dailyLimit * 0.30)), description: 'Moderate volume - track engagement' },
      { phase: 4, days: 7, dailyEmails: Math.min(50, Math.floor(dailyLimit * 0.50)), description: 'Higher volume - maintain good practices' },
      { phase: 5, days: 7, dailyEmails: Math.min(dailyLimit, Math.floor(dailyLimit * 0.80)), description: 'Near full capacity - monitor bounce rates' },
      { phase: 6, days: -1, dailyEmails: dailyLimit, description: 'Full capacity - maintain sender reputation' }
    ];
  }
}

// Email content analysis for spam detection
export class SpamDetectionService {
  private static spamWords = [
    'free', 'win', 'winner', 'cash', 'money', 'prize', 'offer', 'deal',
    'urgent', 'act now', 'limited time', 'click here', 'guarantee',
    'no obligation', 'risk free', 'save money', 'increase sales'
  ];

  static analyzeEmailContent(subject: string, htmlContent: string): {
    spamScore: number;
    issues: string[];
    suggestions: string[];
  } {
    const result = {
      spamScore: 0,
      issues: [] as string[],
      suggestions: [] as string[]
    };

    const fullContent = `${subject} ${htmlContent}`.toLowerCase();

    // Check spam words
    const spamWordCount = this.spamWords.filter(word => fullContent.includes(word)).length;
    result.spamScore += spamWordCount * 10;

    if (spamWordCount > 3) {
      result.issues.push(`Contains ${spamWordCount} potential spam words`);
      result.suggestions.push('Reduce use of promotional language');
    }

    // Check excessive capitalization
    const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
    if (capsRatio > 0.5) {
      result.spamScore += 20;
      result.issues.push('Excessive capitalization in subject');
      result.suggestions.push('Use normal capitalization');
    }

    // Check excessive exclamation marks
    const exclamationCount = (subject.match(/!/g) || []).length;
    if (exclamationCount > 1) {
      result.spamScore += 15;
      result.issues.push('Multiple exclamation marks');
      result.suggestions.push('Limit exclamation marks to one or none');
    }

    return result;
  }
}