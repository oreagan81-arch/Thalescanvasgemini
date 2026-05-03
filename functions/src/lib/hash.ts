import crypto from 'crypto';

export function computeHash(prompt: string, config: any): string {
    const data = JSON.stringify({ prompt, config });
    return crypto.createHash('sha256').update(data).digest('hex');
}
