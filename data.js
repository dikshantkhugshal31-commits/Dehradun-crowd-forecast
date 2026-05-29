// data.js — Places, hours, crowd logic
// All crowd percentages are based on historical patterns

export const HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
export const HOUR_LABELS = [
  '6AM','7AM','8AM','9AM','10AM','11AM','12PM',
  '1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM','11PM'
];

export function getHourIndex(hour) {
  const idx = HOURS.indexOf(hour);
  return idx >= 0 ? idx : Math.max(0, Math.min(hour - 6, HOURS.length - 1));
}

export function formatHour(h) {
  if (h === 0 || h === 24) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

export function getCrowdLevel(pct) {
  if (pct <= 30) return { label: 'Comfortable', cls: 'low',      color: 'var(--crowd-low)' };
  if (pct <= 55) return { label: 'Moderate',    cls: 'moderate', color: 'var(--crowd-moderate)' };
  if (pct <= 75) return { label: 'Crowded',     cls: 'high',     color: 'var(--crowd-high)' };
  return             { label: 'Very Crowded', cls: 'peak',     color: 'var(--crowd-peak)' };
}

export function getBarColor(v) {
  if (v <= 30) return 'var(--crowd-low)';
  if (v <= 55) return 'var(--crowd-moderate)';
  if (v <= 75) return 'var(--crowd-high)';
  return 'var(--crowd-peak)';
}

// crowd[weather][hourIndex] — 18 values for hours 6-23
export const PLACES = [
  {
    id: 'robbers-cave',
    name: 'Robber\'s Cave',
    subtitle: 'Nature · Cave Stream',
    category: 'nature',
    emoji: '🏞️',
    bgGrad: 'linear-gradient(135deg,#2d6a4f,#40916c)',
    rating: 4.5,
    entryFee: '₹50/person',
    distance: '8 km from city',
    openHour: 8,
    closeHour: 18,
    bestTime: 'Early morning (8–10 AM)',
    tips: 'Wear waterproof sandals — the stream can be ankle deep. Avoid monsoon afternoons. Carry cash for entry. The inner cave is the best spot and gets very crowded by noon.',
    tags: ['🌿 Nature','🚶 Trekking','📸 Photography','🧒 Family'],
    crowd: {
      sunny: [0,0,20,35,60,75,85,80,70,65,60,50,35,25,15,0,0,0],
      cloudy:[0,0,15,28,50,62,72,68,58,55,50,42,28,18,10,0,0,0],
      rainy: [0,0,8, 15,25,35,40,38,30,28,25,20,15,10,5, 0,0,0],
      foggy: [0,0,10,20,38,48,55,52,44,40,36,30,20,12,8, 0,0,0],
    }
  },
  {
    id: 'sahastradhara',
    name: 'Sahastradhara',
    subtitle: 'Waterfall · Sulphur Springs',
    category: 'waterfall',
    emoji: '💧',
    bgGrad: 'linear-gradient(135deg,#1a759f,#52b788)',
    rating: 4.3,
    entryFee: '₹30/person',
    distance: '14 km from city',
    openHour: 7,
    closeHour: 19,
    bestTime: 'Weekday mornings (7–9 AM)',
    tips: 'The sulphur springs are said to have healing properties. Visit on weekdays to avoid weekend rush. The rope-way is a great addition — book in advance.',
    tags: ['💧 Waterfall','🌿 Nature','🏊 Swimming','🚡 Ropeway'],
    crowd: {
      sunny: [0,15,30,48,65,80,90,88,82,78,72,65,55,42,28,15,0,0],
      cloudy:[0,10,22,38,55,68,75,72,66,62,56,50,40,30,18,10,0,0],
      rainy: [0,5, 12,20,30,38,42,40,35,32,28,22,18,14,8, 5, 0,0],
      foggy: [0,8, 18,30,42,52,58,55,48,44,40,32,25,18,10,6, 0,0],
    }
  },
  {
    id: 'tapkeshwar',
    name: 'Tapkeshwar Temple',
    subtitle: 'Temple · Cave Shrine',
    category: 'temple',
    emoji: '🛕',
    bgGrad: 'linear-gradient(135deg,#e07b29,#f4a529)',
    rating: 4.6,
    entryFee: 'Free',
    distance: '5 km from city',
    openHour: 6,
    closeHour: 20,
    bestTime: 'Early morning (6–8 AM) for peaceful darshan',
    tips: 'Remove footwear before entering. Shiv Ratri sees massive crowds — avoid if you prefer quiet visits. The cave drips natural spring water on the Shivling — very sacred.',
    tags: ['🛕 Temple','🙏 Spiritual','🕯️ Heritage','👨‍👩‍👧 Family'],
    crowd: {
      sunny: [35,55,70,65,50,60,65,62,58,54,48,55,60,65,60,50,35,20],
      cloudy:[28,45,58,55,42,50,55,52,48,44,38,45,50,55,50,40,28,15],
      rainy: [15,25,32,30,25,28,30,28,25,22,20,22,25,28,25,18,12,8],
      foggy: [20,35,45,42,32,38,42,40,36,32,28,32,38,42,38,28,18,10],
    }
  },
  {
    id: 'mindrolling',
    name: 'Mindrolling Monastery',
    subtitle: 'Buddhist · Heritage',
    category: 'heritage',
    emoji: '🏯',
    bgGrad: 'linear-gradient(135deg,#6a0572,#d9534f)',
    rating: 4.7,
    entryFee: 'Free (₹20 camera)',
    distance: '4 km from city',
    openHour: 9,
    closeHour: 18,
    bestTime: '9–11 AM on weekdays',
    tips: 'Dress modestly and maintain silence. The Great Stupa is 185 ft tall — impressive at dusk. Photography inside the main prayer hall is restricted.',
    tags: ['🏯 Heritage','🙏 Buddhist','📸 Architecture','🌿 Garden'],
    crowd: {
      sunny: [0,0,0,25,40,55,65,60,55,50,45,40,35,28,18,0,0,0],
      cloudy:[0,0,0,18,32,45,55,50,45,42,38,32,28,20,12,0,0,0],
      rainy: [0,0,0,10,20,28,32,30,26,22,20,18,15,10,6, 0,0,0],
      foggy: [0,0,0,12,25,35,42,38,34,30,26,22,18,12,8, 0,0,0],
    }
  },
  {
    id: 'rajaji',
    name: 'Rajaji National Park',
    subtitle: 'Wildlife · Jungle Safari',
    category: 'wildlife',
    emoji: '🐘',
    bgGrad: 'linear-gradient(135deg,#1e4030,#2d6a4f)',
    rating: 4.4,
    entryFee: '₹150 Indian / ₹600 Foreign',
    distance: '6 km from city',
    openHour: 6,
    closeHour: 18,
    bestTime: 'Dawn safari (6–9 AM) for wildlife sightings',
    tips: 'Book jeep safari online in advance. Best months: November–June. Monsoon season closes the park partially. Elephants, leopards, and over 400 bird species can be spotted.',
    tags: ['🐘 Wildlife','🦅 Birds','🌿 Safari','🏕️ Adventure'],
    crowd: {
      sunny: [40,55,65,50,40,35,30,28,32,35,42,48,40,28,15,0,0,0],
      cloudy:[32,45,55,42,32,28,25,22,25,28,35,40,32,20,10,0,0,0],
      rainy: [10,15,20,15,12,10,8, 8, 10,12,15,18,15,10,5, 0,0,0],
      foggy: [15,25,35,28,20,16,14,12,15,18,22,28,22,14,6, 0,0,0],
    }
  },
  {
    id: 'paltan-bazaar',
    name: 'Paltan Bazaar',
    subtitle: 'Market · Shopping Hub',
    category: 'market',
    emoji: '🛍️',
    bgGrad: 'linear-gradient(135deg,#c0392b,#e07b29)',
    rating: 4.2,
    entryFee: 'Free',
    distance: '1 km city centre',
    openHour: 10,
    closeHour: 22,
    bestTime: 'Weekday afternoons (2–5 PM)',
    tips: 'Best for local handicrafts, Basmati rice, and litchi products. Bargaining is expected. Avoid Saturdays — extremely crowded. Try the local street food near the Clock Tower.',
    tags: ['🛍️ Shopping','🍜 Street Food','🎨 Handicrafts','🌃 Nightlife'],
    crowd: {
      sunny: [0,0,0,0,15,30,45,55,62,68,75,82,88,85,80,72,60,40],
      cloudy:[0,0,0,0,12,25,38,48,55,60,68,72,78,75,70,62,50,32],
      rainy: [0,0,0,0,8, 15,22,30,35,38,42,48,52,50,45,38,28,18],
      foggy: [0,0,0,0,10,20,32,40,46,50,56,62,68,65,58,50,38,24],
    }
  },
  {
    id: 'forest-research',
    name: 'Forest Research Institute',
    subtitle: 'Heritage · Museum',
    category: 'heritage',
    emoji: '🏛️',
    bgGrad: 'linear-gradient(135deg,#4a4e69,#9a8c98)',
    rating: 4.5,
    entryFee: '₹40 Indian / ₹150 Foreign',
    distance: '3 km from city',
    openHour: 9,
    closeHour: 17,
    bestTime: '9–11 AM on weekdays',
    tips: 'The colonial-era building is stunning — great for photography. Six museums inside cover botany, forestry, and ecology. The grounds are excellent for a picnic. Arrive before 10 AM to beat school groups.',
    tags: ['🏛️ Heritage','🌿 Nature','🏫 Museum','📸 Photography'],
    crowd: {
      sunny: [0,0,0,20,38,50,58,55,50,46,40,35,28,18,0,0,0,0],
      cloudy:[0,0,0,15,30,42,50,46,42,38,32,28,22,14,0,0,0,0],
      rainy: [0,0,0,8, 18,25,28,26,22,20,18,14,10,6, 0,0,0,0],
      foggy: [0,0,0,10,22,32,38,35,30,28,24,18,14,8, 0,0,0,0],
    }
  },
  {
    id: 'lacchiwala',
    name: 'Lacchiwala Nature Park',
    subtitle: 'Nature · Picnic Spot',
    category: 'nature',
    emoji: '🌲',
    bgGrad: 'linear-gradient(135deg,#40916c,#95d5b2)',
    rating: 4.1,
    entryFee: '₹20/person',
    distance: '22 km from city',
    openHour: 7,
    closeHour: 18,
    bestTime: 'Weekday mornings (7–10 AM)',
    tips: 'A hidden gem among Dehradun locals. The Suswa River runs through the park — great for children. Carry your own food as options are limited. Weekends get very crowded with families.',
    tags: ['🌲 Nature','🏖️ Picnic','🏊 Swimming','👨‍👩‍👧 Family'],
    crowd: {
      sunny: [0,10,20,30,48,60,70,68,62,58,52,45,35,22,12,0,0,0],
      cloudy:[0,8, 15,22,38,50,58,56,50,46,42,36,26,16,8, 0,0,0],
      rainy: [0,4, 8, 12,20,26,30,28,24,22,18,15,10,8, 4, 0,0,0],
      foggy: [0,6, 12,18,30,40,48,46,40,36,30,25,18,10,5, 0,0,0],
    }
  }
];

export function getPlaceData(place, weather, hourIndex) {
  const crowdData = place.crowd[weather] || place.crowd.sunny;
  const currentCrowd = crowdData[hourIndex] ?? 0;
  const hour = HOURS[hourIndex];
  const isOpen = hour >= place.openHour && hour < place.closeHour;

  const openData = crowdData.filter((_, i) => HOURS[i] >= place.openHour && HOURS[i] < place.closeHour);
  const avgCrowd = openData.length
    ? Math.round(openData.reduce((a, b) => a + b, 0) / openData.length)
    : 0;

  let peakCrowd = 0, peakHourIndex = 0;
  crowdData.forEach((v, i) => {
    if (v > peakCrowd) { peakCrowd = v; peakHourIndex = i; }
  });

  return { crowdData, currentCrowd, isOpen, avgCrowd, peakCrowd, peakHourIndex };
}
