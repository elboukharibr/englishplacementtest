
export interface MultipleChoiceQuestion {
  id: string;
  questionText: string;
  options: string[]; // Already parsed, without "a) "
  correctAnswerIndex: number;
}

export interface ReadingComprehensionContent {
  type: 'reading';
  id: string;
  title: string;
  readingText: string;
  questions: MultipleChoiceQuestion[];
}

export interface WritingPromptContent {
  type: 'writing';
  id: string;
  title: string;
  instructions: string;
  prompts: string[]; // Individual prompts for textareas
}

export interface MultipleChoiceGroupContent {
  type: 'mcqGroup';
  id: string;
  title: string;
  questions: MultipleChoiceQuestion[];
}

export type TestSectionContent = ReadingComprehensionContent | WritingPromptContent | MultipleChoiceGroupContent;

export interface UserMCQAnswer {
  selectedOptionIndex: number;
  isCorrect: boolean;
}

export type UserMCQAnswers = Record<string, UserMCQAnswer>; // Keyed by MCQ id
export type UserWritingResponses = Record<string, string>; // Keyed by sectionId_promptIndex

export enum EnglishLevel {
  BEGINNER = "Beginner (A1)",
  ELEMENTARY = "Elementary (A2)",
  INTERMEDIATE = "Intermediate (B1)",
  UPPER_INTERMEDIATE = "Upper-Intermediate (B2)",
  ADVANCED = "Advanced (C1)",
  PROFICIENT = "Proficient (C2)"
}
    