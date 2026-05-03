
import { defineSecret } from "firebase-functions/params";

export const canvasApiToken = defineSecret('CANVAS_API_TOKEN');

export async function canvasRequest(path: string, method: string, body: any, token: string) {
  const url = `https://thalesacademy.instructure.com/api/v1/${path}`;
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[CANVAS API] Retry attempt ${attempt} for ${path}. Waiting ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        return await res.json();
      }

      const status = res.status;
      const errorText = await res.text();
      lastError = new Error(`Canvas API error: ${status} ${errorText}`);

      if (status === 429 || (status >= 500 && status <= 599)) {
        console.warn(`[CANVAS API] Transient error ${status} on attempt ${attempt + 1}. Retrying...`);
        continue;
      }

      throw lastError;

    } catch (error: any) {
      if (error.message.includes('Canvas API error')) {
        throw error;
      }
      lastError = error;
      console.error(`[CANVAS API] Network error on attempt ${attempt + 1}: ${error.message}`);
      if (attempt === maxRetries - 1) throw lastError;
    }
  }

  throw lastError || new Error(`Canvas API failed after ${maxRetries} attempts`);
}
