import { trackMetrics } from "../control/metrics"
import { selectModel } from "./modelRouter"
import { Schema, GoogleGenAI } from "@google/genai"
import { db } from "../lib/db"
import { computeHash } from "../lib/hash"
import { FieldValue } from "firebase-admin/firestore"

export async function generateWithControl(
    prompt: string, 
    task: string, 
    config: any, 
    genAI: GoogleGenAI, 
    userId: string,
    schema?: Schema,
    isRetry: boolean = false,
    force: boolean = false
) {
  const modelName = await selectModel(task, config)
  const hash = computeHash(prompt, config)
  
  // Inject TeacherPreferences
  const { getTeacherPreferences } = await import("../control/teacherPreferences")
  const prefs = await getTeacherPreferences(userId)
  const contextualPrompt = `Teacher Preferences: Tone=${prefs.tone}, Rigor=${prefs.rigor}. \n\n${prompt}`
  
  const cacheRef = db.collection("ai_generation_cache").doc(hash)
  const cacheDoc = await cacheRef.get()
  
  if (cacheDoc.exists && !force) {
      await trackMetrics({
          cacheHit: true,
          isRetry
      })
      return cacheDoc.data()!.payload
  }

  const start = Date.now()

  try {
    const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    })
    const result = await model.generateContent(contextualPrompt)
    const response = await result.response
    const parsed = JSON.parse(response.text())

    // Analyze diff if there was a previous version
    if (cacheDoc.exists) {
        const { analyzeAiOutputChanges } = await import("./diffAnalyzer");
        const analysis = await analyzeAiOutputChanges(JSON.stringify(cacheDoc.data()!.payload), JSON.stringify(parsed), genAI);
        console.log("AI Output Change Analysis:", analysis);
    }

    const latency = Date.now() - start

    await trackMetrics({
      tokens: response.usageMetadata?.totalTokenCount || 0,
      latency,
      cacheHit: false,
      isRetry
    })

    await cacheRef.set({
        hash,
        payload: parsed,
        createdAt: FieldValue.serverTimestamp()
    })

    return parsed
  } catch (e: any) {
    console.warn("Primary failed, using fallback", e)

    await trackMetrics({
        failure: true,
        isRetry
    })

    const model = genAI.getGenerativeModel({ 
        model: config.fallbackModel,
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    })
    const result = await model.generateContent(contextualPrompt)
    const response = await result.response
    return JSON.parse(response.text())
  }
}
