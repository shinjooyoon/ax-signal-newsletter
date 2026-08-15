// 발신 시점 기준 오늘 날씨를 보고, 실용적인 한 줄(우산/더위/추위)만 만든다.
// API 키 불필요한 Open-Meteo 사용. 딱히 알릴 게 없으면 null (배너 자체를 생략).
const DEFAULT_LOCATION = { lat: 37.4, lon: 127.11 }; // 판교 (SK AX 본사 인근)

export async function getWeatherBlurb({ lat, lon } = DEFAULT_LOCATION) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1`;

  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null; // 날씨 API 실패해도 발송 자체는 막지 않음
  }

  const tempMax = data?.daily?.temperature_2m_max?.[0];
  const tempMin = data?.daily?.temperature_2m_min?.[0];
  const precipProb = data?.daily?.precipitation_probability_max?.[0];

  if (precipProb == null || tempMax == null) return null;

  if (precipProb >= 50) {
    return `☔ 오늘 비 소식이 있어요 (강수확률 ${precipProb}%). 우산 챙기세요!`;
  }
  if (tempMax >= 33) {
    return `🥵 오늘 폭염이에요 (최고 ${Math.round(tempMax)}°C). 물 챙기고 무리하지 마세요.`;
  }
  if (tempMax >= 30) {
    return `☀️ 오늘 많이 더워요 (최고 ${Math.round(tempMax)}°C).`;
  }
  if (tempMin != null && tempMin <= 0) {
    return `🥶 오늘 많이 추워요 (최저 ${Math.round(tempMin)}°C). 따뜻하게 입으세요.`;
  }
  return null;
}
