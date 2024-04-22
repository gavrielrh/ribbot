export interface SpacedRepetitionItem {
  content: string;
  lastReview: Date;
  nextInterval: number;
  repetition: number;
  easeFactor: number;
}

export const createItem = (content: string): SpacedRepetitionItem => ({
  content,
  lastReview: new Date(),
  nextInterval: 1,
  repetition: 0,
  easeFactor: 2.5,
});

export const updateItem = (
  item: SpacedRepetitionItem,
  quality: Quality,
): SpacedRepetitionItem => {
  const newEaseFactor = calculateEaseFactor(item.easeFactor, quality);
  const { nextInterval, repetition } = calculateNextIntervalAndRepetition(
    item,
    quality,
    newEaseFactor,
  );

  return {
    ...item,
    lastReview: new Date(),
    nextInterval,
    repetition,
    easeFactor: newEaseFactor,
  };
};

type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export const calculateEaseFactor = (
  currentEaseFactor: number,
  quality: Quality,
): number => {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const newEaseFactor = currentEaseFactor + delta;
  return Math.max(newEaseFactor, 1.3);
};

const calculateNextIntervalAndRepetition = (
  item: SpacedRepetitionItem,
  quality: Quality,
  newEaseFactor: number,
) => {
  let nextInterval;
  let repetition = item.repetition;

  // Successful recall
  if (quality >= 3) {
    if (repetition === 0) {
      nextInterval = 1;
    } else if (repetition === 1) {
      nextInterval = 6;
    } else {
      nextInterval = item.nextInterval * newEaseFactor;
    }
    repetition++;
    // Failed to recall
  } else {
    nextInterval = 1;
    repetition = 0;
  }

  return { nextInterval, repetition };
};

export const getItemsToReview = (
  items: SpacedRepetitionItem[],
  currentDate: Date,
): SpacedRepetitionItem[] =>
  items.filter((item) => {
    const nextReviewDate = new Date(item.lastReview);
    nextReviewDate.setDate(nextReviewDate.getDate() + item.nextInterval);
    return nextReviewDate <= currentDate;
  });
