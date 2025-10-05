"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// This is a common fix for a known issue with Leaflet's default icon in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-shadow.png",
});

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

export default function Map({ setLocation, setCoords, coords }) {
  return (
    <MapContainer
      center={[15.2993, 74.124]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <LocationPicker setLocation={setLocation} setCoords={setCoords} />
      {coords && <Marker position={[coords.lat, coords.lon]} />}
    </MapContainer>
  );
}
