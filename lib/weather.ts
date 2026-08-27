// Thin proxy over Open-Meteo's free, keyless current-weather API.

export interface WeatherSnapshot {
  temperatureC: number;
  icon: string;
  description: string;
}

const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "בהיר", icon: "☀️" },
  1: { description: "בהיר בעיקר", icon: "🌤️" },
  2: { description: "מעונן חלקית", icon: "⛅" },
  3: { description: "מעונן", icon: "☁️" },
  45: { description: "ערפל", icon: "🌫️" },
  48: { description: "ערפל קפוא", icon: "🌫️" },
  51: { description: "טפטוף קל", icon: "🌦️" },
  53: { description: "טפטוף", icon: "🌦️" },
  55: { description: "טפטוף חזק", icon: "🌦️" },
  61: { description: "גשם קל", icon: "🌧️" },
  63: { description: "גשם", icon: "🌧️" },
  65: { description: "גשם חזק", icon: "🌧️" },
  71: { description: "שלג קל", icon: "🌨️" },
  73: { description: "שלג", icon: "🌨️" },
  75: { description: "שלג כבד", icon: "🌨️" },
  80: { description: "ממטרים קלים", icon: "🌦️" },
  81: { description: "ממטרים", icon: "🌦️" },
  82: { description: "ממטרים עזים", icon: "⛈️" },
  95: { description: "סופת רעמים", icon: "⛈️" },
};

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherSnapshot | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=Asia%2FJerusalem`;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const data = await res.json();
    const temperature = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temperature !== "number" || typeof code !== "number") return null;
    const meta = WEATHER_CODES[code] ?? { description: "לא ידוע", icon: "🌡️" };
    return { temperatureC: Math.round(temperature), icon: meta.icon, description: meta.description };
  } catch {
    return null;
  }
}
