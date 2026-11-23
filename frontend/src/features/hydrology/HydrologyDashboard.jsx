import React, { useState, useRef } from 'react';
// तपाईंको प्रोजेक्ट स्ट्रक्चर अनुसारको पाथहरू
import MapWindow from './MapWindow'; 
import WatershedDelineation from './components/WatershedDelineation';

export default function HydrologyDashboard() {
  const [selectedAOI, setSelectedAOI] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true); // प्यानलको स्टेट
  const mapRef = useRef(null);

  // १. WatershedDelineation को DRAW बटन थिच्दा यो चल्छ
  const handleStartDrawing = () => {
    if (mapRef.current) {
      console.log("Triggering draw in MapWindow...");
      mapRef.current.startDrawing(); // MapWindow भित्रको useImperativeHandle कल गर्छ
    } else {
      console.error("Map reference not found!");
    }
  };

  // २. म्यापमा कोरेर सकिएपछि डेटा सेभ गर्ने
  const handleAreaSelected = (geojson) => {
    console.log("Area Selected:", geojson);
    setSelectedAOI(geojson);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      
      {/* बायाँ पट्टि: ३डी म्याप विन्डो */}
      <div className="flex-grow relative h-full">
        <MapWindow 
          ref={mapRef} 
          onAreaSelected={handleAreaSelected}
          selectedAOI={selectedAOI}
          isPanelOpen={isPanelOpen}
          boundaryColor="#06b6d4" // तपाईंको मनपर्ने रङ
        />
      </div>

      {/* दायाँ पट्टि: हाइड्रोलोजी टुल प्यानल */}
      <div className={`transition-all duration-300 shadow-2xl z-20 bg-white border-l ${isPanelOpen ? 'w-[400px]' : 'w-0'}`}>
        <WatershedDelineation 
          selectedAOI={selectedAOI} 
          onStartDrawing={handleStartDrawing}
          setStep={(s) => console.log("Current Step:", s)} // स्टेप म्यानेजमेन्टको लागि
        />
      </div>

      {/* प्यानल टोकल बटन (वैकल्पिक) */}
      <button 
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute right-4 top-4 z-30 p-2 bg-white rounded-full shadow-md hover:bg-slate-50 transition-colors"
      >
        {isPanelOpen ? '→' : '←'}
      </button>

    </div>
  );
}