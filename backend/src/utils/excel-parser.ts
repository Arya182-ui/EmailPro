import * as XLSX from 'xlsx';
import validator from 'validator';
import fs from 'fs';

export interface ParsedRecipient {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customData?: Record<string, any>;
}

export interface ParseResult {
  success: boolean;
  recipients: ParsedRecipient[];
  errors: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export class ExcelParser {
  static parseExcelFile(filePath: string): ParseResult {
    const result: ParseResult = {
      success: false,
      recipients: [],
      errors: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };

    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
      result.totalRows = rawData.length;

      if (rawData.length === 0) {
        result.errors.push('Excel file is empty');
        return result;
      }

      // Get column headers (case-insensitive mapping)
      const headers = Object.keys(rawData[0]);
      const columnMapping = this.mapColumns(headers);

      // Validate required columns
      if (!columnMapping.email) {
        result.errors.push('Email column is required. Please include a column named "email" or "Email"');
        return result;
      }

      // Process each row
      rawData.forEach((row, index) => {
        const rowNumber = index + 2; // Excel row number (1-indexed + header)
        
        try {
          const recipient = this.parseRow(row, columnMapping);
          
          if (recipient) {
            result.recipients.push(recipient);
            result.validRows++;
          } else {
            result.invalidRows++;
          }
        } catch (error) {
          result.errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.invalidRows++;
        }
      });

      // Remove duplicates based on email
      const uniqueEmails = new Set<string>();
      const uniqueRecipients: ParsedRecipient[] = [];
      
      for (const recipient of result.recipients) {
        if (!uniqueEmails.has(recipient.email.toLowerCase())) {
          uniqueEmails.add(recipient.email.toLowerCase());
          uniqueRecipients.push(recipient);
        }
      }

      const duplicatesRemoved = result.recipients.length - uniqueRecipients.length;
      if (duplicatesRemoved > 0) {
        result.errors.push(`Removed ${duplicatesRemoved} duplicate email addresses`);
      }

      result.recipients = uniqueRecipients;
      result.validRows = uniqueRecipients.length;
      result.success = result.validRows > 0;

      return result;
    } catch (error) {
      result.errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    } finally {
      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
  }

  private static mapColumns(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    
    // Common column name variations
    const columnVariations = {
      email: ['email', 'e-mail', 'emailaddress', 'email_address', 'mail'],
      firstName: ['firstname', 'first_name', 'fname', 'given_name', 'name'],
      lastName: ['lastname', 'last_name', 'lname', 'surname', 'family_name'],
      company: ['company', 'organization', 'org', 'business', 'employer'],
    };

    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().replace(/\s+/g, '').replace(/[-_]/g, '');
      
      for (const [key, variations] of Object.entries(columnVariations)) {
        if (variations.some(variation => 
          normalizedHeader.includes(variation.replace(/[-_]/g, ''))
        )) {
          if (!mapping[key]) { // Use first match
            mapping[key] = header;
          }
        }
      }
    }

    return mapping;
  }

  private static parseRow(row: any, columnMapping: Record<string, string>): ParsedRecipient | null {
    // Extract email
    const email = row[columnMapping.email]?.toString().trim();
    
    if (!email) {
      throw new Error('Email is required');
    }

    if (!validator.isEmail(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    // Extract other fields
    const firstName = row[columnMapping.firstName]?.toString().trim() || '';
    const lastName = row[columnMapping.lastName]?.toString().trim() || '';
    const company = row[columnMapping.company]?.toString().trim() || '';

    // Extract custom data (all other columns)
    const customData: Record<string, any> = {};
    const mappedColumns = new Set(Object.values(columnMapping));
    
    for (const [key, value] of Object.entries(row)) {
      if (!mappedColumns.has(key) && value !== null && value !== undefined && value !== '') {
        customData[key] = value;
      }
    }

    return {
      email: email.toLowerCase(),
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      company: company || undefined,
      customData: Object.keys(customData).length > 0 ? customData : undefined,
    };
  }

  static validateEmailList(emails: string[]): { valid: string[], invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const email of emails) {
      if (validator.isEmail(email)) {
        valid.push(email.toLowerCase().trim());
      } else {
        invalid.push(email);
      }
    }

    return { valid, invalid };
  }
}