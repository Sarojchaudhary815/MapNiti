// Mock API logic - Pachi backend sanga connect hunchha
export const urbanApi = {
  fetchLULC: async (year) => {
    console.log(`Fetching LULC data for ${year}...`);
    // Mock URL - actual backend call yeta hunchha
    return `https://api.mapniti.com/raster/lulc_${year}/{z}/{x}/{y}.png`;
  },
  
  runSuitability: async (weights) => {
    console.log("Processing Weighted Overlay with weights:", weights);
    return { success: true, layerId: "suitability_result_99" };
  }
};