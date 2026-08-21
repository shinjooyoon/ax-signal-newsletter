// 발신 시점 기준 오늘 날씨 정보를 만든다. 우산/폭염/한파처럼 실용적으로 챙길 게
// 있으면 그걸 우선 알리는 문장(blurb)과, 헤더에 짧게 보여줄 아이콘/기온을 함께 반환한다.
// 딱히 챙길 게 없는 평범한 날에도 평균 기온/일교차 정보로 매번 뭔가는 보여준다
// (블러브 자체를 생략하지 않음). API 키 불필요한 Open-Meteo 사용.
const DEFAULT_LOCATION = { lat: 37.4, lon: 127.11 }; // 판교 (SK AX 본사 인근)

/**
 * @returns {Promise<{ icon: string, tempMax: number, tempMin: number, blurb: string } | null>}
 */
export async function getWeatherInfo({ lat, lon } = DEFAULT_LOCATION) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1`;

  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null; // 날씨 API 실패해도 발송 자체는 막지 않음
  }

  const tempMaxRaw = data?.daily?.temperature_2m_max?.[0];
  const tempMinRaw = data?.daily?.temperature_2m_min?.[0];
  const precipProb = data?.daily?.precipitation_probability_max?.[0];

  if (precipProb == null || tempMaxRaw == null || tempMinRaw == null) return null;

  const tempMax = Math.round(tempMaxRaw);
  const tempMin = Math.round(tempMinRaw);

  if (precipProb >= 50) {
    return {
      icon: '☔',
      tempMax,
      tempMin,
      blurb: `☔ 오늘 비 소식이 있어요 (강수확률 ${precipProb}%). 우산 챙기세요!`
    };
  }
  if (tempMaxRaw >= 33) {
    return { icon: '🥵', tempMax, tempMin, blurb: `🥵 오늘 폭염이에요 (최고 ${tempMax}°C). 물 챙기고 무리하지 마세요.` };
  }
  if (tempMaxRaw >= 30) {
    return { icon: '☀️', tempMax, tempMin, blurb: `☀️ 오늘 많이 더워요 (최고 ${tempMax}°C).` };
  }
  if (tempMinRaw <= 0) {
    return { icon: '🥶', tempMax, tempMin, blurb: `🥶 오늘 많이 추워요 (최저 ${tempMin}°C). 따뜻하게 입으세요.` };
  }

  // 딱히 챙길 건 없는 평범한 날 — 일교차가 크면 그걸, 아니면 평균 기온을 알려준다
  const diurnalRange = tempMaxRaw - tempMinRaw;
  if (diurnalRange >= 10) {
    return {
      icon: '🌡️',
      tempMax,
      tempMin,
      blurb: `🌡️ 오늘 일교차가 커요 (최저 ${tempMin}°C ~ 최고 ${tempMax}°C). 겉옷 챙기세요.`
    };
  }
  const avgTemp = Math.round((tempMaxRaw + tempMinRaw) / 2);
  return {
    icon: '🌤️',
    tempMax,
    tempMin,
    blurb: `🌤️ 오늘 평균 기온은 ${avgTemp}°C예요 (최저 ${tempMin}°C ~ 최고 ${tempMax}°C).`
  };
}
