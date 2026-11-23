import React from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import axios from 'axios';
import { API_ORIGIN } from '../config';
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

const MapComponent = () => {
    const onCreated = async (e) => {
        const { layerType, layer } = e;
        if (layerType === "rectangle") {
            const bounds = layer.getBounds();
            const params = {
                south: bounds.getSouth(),
                north: bounds.getNorth(),
                west: bounds.getWest(),
                east: bounds.getEast()
            };

            try {
                const res = await axios.get(`${API_ORIGIN}/api/hydrology/fetch-dem`, { params });
                alert("Success: " + res.data.message);
            } catch (err) {
                alert("Error calling backend");
            }
        }
    };

    return (
        <MapContainer center={[27.7, 85.3]} zoom={13} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FeatureGroup>
                <EditControl 
                    position="topright" 
                    onCreated={onCreated}
                    draw={{ polygon: false, polyline: false, circle: false, marker: false, circlemarker: false, rectangle: true }}
                />
            </FeatureGroup>
        </MapContainer>
    );
};

export default MapComponent;