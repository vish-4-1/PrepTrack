export const scoringConfig = {
  dsa: {
    maxScore: 100,
    solveVolume: {
      maxPoints: 40,
      targetCount: 400,
    },
    difficulty: {
      maxPoints: 35,
      targetScore: 300,
      mediumMultiplier: 2,
      hardMultiplier: 4,
    },
    rating: {
      baseline: 1200,
      span: 600,
      maxPoints: 25,
      defaultFloor: 10,
    },
  },
  development: {
    maxScore: 100,
    repos: {
      maxPoints: 30,
      targetCount: 10,
    },
    stars: {
      maxPoints: 25,
      targetCount: 20,
    },
    commits: {
      maxPoints: 25,
      targetCount: 300,
    },
    languages: {
      maxPoints: 20,
      targetCount: 4,
    },
    gitScoreMultiplier: 1.4,
    commitEstimation: {
      openIssueMultiplier: 4,
      openIssueBase: 12,
      defaultFallback: 24,
    },
  },
  platformDistributions: {
    codechef: {
      easyRatio: 0.45,
      mediumRatio: 0.4,
    },
    hackerrank: {
      starWeight: 15,
      defaultStars: 1,
      easyRatio: 0.55,
      mediumRatio: 0.35,
    },
  },
  csFundamentals: {
    baseline: {
      basePoints: 45,
      mediumSolvedDivisor: 5,
      repoMultiplier: 2,
      cap: 85,
    },
    keywords: {
      dbms: ['sql', 'postgres', 'mongo', 'python', 'typescript'],
      oop: ['java', 'c++', 'cplusplus', 'c#', 'python'],
      systems: ['c++', 'cplusplus', 'c', 'rust', 'go'],
    },
    dbms: {
      bonusActive: 12,
      bonusDefault: 5,
    },
    os: {
      bonusActive: 14,
      dsaScoreThreshold: 70,
      bonusDsaActive: 10,
      bonusDefault: 4,
    },
    oop: {
      bonusActive: 15,
      bonusDefault: 8,
    },
    networks: {
      repoThreshold: 2,
      bonusActive: 8,
      bonusDefault: 4,
    },
    systemDesign: {
      dsaWeight: 0.45,
      devWeight: 0.45,
    },
  },
  softSkills: {
    communication: {
      connectedScore: 72,
      unconnectedScore: 58,
    },
    aptitude: {
      dsaMultiplier: 0.85,
      basePoints: 10,
    },
  },
  placementReadiness: {
    weights: {
      dsa: 0.3,
      dev: 0.25,
      csFundamentals: 0.25,
      softSkills: 0.2,
    },
  },
  companyReadiness: {
    thresholds: {
      ready: 80,
      moderate: 65,
    },
    priorityWeights: {
      HIGH: 1.5,
      MEDIUM: 1.0,
      LOW: 0.75,
    },
  },
} as const;

export type ScoringConfig = typeof scoringConfig;
