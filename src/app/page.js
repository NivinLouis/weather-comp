"use client";
// Import Leaflet and React Leaflet
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AnimatedBackground from "@/components/AnimatedBackground";
import "@/styles/animatedBackground.css";
import { useState, useEffect, useRef } from "react";
import {
  Cloud,
  MapPin,
  Calendar,
  Clock,
  Thermometer,
  Wind,
  Droplets,
  Snowflake,
  TrendingUp,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  X,
} from "lucide-react";

// Event presets
const EVENT_PRESETS = {
  "Select a preset...": {},
  "Beach Day 🏖️": { temp: [25, 32], rain: "Avoid rain", wind: "Low" },
  "Wedding Ceremony 💒": { temp: [20, 28], rain: "Avoid rain", wind: "Low" },
  "Hiking Trip 🥾": {
    temp: [15, 25],
    rain: "Don't mind rain",
    wind: "Doesn't matter",
  },
  "Skiing 🎿": { temp: [-5, 5], rain: "Prefer snow", wind: "Doesn't matter" },
};

const TIME_OF_DAY_MAPPING = {
  "Morning (6am-12pm)": [6, 12],
  "Afternoon (12pm-5pm)": [12, 17],
  "Evening (5pm-9pm)": [17, 21],
  "Night (9pm-6am)": [21, 6],
};

