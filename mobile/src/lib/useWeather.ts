import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';

// Dieppe, NB coordinates as fallback
const DIEPPE_COORDS = {
  lat: 46.0984,
  lon: -64.7242,
};

// OpenWeatherMap API key - user needs to add this to ENV tab
const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHERMAP_API_KEY || '';

interface WeatherData {
  temp: number;
  condition: string;
  description: string;
  icon: string;
  wind: string;
  humidity: string;
  iconCode: string;
}

interface OpenWeatherResponse {
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
}

async function fetchWeather(): Promise<WeatherData> {
  let lat = DIEPPE_COORDS.lat;
  let lon = DIEPPE_COORDS.lon;

  // Try to get user's location
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      lat = location.coords.latitude;
      lon = location.coords.longitude;
    }
  } catch (error) {
    // Fall back to Dieppe coordinates
    console.log('Location unavailable, using Dieppe, NB');
  }

  if (!API_KEY) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Weather data unavailable');
  }

  const data: OpenWeatherResponse = await response.json();

  return {
    temp: Math.round(data.main.temp),
    condition: data.weather[0]?.main || 'Unknown',
    description: data.weather[0]?.description || '',
    icon: data.weather[0]?.icon || '01d',
    iconCode: data.weather[0]?.icon || '01d',
    wind: `${Math.round(data.wind.speed * 3.6)} km/h`, // Convert m/s to km/h
    humidity: `${data.main.humidity}%`,
  };
}

export function useWeather() {
  return useQuery({
    queryKey: ['weather'],
    queryFn: fetchWeather,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour cache
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Map OpenWeatherMap icon codes to weather conditions for icon selection
export function getWeatherIconType(iconCode: string): 'sun' | 'cloud' | 'rain' | 'snow' | 'storm' | 'mist' {
  const code = iconCode.substring(0, 2);

  switch (code) {
    case '01': // clear sky
      return 'sun';
    case '02': // few clouds
    case '03': // scattered clouds
    case '04': // broken clouds
      return 'cloud';
    case '09': // shower rain
    case '10': // rain
      return 'rain';
    case '11': // thunderstorm
      return 'storm';
    case '13': // snow
      return 'snow';
    case '50': // mist
      return 'mist';
    default:
      return 'sun';
  }
}
