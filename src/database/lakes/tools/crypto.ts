import * as crypto from 'crypto';
// import { createHmac, timingSafeEqual } from 'crypto';

interface EncryptionResult {
  iv: string;
  encryptedData: string;
  mac: string;
  tag?: string;
}

// OpenSslAes256Cbc
export class CryptoAes256C {

  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;

  /**
   * @param secretKey Must be exactly 32 bytes (256 bits)
   */
  constructor(secretKey: string | Buffer) {


    if (typeof secretKey === 'string') {
      // Ensure the key length matches requirements

      secretKey = this.base64Decode(secretKey);
      this.key = crypto.scryptSync(secretKey, 'salt', 32);

    } else {
      this.key = secretKey;
    }

    if (this.key.length !== 32) {
      throw new Error('Key must be exactly 32 bytes for AES-256-CBC.');
    }
  }

  /**
   * encode the original string to base 64 string
   * @param originalString - The received plain text data.
   */
  protected base64Encode(originalString: string): string {
    // Convert originalString  to Base64 string
    return Buffer.from(originalString, 'utf-8').toString('base64')
  }

  /**
   * decode the  base 64 string to original string
   * @param base64String - The received plain text data.
   */
  protected base64Decode(base64String: string): string {
    // Convert the Base64 string back into a UTF-8 string
    return Buffer.from(base64String, 'base64').toString('utf-8');
  }


  /**
   * Generates a Hash-based Message Authentication Code (HMAC) using SHA-256.
   * @param message - The plain text data to authenticate.
   * @param secretKey - The shared secret key known only to sender and receiver.
   * @returns The hex-encoded MAC string.
   */
  protected generateMAC(message: string, ivHex : string ): string {
    return crypto.createHmac('sha256', this.key.toString('hex'))
      .update(message+ivHex)
      .digest('hex');
  }

  /**
   * Safely verifies if a provided MAC matches the expected MAC for a given message.
   * Uses timingSafeEqual to protect against timing attacks.
   * @param message - The received plain text data.
   * @param secretKey - The shared secret key.
   * @param receivedMac - The MAC tag provided with the message.
   */
  protected verifyMAC(message: string, ivHex : string , receivedMac: string): boolean {
    //
    const expectedMac = this.generateMAC(message, ivHex);
    
    // Convert strings to Buffers for secure timing-safe comparison
    const expectedBuffer = Buffer.from(expectedMac, 'hex');
    const receivedBuffer = Buffer.from(receivedMac, 'hex');

    // Verify buffers match and have identical lengths
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }


  /**
   * Encrypts plaintext data into hexadecimal format
   */
  public encrypt(plaintext: string): string {
    // Generate a fresh, random 16-byte Initialization Vector (IV) for every encryption
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // generate a ma
    const encryptMac = this.generateMAC( plaintext, iv.toString('hex'));


    const encryptedData : EncryptionResult = {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      mac: encryptMac
    };

    const jsonEcrypted: string = JSON.stringify(encryptedData);

    // let sha = this.base64Encode(jsonEcrypted);

    return this.base64Encode(jsonEcrypted);
  }

  /**
   * Decrypts a hexadecimal string back to plaintext
   */
  public decrypt(encrypted64: string): string {

    
    // decrypt the base 64
    const jsonEcrypted = this.base64Decode(encrypted64);

    // get the JSON data
    const encrypted : EncryptionResult  =  JSON.parse(jsonEcrypted);

    const encryptedData : string = encrypted.encryptedData;

    const ivHex = encrypted.iv;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');


    // verifiying the mac
    if(!this.verifyMAC(decrypted, ivHex, encrypted.mac))
    {
      throw new Error("MAC doesn't match the orignal value");
    }

    return decrypted;
  }


}
