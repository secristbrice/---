/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  content: string;
  options?: string[];
  userAnswer?: string;
  standardAnswer?: string;
  analysis?: string;
}

export interface SimilarQuestion {
  id: string;
  content: string;
  options?: string[];
  answer: string;
  analysis: string;
  commonMistakes: string;
}

export interface WrongQuestionRecord {
  id: string;
  originalQuestion: Question;
  knowledgePoint: string;
  similarQuestions: SimilarQuestion[];
  createdAt: number;
}
