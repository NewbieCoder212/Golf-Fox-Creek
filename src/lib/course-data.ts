import type { CourseData } from '@/types';

/**
 * Fox Creek Golf Club - Dieppe, NB
 * Course layout FLIPPED: Old back 9 is now front 9
 *
 * NOTE: teeBoxCoords and greenCoords are PLACEHOLDERS
 * Replace with exact GPS coordinates from course GM or GPS provider
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
      mensRating: 73.8,
      mensSlope: 131,
      womensRating: 80.3,
      womensSlope: 149,
    },
    {
      name: 'Blue',
      yards: 6428,
      mensRating: 71.6,
      mensSlope: 128,
      womensRating: 77.9,
      womensSlope: 141,
    },
    {
      name: 'White',
      yards: 6033,
      mensRating: 69.8,
      mensSlope: 127,
      womensRating: 75.4,
      womensSlope: 136,
    },
    {
      name: 'Green',
      yards: 5589,
      mensRating: 67.8,
      mensSlope: 123,
      womensRating: 73.0,
      womensSlope: 128,
    },
    {
      name: 'Red',
      yards: 4836,
      mensRating: 64.1,
      mensSlope: 112,
      womensRating: 68.4,
      womensSlope: 116,
    },
  ],

  geofences: [
    {
      name: 'Clubhouse',
      coords: { lat: 46.083, lng: -64.683 }, // PLACEHOLDER - update with exact coords
      radiusMeters: 50,
    },
    {
      name: 'Practice Range',
      coords: { lat: 46.084, lng: -64.682 }, // PLACEHOLDER - update with exact coords
      radiusMeters: 100,
    },
    {
      name: 'Canteen',
      coords: { lat: 46.0835, lng: -64.684 }, // PLACEHOLDER - update with exact coords
      radiusMeters: 30,
    },
  ],

  // FLIPPED LAYOUT: Old holes 10-18 are now 1-9, old holes 1-9 are now 10-18
  holeData: [
    // === FRONT NINE (formerly back 9) ===
    {
      holeNumber: 1,
      par: 5,
      handicapIndex: 6,
      teeBoxes: [
        { name: 'Black', yards: 529 },
        { name: 'Blue', yards: 498 },
        { name: 'White', yards: 471 },
        { name: 'Green', yards: 447 },
        { name: 'Red', yards: 380 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 2,
      par: 3,
      handicapIndex: 16,
      teeBoxes: [
        { name: 'Black', yards: 190 },
        { name: 'Blue', yards: 165 },
        { name: 'White', yards: 157 },
        { name: 'Green', yards: 142 },
        { name: 'Red', yards: 101 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 3,
      par: 4,
      handicapIndex: 10,
      teeBoxes: [
        { name: 'Black', yards: 418 },
        { name: 'Blue', yards: 393 },
        { name: 'White', yards: 378 },
        { name: 'Green', yards: 346 },
        { name: 'Red', yards: 315 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 4,
      par: 3,
      handicapIndex: 18,
      teeBoxes: [
        { name: 'Black', yards: 151 },
        { name: 'Blue', yards: 134 },
        { name: 'White', yards: 122 },
        { name: 'Green', yards: 102 },
        { name: 'Red', yards: 75 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 5,
      par: 5,
      handicapIndex: 2,
      teeBoxes: [
        { name: 'Black', yards: 575 },
        { name: 'Blue', yards: 541 },
        { name: 'White', yards: 514 },
        { name: 'Green', yards: 494 },
        { name: 'Red', yards: 400 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 6,
      par: 4,
      handicapIndex: 12,
      teeBoxes: [
        { name: 'Black', yards: 422 },
        { name: 'Blue', yards: 396 },
        { name: 'White', yards: 374 },
        { name: 'Green', yards: 343 },
        { name: 'Red', yards: 311 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 7,
      par: 4,
      handicapIndex: 8,
      teeBoxes: [
        { name: 'Black', yards: 459 },
        { name: 'Blue', yards: 430 },
        { name: 'White', yards: 397 },
        { name: 'Green', yards: 380 },
        { name: 'Red', yards: 338 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 8,
      par: 3,
      handicapIndex: 14,
      teeBoxes: [
        { name: 'Black', yards: 222 },
        { name: 'Blue', yards: 198 },
        { name: 'White', yards: 180 },
        { name: 'Green', yards: 160 },
        { name: 'Red', yards: 150 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 9,
      par: 5,
      handicapIndex: 4,
      teeBoxes: [
        { name: 'Black', yards: 560 },
        { name: 'Blue', yards: 523 },
        { name: 'White', yards: 490 },
        { name: 'Green', yards: 463 },
        { name: 'Red', yards: 422 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },

    // === BACK NINE (formerly front 9) ===
    {
      holeNumber: 10,
      par: 5,
      handicapIndex: 3,
      teeBoxes: [
        { name: 'Black', yards: 555 },
        { name: 'Blue', yards: 532 },
        { name: 'White', yards: 498 },
        { name: 'Green', yards: 459 },
        { name: 'Red', yards: 416 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 11,
      par: 4,
      handicapIndex: 11,
      teeBoxes: [
        { name: 'Black', yards: 320 },
        { name: 'Blue', yards: 293 },
        { name: 'White', yards: 285 },
        { name: 'Green', yards: 273 },
        { name: 'Red', yards: 247 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 12,
      par: 4,
      handicapIndex: 5,
      teeBoxes: [
        { name: 'Black', yards: 448 },
        { name: 'Blue', yards: 421 },
        { name: 'White', yards: 396 },
        { name: 'Green', yards: 370 },
        { name: 'Red', yards: 328 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 13,
      par: 3,
      handicapIndex: 15,
      teeBoxes: [
        { name: 'Black', yards: 241 },
        { name: 'Blue', yards: 212 },
        { name: 'White', yards: 199 },
        { name: 'Green', yards: 179 },
        { name: 'Red', yards: 132 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 14,
      par: 4,
      handicapIndex: 7,
      teeBoxes: [
        { name: 'Black', yards: 427 },
        { name: 'Blue', yards: 401 },
        { name: 'White', yards: 378 },
        { name: 'Green', yards: 352 },
        { name: 'Red', yards: 313 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 15,
      par: 5,
      handicapIndex: 1,
      teeBoxes: [
        { name: 'Black', yards: 543 },
        { name: 'Blue', yards: 509 },
        { name: 'White', yards: 482 },
        { name: 'Green', yards: 443 },
        { name: 'Red', yards: 406 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 16,
      par: 4,
      handicapIndex: 13,
      teeBoxes: [
        { name: 'Black', yards: 304 },
        { name: 'Blue', yards: 273 },
        { name: 'White', yards: 256 },
        { name: 'Green', yards: 233 },
        { name: 'Red', yards: 190 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 17,
      par: 3,
      handicapIndex: 17,
      teeBoxes: [
        { name: 'Black', yards: 158 },
        { name: 'Blue', yards: 131 },
        { name: 'White', yards: 108 },
        { name: 'Green', yards: 108 },
        { name: 'Red', yards: 108 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
    {
      holeNumber: 18,
      par: 4,
      handicapIndex: 9,
      teeBoxes: [
        { name: 'Black', yards: 403 },
        { name: 'Blue', yards: 378 },
        { name: 'White', yards: 348 },
        { name: 'Green', yards: 295 },
        { name: 'Red', yards: 204 },
      ],
      teeBoxCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
      greenCoords: { lat: 0, lng: 0 }, // PLACEHOLDER
    },
  ],
};

// Helper functions
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
