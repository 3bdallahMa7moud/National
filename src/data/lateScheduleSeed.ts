export const DEFAULT_LATE_SCHEDULE_NOTICE =
  'New update : Weekday OT is now 4 Hours and Transplant is now 8 Hours instead of 9 Hours.';

export const LEGACY_LATE_SCHEDULE_ROWS = [
  {
    id: 'row-1',
    title: 'NCAP AND PRE-TRANS',
    location: 'KASCH',
    timeRange: '17:00-21:00',
    highlightedDays: [1, 19, 30],
    assignments: {
      1: 'A-H', 2: 'Y', 5: 'AO', 6: 'A-C', 7: 'P', 8: 'N-D', 9: 'AH',
      12: 'MA', 13: 'Q-YK', 14: 'N', 15: 'A-P', 16: 'FA', 19: 'NQ',
      20: 'J-AH', 21: 'B', 22: 'MA-H', 23: 'J', 26: 'EJ', 27: 'Q-YK',
      28: 'EJ', 29: 'EJ-P', 30: 'H',
    },
  },
  {
    id: 'row-2',
    title: 'Transplant',
    location: 'KASCH',
    timeRange: '08:00-04:00',
    highlightedDays: [11, 17, 25],
    assignments: {
      3: 'S-TG', 4: 'S-NQ', 10: 'S-FA', 11: 'S-H', 17: 'S-J', 18: 'S-P',
      24: 'S-AH', 25: 'S-H', 31: 'S-Z',
    },
  },
];
