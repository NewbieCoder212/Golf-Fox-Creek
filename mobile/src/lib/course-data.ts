import type { CourseData, HoleData, ScorecardYardages } from '@/types';

const PLACEHOLDER_COORDS = { lat: 0, lng: 0 };

type HoleRow = [
  number, // hole
  number, // par
  number, // mens hcp
  number, // ladies hcp
  number, // black
  number, // blue
  number, // white1
  number, // white2
  number, // green mens
  number, // green ladies
  number, // red1
  number, // red2
];

const HOLE_ROWS: HoleRow[] = [
  [1, 5, 7, 11, 529, 498, 498, 471, 471, 447, 380, 380],
  [2, 3, 16, 15, 190, 165, 165, 157, 142, 142, 142, 101],
  [3, 4, 10, 5, 418, 393, 378, 378, 346, 346, 315, 315],
  [4, 3, 18, 17, 151, 134, 134, 122, 122, 102, 102, 75],
  [5, 5, 2, 7, 575, 541, 514, 514, 494, 494, 400, 400],
  [6, 4, 12, 9, 422, 396, 374, 374, 343, 343, 311, 311],
  [7, 4, 4, 3, 459, 430, 397, 397, 380, 380, 338, 338],
  [8, 3, 8, 13, 222, 198, 180, 180, 160, 160, 160, 150],
  [9, 5, 6, 1, 560, 523, 523, 490, 490, 463, 422, 422],
  [10, 5, 5, 4, 555, 532, 532, 498, 498, 459, 416, 416],
  [11, 4, 11, 8, 320, 293, 293, 285, 285, 273, 273, 247],
  [12, 4, 1, 2, 448, 421, 396, 396, 370, 370, 328, 328],
  [13, 3, 3, 12, 241, 212, 199, 199, 179, 179, 179, 132],
  [14, 4, 13, 6, 427, 401, 378, 378, 352, 352, 313, 313],
  [15, 5, 9, 10, 543, 509, 509, 482, 482, 443, 443, 406],
  [16, 4, 14, 14, 304, 273, 273, 256, 256, 233, 233, 190],
  [17, 3, 17, 16, 158, 151, 151, 140, 140, 131, 131, 108],
  [18, 4, 15, 18, 403, 378, 348, 348, 348, 295, 295, 204],
];

function buildHoleData(row: HoleRow): HoleData {
  const [
    holeNumber,
    par,
    handicapIndex,
    womensHandicapIndex,
    black,
    blue,
    white1,
    white2,
    greenMens,
    greenLadies,
    red1,
    red2,
  ] = row;

  const scorecardYardages: ScorecardYardages = {
    black,
    blue,
    white1,
    white2,
    greenMens,
    greenLadies,
    red1,
    red2,
    whiteGreen: par >= 5 ? white2 : greenMens,
  };

  return {
    holeNumber,
    par,
    handicapIndex,
    womensHandicapIndex,
    scorecardYardages,
    teeBoxes: [
      { name: 'Black', yards: black },
      { name: 'Blue', yards: blue },
      { name: 'White', yards: white2 },
      { name: 'Green', yards: greenMens },
      { name: 'Red', yards: red1 },
    ],
    teeBoxCoords: PLACEHOLDER_COORDS,
    greenCoords: PLACEHOLDER_COORDS,
  };
}

/**
 * Fox Creek Golf Club - Dieppe, NB
 * Data from official physical scorecard (yardages, ratings, stroke indexes).
 *
 * NOTE: teeBoxCoords and greenCoords are PLACEHOLDERS
 */
export const FOX_CREEK_DATA: CourseData = {
  name: 'Fox Creek Golf Club',
  address: '200 Golf Street, Dieppe, NB E1A 8K9',
  phone: '506-859-4653',
  par: 72,
  holes: 18,
  designer: 'Graham Cooke',
  yearOpened: 2005,

  teeRatings: [
    {
      name: 'Black',
      yards: 6925,
      mensRating: 74.8,
      mensSlope: 140,
      womensRating: 81.0,
      womensSlope: 152,
    },
    {
      name: 'Blue',
      yards: 6448,
      mensRating: 72.7,
      mensSlope: 142,
      womensRating: 78.6,
      womensSlope: 152,
    },
    {
      name: 'Blue/White',
      yards: 6242,
      mensRating: 71.8,
      mensSlope: 139,
      womensRating: 77.6,
      womensSlope: 149,
    },
    {
      name: 'White',
      yards: 6065,
      mensRating: 70.9,
      mensSlope: 137,
      womensRating: 76.6,
      womensSlope: 146,
    },
    {
      name: 'White/Green',
      yards: 5912,
      mensRating: 69.9,
      mensSlope: 136,
      womensRating: 75.4,
      womensSlope: 144,
    },
    {
      name: 'Green',
      yards: 5858,
      mensRating: 69.1,
      mensSlope: 131,
      womensRating: 74.0,
      womensSlope: 142,
    },
    {
      name: 'Green/Red',
      yards: 5347,
      mensRating: 67.2,
      mensSlope: 126,
      womensRating: 71.6,
      womensSlope: 132,
    },
    {
      name: 'Red',
      yards: 4836,
      mensRating: 65.7,
      mensSlope: 123,
      womensRating: 69.9,
      womensSlope: 126,
    },
  ],

  handicapRecommendations: [
    { teeName: 'Black', handicapRange: '0–4', drivingDistance: '280+' },
    { teeName: 'Blue', handicapRange: '5–12', drivingDistance: '260+' },
    { teeName: 'Blue/White', handicapRange: '8–15', drivingDistance: '240+' },
    { teeName: 'White', handicapRange: '13–19', drivingDistance: '230+' },
    { teeName: 'White/Green', handicapRange: '15–22', drivingDistance: '215+' },
    { teeName: 'Green', handicapRange: '20–25', drivingDistance: '200+' },
    { teeName: 'Green/Red', handicapRange: '22–26', drivingDistance: '180+' },
    { teeName: 'Red', handicapRange: '26+', drivingDistance: '180–' },
  ],

  geofences: [
    {
      name: 'Clubhouse',
      coords: { lat: 46.083, lng: -64.683 },
      radiusMeters: 50,
    },
    {
      name: 'Practice Range',
      coords: { lat: 46.084, lng: -64.682 },
      radiusMeters: 100,
    },
    {
      name: 'Canteen',
      coords: { lat: 46.0835, lng: -64.684 },
      radiusMeters: 30,
    },
  ],

  holeData: HOLE_ROWS.map(buildHoleData),
};

export function getHoleByNumber(holeNumber: number) {
  return FOX_CREEK_DATA.holeData.find((h) => h.holeNumber === holeNumber);
}

export function getTeeRating(teeName: string) {
  return FOX_CREEK_DATA.teeRatings.find((t) => t.name === teeName);
}

export function getFrontNine() {
  return FOX_CREEK_DATA.holeData.filter((h) => h.holeNumber <= 9);
}

export function getBackNine() {
  return FOX_CREEK_DATA.holeData.filter((h) => h.holeNumber > 9);
}

export function calculateFrontNinePar() {
  return getFrontNine().reduce((sum, hole) => sum + hole.par, 0);
}

export function calculateBackNinePar() {
  return getBackNine().reduce((sum, hole) => sum + hole.par, 0);
}

export function sumScorecardYardages(
  holes: HoleData[],
  column: keyof ScorecardYardages
): number {
  return holes.reduce((sum, hole) => sum + hole.scorecardYardages[column], 0);
}
