import { GoogleGenAI, Type } from "@google/genai";
import { Question, SimilarQuestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiService = {
  async performOCR(base64Image: string): Promise<Partial<Question>> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: `Please perform OCR on this image of a school test question. 
          Extract the following fields in JSON format:
          - content: The main question text.
          - options: An array of options (if it's a multiple choice question).
          - userAnswer: The student's answer if visible.
          - standardAnswer: The correct answer if visible.
          
          Return ONLY the JSON object.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            userAnswer: { type: Type.STRING },
            standardAnswer: { type: Type.STRING },
          },
        },
      },
    });

    try {
      return JSON.parse(response.text || "{}");
    } catch (e) {
      console.error("Failed to parse OCR result", e);
      return {};
    }
  },

  async extractKnowledgePoint(question: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this question, what is the core knowledge point (in Chinese)? 
      Provide a concise name like "一元二次方程根的判别式" or "现在完成时".
      
      Question: ${question}`,
    });
    return response.text?.trim() || "未知知识点";
  },

  async generateSimilarQuestions(
    originalQuestion: string,
    knowledgePoint: string
  ): Promise<SimilarQuestion[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert teacher. Based on the knowledge point "${knowledgePoint}" and the original question provided, generate 3 similar questions (举一反三).
      
      Original Question: ${originalQuestion}
      
      Requirements for each question:
      1. Cover the same knowledge point from different angles or variations.
      2. Difficulty should be similar to the original.
      3. Include:
         - content: The question text.
         - options: Array of options (if applicable).
         - answer: The correct answer.
         - analysis: Step-by-step explanation.
         - commonMistakes: Analysis of common traps or easy-to-miss points (易错点分析).
      
      Return the result as a JSON array of 3 objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              answer: { type: Type.STRING },
              analysis: { type: Type.STRING },
              commonMistakes: { type: Type.STRING },
            },
            required: ["content", "answer", "analysis", "commonMistakes"],
          },
        },
      },
    });

    try {
      const questions = JSON.parse(response.text || "[]");
      return questions.map((q: any, index: number) => ({
        ...q,
        id: `similar-${Date.now()}-${index}`,
      }));
    } catch (e) {
      console.error("Failed to parse similar questions", e);
      return [];
    }
  },
};
