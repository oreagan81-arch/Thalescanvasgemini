import { db } from "../lib/db";
import { FieldValue } from "firebase-admin/firestore";
import { sendAlert } from "./alerts";

export async function trackMetrics(data: {
  tokens?: number
  latency?: number
  cacheHit?: boolean
  isRetry?: boolean
  failure?: boolean
}) {
  const today = new Date().toISOString().split("T")[0];

  const ref = db.collection("metrics").doc(`daily_${today}`);

  const update: any = {
    totalRequests: FieldValue.increment(data.isRetry ? 0 : 1),
    cacheHits: FieldValue.increment(data.cacheHit ? 1 : 0),
    cacheMisses: FieldValue.increment((!data.cacheHit && !data.isRetry) ? 1 : 0),
    totalTokens: FieldValue.increment(data.isRetry ? 0 : (data.tokens || 0)),
    retryTokens: FieldValue.increment(data.isRetry ? (data.tokens || 0) : 0),
    avgLatencyMs: data.latency || 0,
    failures: FieldValue.increment(data.failure ? 1 : 0),
    successes: FieldValue.increment(data.failure ? 0 : 1),
  };

  await ref.set(update, { merge: true });

  const metrics = await getAggregatedMetrics();
  if (metrics.failureRate > 0.1) {
      await sendAlert(`High failure rate detected: ${(metrics.failureRate * 100).toFixed(2)}%`, 'warning');
  }
}

export async function getAggregatedMetrics() {
    const snapshot = await db.collection("metrics").limit(7).get();
    let totalTokens = 0;
    let totalRequests = 0;
    let totalHits = 0;
    let totalFailures = 0;
    let totalSuccesses = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        totalTokens += (data.totalTokens || 0);
        totalRequests += (data.totalRequests || 0);
        totalHits += (data.cacheHits || 0);
        totalFailures += (data.failures || 0);
        totalSuccesses += (data.successes || 0);
    });

    const costPerWeek = totalTokens * 0.00001; // Placeholder cost
    const avgTokensPerDay = totalTokens / 7;
    const cacheEfficiency = totalRequests > 0 ? (totalHits / totalRequests) : 0;
    const failureRate = (totalFailures + totalSuccesses) > 0 ? (totalFailures / (totalFailures + totalSuccesses)) : 0;

    return {
        costPerWeek,
        avgTokensPerDay,
        cacheEfficiency,
        failureRate
    };
}
