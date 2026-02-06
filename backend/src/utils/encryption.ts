import CryptoJS from 'crypto-js';
import { config } from '../config';

export class EncryptionUtils {
  private static secretKey = config.security.encryptionKey;

  static encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.secretKey).toString();
  }

  static decrypt(cipherText: string): string {
    const bytes = CryptoJS.AES.decrypt(cipherText, this.secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}