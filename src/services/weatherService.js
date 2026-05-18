const axios = require('axios');

const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Get current weather by coordinates
exports.getWeather = async (lat, lon) => {
  try {
    const response = await axios.get(`${WEATHER_BASE_URL}/weather`, {
      params: { lat, lon, appid: WEATHER_API_KEY, units: 'metric' },
    });
    const { main, weather, wind, name } = response.data;
    return {
      location: name,
      temperature: main.temp,
      feelsLike: main.feels_like,
      humidity: main.humidity,
      description: weather[0].description,
      windSpeed: wind.speed,
      icon: `https://openweathermap.org/img/w/${weather[0].icon}.png`,
    };
  } catch (error) {
    console.error('Weather Service Error:', error.message);
    return null;
  }
};

// Get 5-day weather forecast
exports.getForecast = async (lat, lon) => {
  try {
    const response = await axios.get(`${WEATHER_BASE_URL}/forecast`, {
      params: { lat, lon, appid: WEATHER_API_KEY, units: 'metric' },
    });
    return response.data.list.slice(0, 10); // Next 3 days
  } catch (error) {
    console.error('Weather Forecast Error:', error.message);
    return [];
  }
};