export default function WeatherCompass() {
  const [location, setLocation] = useState("Thrissur, India");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [targetDate, setTargetDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [timeOfDay, setTimeOfDay] = useState("Afternoon (12pm-5pm)");
  const [yearsOfData, setYearsOfData] = useState(28);
  const [tempRange, setTempRange] = useState([20, 30]);
  const [rainPref, setRainPref] = useState("Avoid rain");
  const [windPref, setWindPref] = useState("Low");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const searchTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);
  // Add map coordinates state
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchLocations = async (query) => {
    if (!query || query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query
        )}&count=5&language=en&format=json`
      );
      const data = await response.json();
      if (data.results) {
        setLocationSuggestions(data.results);
      } else {
        setLocationSuggestions([]);
      }
    } catch (err) {
      console.error("Failed to fetch location suggestions:", err);
      setLocationSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleLocationChange = (value) => {
    setLocation(value);
    setShowSuggestions(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  };

  const selectLocation = (suggestion) => {
    const locationString = `${suggestion.name}, ${suggestion.country}`;
    setLocation(locationString);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  const handlePresetChange = (preset) => {
    const presetData = EVENT_PRESETS[preset];
    if (presetData && Object.keys(presetData).length > 0) {
      setTempRange(presetData.temp);
      setRainPref(presetData.rain);
      setWindPref(presetData.wind);
    }
  };

  const getLocationCoordinates = async (locationName) => {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        locationName
      )}&count=1`
    );
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      throw new Error("Location not found");
    }
    return {
      lat: data.results[0].latitude,
      lon: data.results[0].longitude,
      name: data.results[0].name,
    };
  };

  const getHistoricalData = async (lat, lon, targetDate) => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 5);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - yearsOfData);

    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      hourly:
        "temperature_2m,relativehumidity_2m,apparent_temperature,precipitation,snowfall,windspeed_10m",
      timezone: "auto",
    });

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?${params}`
    );
    const data = await response.json();
    return data.hourly;
  };

  const processData = (hourlyData, targetDate) => {
    const targetMonth = new Date(targetDate).getMonth() + 1;
    const targetDay = new Date(targetDate).getDate();
    const [startHour, endHour] = TIME_OF_DAY_MAPPING[timeOfDay];

    const filteredData = [];
    for (let i = 0; i < hourlyData.time.length; i++) {
      const date = new Date(hourlyData.time[i]);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();

      if (month === targetMonth && day === targetDay) {
        const inTimeRange =
          startHour > endHour
            ? hour >= startHour || hour < endHour
            : hour >= startHour && hour < endHour;

        if (inTimeRange) {
          filteredData.push({
            year: date.getFullYear(),
            temp: hourlyData.temperature_2m[i],
            comfort: hourlyData.apparent_temperature[i],
            humidity: hourlyData.relativehumidity_2m[i],
            wind: hourlyData.windspeed_10m[i],
            rain: hourlyData.precipitation[i],
            snow: hourlyData.snowfall[i],
          });
        }
      }
    }

    const yearlyData = {};
    filteredData.forEach((record) => {
      if (!yearlyData[record.year]) {
        yearlyData[record.year] = {
          temps: [],
          comforts: [],
          humidities: [],
          winds: [],
          rains: [],
          snows: [],
        };
      }
      yearlyData[record.year].temps.push(record.temp);
      yearlyData[record.year].comforts.push(record.comfort);
      yearlyData[record.year].humidities.push(record.humidity);
      yearlyData[record.year].winds.push(record.wind);
      yearlyData[record.year].rains.push(record.rain);
      yearlyData[record.year].snows.push(record.snow);
    });

    const summary = Object.entries(yearlyData).map(([year, data]) => ({
      year: parseInt(year),
      temp_mean: data.temps.reduce((a, b) => a + b, 0) / data.temps.length,
      comfort_mean:
        data.comforts.reduce((a, b) => a + b, 0) / data.comforts.length,
      humidity_mean:
        data.humidities.reduce((a, b) => a + b, 0) / data.humidities.length,
      wind_max: Math.max(...data.winds),
      rain_sum: data.rains.reduce((a, b) => a + b, 0),
      snow_sum: data.snows.reduce((a, b) => a + b, 0),
    }));

    const analysis = {
      avg_temp: summary.reduce((a, b) => a + b.temp_mean, 0) / summary.length,
      avg_comfort:
        summary.reduce((a, b) => a + b.comfort_mean, 0) / summary.length,
      avg_humidity:
        summary.reduce((a, b) => a + b.humidity_mean, 0) / summary.length,
      avg_max_wind:
        summary.reduce((a, b) => a + b.wind_max, 0) / summary.length,
      rain_probability:
        (summary.filter((d) => d.rain_sum > 0.2).length / summary.length) * 100,
      snow_probability:
        (summary.filter((d) => d.snow_sum > 0).length / summary.length) * 100,
      yearly_summary: summary,
    };

    const n = summary.length;
    const sumX = summary.reduce((a, b) => a + b.year, 0);
    const sumY = summary.reduce((a, b) => a + b.temp_mean, 0);
    const sumXY = summary.reduce((a, b) => a + b.year * b.temp_mean, 0);
    const sumX2 = summary.reduce((a, b) => a + b.year * b.year, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    analysis.temp_trend = slope * 10;

    return analysis;
  };

  const calculateScore = (analysis) => {
    const scores = [];

    if (
      analysis.avg_temp >= tempRange[0] &&
      analysis.avg_temp <= tempRange[1]
    ) {
      scores.push(100);
    } else {
      const diff = Math.min(
        Math.abs(analysis.avg_temp - tempRange[0]),
        Math.abs(analysis.avg_temp - tempRange[1])
      );
      scores.push(Math.max(0, 100 - diff * 8));
    }

    if (rainPref === "Avoid rain") {
      scores.push(100 - analysis.rain_probability);
    } else if (rainPref === "Prefer snow") {
      scores.push(analysis.snow_probability);
    } else {
      scores.push(75);
    }

    const windLimits = { Low: 15, Moderate: 30 };
    if (windPref !== "Doesn't matter") {
      const limit = windLimits[windPref];
      if (analysis.avg_max_wind <= limit) {
        scores.push(100);
      } else {
        scores.push(Math.max(0, 100 - (analysis.avg_max_wind - limit) * 5));
      }
    } else {
      scores.push(75);
    }

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const handleAnalyze = async () => {
    if (!location || !targetDate) {
      setError("Please enter a location and select a date");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const coordsData = coords
        ? coords
        : await getLocationCoordinates(location);
      const historicalData = await getHistoricalData(
        coordsData.lat,
        coordsData.lon,
        targetDate
      );
      const analysisResult = processData(historicalData, targetDate);
      analysisResult.score = calculateScore(analysisResult);
      analysisResult.locationName = location;
      setAnalysis(analysisResult);
      setActiveTab("summary");
    } catch (err) {
      setError(err.message || "Failed to fetch weather data");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!analysis) return;
    const csv = [
      [
        "Year",
        "Avg Temp (°C)",
        "Feels Like (°C)",
        "Avg Humidity (%)",
        "Max Wind (km/h)",
        "Total Rain (mm)",
        "Total Snow (cm)",
      ],
      ...analysis.yearly_summary.map((d) => [
        d.year,
        d.temp_mean.toFixed(1),
        d.comfort_mean.toFixed(1),
        d.humidity_mean.toFixed(1),
        d.wind_max.toFixed(1),
        d.rain_sum.toFixed(2),
        d.snow_sum.toFixed(2),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weather_compass_${analysis.locationName}_${targetDate}.csv`;
    a.click();
  };

  // Function to change background dynamically
  const getDynamicBackground = () => {
    if (!analysis) return "from-slate-950 via-slate-900 to-slate-950";
    if (analysis.rain_probability > 60)
      return "from-blue-900 via-slate-800 to-slate-950";
    if (analysis.avg_temp > 30)
      return "from-orange-800 via-rose-700 to-purple-900";
    if (analysis.avg_temp < 15)
      return "from-blue-950 via-indigo-900 to-sky-800";
    return "from-green-800 via-emerald-700 to-blue-900";
  };

  // LocationPicker component for map
  function LocationPicker({ setLocation, setCoords }) {
    useMapEvents({
      async click(e) {
        const { lat, lng } = e.latlng;
        setCoords({ lat, lon: lng });

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();

          if (data && data.address) {
            const city =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              data.address.state;
            const country = data.address.country;
            const formatted = `${city ? city + ", " : ""}${country || ""}`;
            setLocation(formatted.trim());
          } else {
            setLocation(`Lat: ${lat.toFixed(2)}, Lon: ${lng.toFixed(2)}`);
          }
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
          setLocation(`Lat: ${lat.toFixed(2)}, Lon: ${lng.toFixed(2)}`);
        }
      },
    });
    return null;
  }

  const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <>
      <div className="relative min-h-screen overflow-hidden night-gradient text-slate-100">
        <AnimatedBackground />
        <div className="relative z-10">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-950/50 via-indigo-950/50 to-purple-950/50 backdrop-blur-xl border-b border-blue-500/20 shadow-2xl">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl backdrop-blur-sm">
                  <Cloud className="w-10 h-10 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Weather Compass
                  </h1>
                  <p className="text-slate-400 text-sm">
                    Plan your event, the stress is on us...
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
            <div className="flex flex-col lg:flex-row flex-wrap gap-4 lg:gap-6">
              {/* Sidebar */}
              <div className="w-full lg:flex-1 lg:min-w-[320px]">
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-4 sm:p-6 space-y-6 sticky top-4">
                  <div ref={suggestionsRef} className="relative">
                    <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-400" />
                      Location
                    </h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => handleLocationChange(e.target.value)}
                        onFocus={() =>
                          location.length >= 2 && setShowSuggestions(true)
                        }
                        className="w-full px-4 py-3 pl-10 bg-slate-800/50 border border-slate-600/50 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                        placeholder="Search location..."
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      {location && (
                        <button
                          onClick={() => {
                            setLocation("");
                            setLocationSuggestions([]);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {showSuggestions &&
                      (locationSuggestions.length > 0 ||
                        loadingSuggestions) && (
                        <div className="absolute z-10 w-full mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-600/50 rounded-xl shadow-2xl overflow-hidden">
                          {loadingSuggestions ? (
                            <div className="p-4 text-center text-slate-400">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            </div>
                          ) : (
                            locationSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => selectLocation(suggestion)}
                                className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
                              >
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                  <div>
                                    <div className="text-slate-200 font-medium">
                                      {suggestion.name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {suggestion.admin1 &&
                                        `${suggestion.admin1}, `}
                                      {suggestion.country}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                  </div>

                  {/* Map picker section */}
                  <div className="relative">
                    <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-400" />
                      Pick on Map
                    </h3>
                    <div className="h-56 sm:h-64 rounded-xl overflow-hidden border border-slate-700/50">
                      <MapContainer
                        center={[15.2993, 74.124]}
                        zoom={6}
                        style={{ height: "100%", width: "100%" }}
                        className="z-0"
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution="© OpenStreetMap"
                        />
                        <LocationPicker
                          setLocation={setLocation}
                          setCoords={setCoords}
                        />
                        {coords && (
                          <Marker
                            position={[coords.lat, coords.lon]}
                            icon={markerIcon}
                          />
                        )}
                      </MapContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      Target Date
                    </h3>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-400" />
                      Time of Day
                    </h3>
                    <select
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    >
                      {Object.keys(TIME_OF_DAY_MAPPING).map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-200 mb-3">
                      Event Preset
                    </h3>
                    <select
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    >
                      {Object.keys(EVENT_PRESETS).map((preset) => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <Thermometer className="w-5 h-5 text-orange-400" />
                      Temperature Range: {tempRange[0]}°C - {tempRange[1]}°C
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">
                          Min: {tempRange[0]}°C
                        </label>
                        <input
                          type="range"
                          min="-20"
                          max="50"
                          value={tempRange[0]}
                          onChange={(e) =>
                            setTempRange([
                              parseInt(e.target.value),
                              tempRange[1],
                            ])
                          }
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">
                          Max: {tempRange[1]}°C
                        </label>
                        <input
                          type="range"
                          min="-20"
                          max="50"
                          value={tempRange[1]}
                          onChange={(e) =>
                            setTempRange([
                              tempRange[0],
                              parseInt(e.target.value),
                            ])
                          }
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-blue-400" />
                      Rain Preference
                    </h3>
                    <div className="space-y-2">
                      {["Avoid rain", "Don't mind rain", "Prefer snow"].map(
                        (option) => (
                          <label
                            key={option}
                            className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
                          >
                            <input
                              type="radio"
                              name="rain"
                              value={option}
                              checked={rainPref === option}
                              onChange={(e) => setRainPref(e.target.value)}
                              className="text-blue-500 focus:ring-blue-500/50"
                            />
                            <span className="text-sm text-slate-300">
                              {option}
                            </span>
                          </label>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                      <Wind className="w-5 h-5 text-slate-400" />
                      Wind Preference
                    </h3>
                    <div className="space-y-2">
                      {["Low", "Moderate", "Doesn't matter"].map((option) => (
                        <label
                          key={option}
                          className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
                        >
                          <input
                            type="radio"
                            name="wind"
                            value={option}
                            checked={windPref === option}
                            onChange={(e) => setWindPref(e.target.value)}
                            className="text-blue-500 focus:ring-blue-500/50"
                          />
                          <span className="text-sm text-slate-300">
                            {option}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Analyze Weather
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="w-full lg:flex-[2] lg:min-w-[500px]">
                {error && (
                  <div className="bg-red-900/20 border border-red-500/50 text-red-300 rounded-xl p-4 mb-6 flex items-center gap-2 backdrop-blur-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {loading && (
                  <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 sm:p-12 text-center animate-pulse">
                    <div className="relative inline-block mb-6">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 blur-lg opacity-50 animate-spin-slow"></div>
                      <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-blue-500/30">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold text-slate-200 mb-2">
                      Analyzing years of data...
                    </h3>
                    <p className="text-slate-400">
                      Gathering {yearsOfData}+ years of weather history to
                      forecast suitability
                    </p>
                    <div className="mt-6 flex justify-center gap-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:0s]" />
                      <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                {!analysis && !loading && !error && (
                  <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8 sm:p-12 text-center">
                    <div className="p-4 sm:p-6 bg-blue-500/10 rounded-2xl inline-block mb-4">
                      <Cloud className="w-16 h-16 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-200 mb-2">
                      Ready to Analyze
                    </h3>
                    <p className="text-slate-400">
                      Configure your event details and click "Analyze Weather"
                      to generate a report
                    </p>
                  </div>
                )}

                {analysis && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-4 sm:p-6">
                      <h2 className="text-2xl font-bold text-slate-200 mb-1">
                        Report for {analysis.locationName}
                      </h2>
                      <p className="text-slate-400">
                        {new Date(targetDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}{" "}
                        during the {timeOfDay.split(" ")[0]}
                      </p>
                    </div>

                    {/* Tabs */}
                    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                      <div className="flex border-b border-slate-700/50">
                        {["summary", "charts", "data"].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 px-4 font-semibold capitalize transition-all ${
                              activeTab === tab
                                ? "bg-blue-500/20 text-blue-400 border-b-2 border-blue-500"
                                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 sm:p-6">
                        {activeTab === "summary" && (
                          <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="text-center">
                                <div
                                  className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-4 ${
                                    analysis.score >= 75
                                      ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 ring-2 ring-green-500/50"
                                      : analysis.score >= 50
                                      ? "bg-gradient-to-br from-yellow-500/20 to-amber-500/20 ring-2 ring-yellow-500/50"
                                      : "bg-gradient-to-br from-red-500/20 to-rose-500/20 ring-2 ring-red-500/50"
                                  }`}
                                >
                                  <span
                                    className={`text-4xl font-bold ${
                                      analysis.score >= 75
                                        ? "text-green-400"
                                        : analysis.score >= 50
                                        ? "text-yellow-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    {Math.round(analysis.score)}
                                  </span>
                                </div>
                                <h3 className="text-xl font-semibold text-slate-200 mb-2">
                                  Suitability Score
                                </h3>
                                <div
                                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                                    analysis.score >= 75
                                      ? "bg-green-500/20 text-green-300 ring-1 ring-green-500/50"
                                      : analysis.score >= 50
                                      ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/50"
                                      : "bg-red-500/20 text-red-300 ring-1 ring-red-500/50"
                                  }`}
                                >
                                  {analysis.score >= 75 ? (
                                    <CheckCircle className="w-5 h-5" />
                                  ) : (
                                    <Info className="w-5 h-5" />
                                  )}
                                  {analysis.score >= 75
                                    ? "Excellent!"
                                    : analysis.score >= 50
                                    ? "Good"
                                    : "Risky"}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-slate-200 mb-4">
                                  Predicted Conditions
                                </h3>
                                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl backdrop-blur-sm border border-slate-700/50">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-500/20 rounded-lg">
                                      <Thermometer className="w-5 h-5 text-orange-400" />
                                    </div>
                                    <span className="text-sm text-slate-400">
                                      Avg Temperature
                                    </span>
                                  </div>
                                  <span className="font-semibold text-slate-200">
                                    {analysis.avg_temp.toFixed(1)}°C
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl backdrop-blur-sm border border-slate-700/50">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                      <Droplets className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <span className="text-sm text-slate-400">
                                      Rain Probability
                                    </span>
                                  </div>
                                  <span className="font-semibold text-slate-200">
                                    {analysis.rain_probability.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl backdrop-blur-sm border border-slate-700/50">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-500/20 rounded-lg">
                                      <Wind className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <span className="text-sm text-slate-400">
                                      Avg Max Wind
                                    </span>
                                  </div>
                                  <span className="font-semibold text-slate-200">
                                    {analysis.avg_max_wind.toFixed(1)} km/h
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="border-t border-slate-700/50 pt-6">
                              <h3 className="text-lg font-semibold text-slate-200 mb-3">
                                Comfort Index
                              </h3>
                              <div
                                className={`p-4 rounded-xl backdrop-blur-sm border ${
                                  analysis.avg_comfort > 27 ||
                                  analysis.avg_comfort < 10
                                    ? "bg-red-500/10 border-red-500/50"
                                    : analysis.avg_comfort > 24 ||
                                      analysis.avg_comfort < 15
                                    ? "bg-yellow-500/10 border-yellow-500/50"
                                    : "bg-green-500/10 border-green-500/50"
                                }`}
                              >
                                <p
                                  className={`font-semibold ${
                                    analysis.avg_comfort > 27 ||
                                    analysis.avg_comfort < 10
                                      ? "text-red-300"
                                      : analysis.avg_comfort > 24 ||
                                        analysis.avg_comfort < 15
                                      ? "text-yellow-300"
                                      : "text-green-300"
                                  }`}
                                >
                                  {analysis.avg_comfort > 27 ||
                                  analysis.avg_comfort < 10
                                    ? "🔴 Challenging"
                                    : analysis.avg_comfort > 24 ||
                                      analysis.avg_comfort < 15
                                    ? "🟡 Manageable"
                                    : "🟢 Comfortable"}
                                  {" - "}Feels like{" "}
                                  {analysis.avg_comfort.toFixed(1)}°C
                                </p>
                              </div>
                            </div>

                            <div className="border-t border-slate-700/50 pt-6">
                              <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                                Temperature Trend Analysis
                              </h3>
                              <p className="text-slate-300">
                                {Math.abs(analysis.temp_trend) < 0.1
                                  ? "Stable temperature trend over the years."
                                  : analysis.temp_trend > 0
                                  ? `Warming trend of ~${analysis.temp_trend.toFixed(
                                      2
                                    )}°C per decade.`
                                  : `Cooling trend of ~${Math.abs(
                                      analysis.temp_trend
                                    ).toFixed(2)}°C per decade.`}
                              </p>
                            </div>
                          </div>
                        )}

                        {activeTab === "charts" && (
                          <div className="space-y-6">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-200 mb-4">
                                Temperature Over The Years
                              </h3>
                              <div className="h-64 flex items-end justify-between gap-1 bg-slate-800/30 p-4 rounded-xl">
                                {analysis.yearly_summary.map((d) => (
                                  <div
                                    key={d.year}
                                    className="flex-1 flex flex-col items-center gap-1"
                                  >
                                    <div
                                      className="w-full bg-gradient-to-t from-blue-500 via-blue-400 to-cyan-400 rounded-t transition-all hover:from-blue-600 hover:via-blue-500 hover:to-cyan-500 cursor-pointer shadow-lg shadow-blue-500/20"
                                      style={{
                                        height: `${(d.temp_mean / 40) * 100}%`,
                                      }}
                                      title={`${d.year}: ${d.temp_mean.toFixed(
                                        1
                                      )}°C`}
                                    />
                                    <span className="text-xs text-slate-500 rotate-45 origin-top-left mt-2">
                                      {d.year}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === "data" && (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="text-lg font-semibold text-slate-200">
                                Historical Data
                              </h3>
                              <button
                                onClick={downloadCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25"
                              >
                                <Download className="w-4 h-4" />
                                Download CSV
                              </button>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-700/50 text-xs sm:text-sm">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-800/50">
                                  <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">
                                      Year
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">
                                      Avg Temp
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">
                                      Feels Like
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">
                                      Humidity
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">
                                      Max Wind
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">
                                      Rain
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-300">
                                      Snow
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysis.yearly_summary.map((d) => (
                                    <tr
                                      key={d.year}
                                      className="border-t border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                                    >
                                      <td className="px-4 py-3 text-slate-300">
                                        {d.year}
                                      </td>
                                      <td className="px-4 py-3 text-slate-300">
                                        {d.temp_mean.toFixed(1)}°C
                                      </td>
                                      <td className="px-4 py-3 text-slate-300">
                                        {d.comfort_mean.toFixed(1)}°C
                                      </td>
                                      <td className="px-4 py-3 text-slate-300">
                                        {d.humidity_mean.toFixed(1)}%
                                      </td>
                                      <td className="px-4 py-3 text-slate-300">
                                        {d.wind_max.toFixed(1)} km/h
                                      </td>
                                      <td className="px-4 py-3 text-slate-300">
                                        {d.rain_sum.toFixed(2)} mm
                                      </td>
                                      <td className="px-4 py-3 text-slate-300">
                                        {d.snow_sum.toFixed(2)} cm
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-900/50 backdrop-blur-xl border-t border-slate-700/50 mt-8 sm:mt-12 py-4 sm:py-6">
            <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
              <p>
                Weather Compass • Analyzing historical patterns to guide your
                planning
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Note: Does not predict the future, but analyzes the past
              </p>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes float {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 1000px 1000px;
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 5s linear infinite;
        }

        .night-gradient {
          background: radial-gradient(
              circle at 20% 20%,
              rgba(36, 58, 108, 0.4),
              transparent 60%
            ),
            radial-gradient(
              circle at 80% 80%,
              rgba(12, 32, 68, 0.4),
              transparent 60%
            ),
            linear-gradient(to bottom right, #0a0f24, #111b34, #1a2744);
          background-attachment: fixed;
          background-size: cover;
          animation: gradientShift 15s ease-in-out infinite alternate;
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 100% 100%;
          }
        }
      `}</style>
    </>
  );
}
