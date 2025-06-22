
import React, { useState, useCallback, useMemo } from 'react';
import { testSections, TOTAL_MCQ_QUESTIONS } from './data/testData';
import { TestSectionContent, UserMCQAnswers, UserWritingResponses, EnglishLevel, MultipleChoiceQuestion } from './types';
import { StartScreen } from './components/StartScreen';
import { McqGroupSection } from './components/McqGroupSection';
import { ReadingSection } from './components/ReadingSection';
import { WritingSection } from './components/WritingSection';
import { ResultsScreen } from './components/ResultsScreen';
import { ProgressBar } from './components/ProgressBar';
import { Button } from './components/common/Button';
import { Card }  from './components/common/Card';

const App: React.FC = () => {
  const [studentName, setStudentName] = useState<string>('');
  const [studentEmail, setStudentEmail] = useState<string>('');
  const [testStarted, setTestStarted] = useState<boolean>(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [userMcqAnswers, setUserMcqAnswers] = useState<UserMCQAnswers>({});
  const [userWritingResponses, setUserWritingResponses] = useState<UserWritingResponses>({});
  const [testCompleted, setTestCompleted] = useState<boolean>(false);
  
  const [overallMcqQuestionCounter, setOverallMcqQuestionCounter] = useState<number>(1);

  const currentSection = useMemo(() => testSections[currentSectionIndex], [currentSectionIndex]);

  const handleStartTest = (name: string, email: string) => {
    setStudentName(name);
    setStudentEmail(email);
    setTestStarted(true);
    setCurrentSectionIndex(0);
    setUserMcqAnswers({});
    setUserWritingResponses({});
    setTestCompleted(false);
    setOverallMcqQuestionCounter(1);
  };

  const handleMcqAnswer = useCallback((questionId: string, selectedOptionIndex: number, isCorrect: boolean) => {
    setUserMcqAnswers(prev => ({
      ...prev,
      [questionId]: { selectedOptionIndex, isCorrect }
    }));
  }, []);

  const handleWritingResponseChange = useCallback((promptKey: string, value: string) => {
    setUserWritingResponses(prev => ({
      ...prev,
      [promptKey]: value
    }));
  }, []);

  const calculateScore = (): number => {
    return Object.values(userMcqAnswers).reduce((sum, answer) => sum + (answer.isCorrect ? 1 : 0), 0);
  };

  const determineLevel = (score: number, totalQuestions: number): EnglishLevel => {
    if (totalQuestions === 0) return EnglishLevel.BEGINNER;
    const percentage = (score / totalQuestions) * 100;
    if (percentage <= 20) return EnglishLevel.BEGINNER; // A1
    if (percentage <= 40) return EnglishLevel.ELEMENTARY; // A2
    if (percentage <= 60) return EnglishLevel.INTERMEDIATE; // B1
    if (percentage <= 75) return EnglishLevel.UPPER_INTERMEDIATE; // B2
    if (percentage <= 90) return EnglishLevel.ADVANCED; // C1
    return EnglishLevel.PROFICIENT; // C2
  };

  const isSectionCompleted = useMemo(() => {
    if (!currentSection) return true;
    if (currentSection.type === 'mcqGroup' || currentSection.type === 'reading') {
      return currentSection.questions.every(q => userMcqAnswers[q.id] !== undefined);
    }
    // Writing sections are considered "completed" once viewed, user can skip typing
    return true; 
  }, [currentSection, userMcqAnswers]);

  const handleNextSection = () => {
    if (currentSection && (currentSection.type === 'mcqGroup' || currentSection.type === 'reading')) {
        setOverallMcqQuestionCounter(prevCount => prevCount + currentSection.questions.length);
    }

    if (currentSectionIndex < testSections.length - 1) {
      setCurrentSectionIndex(prevIndex => prevIndex + 1);
    } else {
      setTestCompleted(true);
    }
  };
  
  if (!testStarted) {
    return <StartScreen onStartTest={handleStartTest} />;
  }

  if (testCompleted) {
    const score = calculateScore();
    const level = determineLevel(score, TOTAL_MCQ_QUESTIONS);
    return (
      <ResultsScreen
        studentName={studentName}
        studentEmail={studentEmail}
        score={score}
        totalPossibleScore={TOTAL_MCQ_QUESTIONS}
        level={level}
        userWritingResponses={userWritingResponses}
        onRetakeTest={() => {
          setTestStarted(false); // This will re-trigger StartScreen
        }}
      />
    );
  }


  const renderSection = () => {
    if (!currentSection) return <p>Loading section...</p>;

    switch (currentSection.type) {
      case 'mcqGroup':
        return (
          <McqGroupSection
            section={currentSection}
            onAnswer={handleMcqAnswer}
            userAnswers={userMcqAnswers}
            overallQuestionStartNumber={overallMcqQuestionCounter}
          />
        );
      case 'reading':
        return (
          <ReadingSection
            section={currentSection}
            onAnswer={handleMcqAnswer}
            userAnswers={userMcqAnswers}
            overallQuestionStartNumber={overallMcqQuestionCounter}
          />
        );
      case 'writing':
        return (
          <WritingSection
            section={currentSection}
            onResponseChange={handleWritingResponseChange}
            userResponses={userWritingResponses}
          />
        );
      default:
        return <p>Unknown section type.</p>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-4xl mb-6">
         <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">English Placement Test</h1>
            <span className="text-sm text-slate-600 font-medium bg-slate-200 px-3 py-1 rounded-full">{studentName}</span>
         </div>
        <ProgressBar current={currentSectionIndex +1} total={testSections.length} />
      </header>
      
      <main className="w-full max-w-4xl">
        {renderSection()}
        <div className="mt-8 flex justify-end">
          <Button 
            onClick={handleNextSection}
            disabled={!isSectionCompleted}
            size="lg"
          >
            {currentSectionIndex < testSections.length - 1 ? 'Next Section' : 'Finish Test'}
          </Button>
        </div>
      </main>
      <footer className="mt-12 text-center text-sm text-slate-500">
        Section {currentSectionIndex + 1} of {testSections.length}
      </footer>
    </div>
  );
};

export default App;