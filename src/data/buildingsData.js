// src/data/buildingsData.js
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { IMAGE_MAP } from './buildingImages'; // cargar las imagenes

// 🔄 Función para cargar solo edificios (sin personal)
export const fetchBuildings = async () => {
  try {
    const buildingsSnapshot = await getDocs(collection(db, 'edificio'));
    console.log("📄 Total edificios encontrados:", buildingsSnapshot.docs.length);

    if (buildingsSnapshot.docs.length === 0) {
      console.warn("⚠️ No se encontraron edificios");
      return [];
    }

    const buildings = buildingsSnapshot.docs.map((doc) => {
      const building = doc.data();
      const buildingId = doc.id;

      return {
        id: buildingId,
        name: building.name,
        position: typeof building.position === 'string'
          ? JSON.parse(building.position.replace(/(\w+):/g, '"$1":'))
          : building.position,
        image: IMAGE_MAP[building.image] || ''
      };
    });

    return buildings;
  } catch (error) {
    console.error("❌ Error al obtener edificios:", error);
    return [];
  }
};

// 🔄 Función para obtener personal según el id del edificio
export const fetchStaffByBuildingName = async (buildingName) => {
  try {
    // Validar que el nombre del edificio esté definido
    if (typeof buildingName !== 'string' || buildingName.trim() === '') {
      console.log("a", buildingName);
      console.warn("⚠️ No se puede buscar personal porque el nombre del edificio es inválido:", buildingName);
      return [];
    }

    const staffSnapshot = await getDocs(
      query(
        collection(db, 'personal'),
        where('location', '==', buildingName)
      )
    );

    return staffSnapshot.docs.map((doc) => {
      const { name, role, shift, schedule } = doc.data();
      return {
        name,
        position: role,
        shift,
        schedule
      };
    });

  } catch (error) {
    console.error(`❌ Error al obtener personal para el edificio ${buildingName}:`, error);
    return [];
  }
};
// 🔄 Cargar edificio del personal
export const fetchAllStaff = async () => {
  try {
    const staffSnapshot = await getDocs(collection(db, 'personal'));
    return staffSnapshot.docs.map(doc => {
      const { name, role, shift, academic_division, location, schedule } = doc.data();
      return {
        name,
        position: role,
        shift,
        buildingName: academic_division,
        buildingId: location,
        schedule
      };
    });
  } catch (error) {
    console.error("❌ Error al obtener todo el personal:", error);
    return [];
  }
};


// 🗺️ Configuración del mapa para Leaflet + OSM
export const MAP_CONFIG = {
  center: [20.656200261714417, -100.40449027864963], // [lat, lng] para Leaflet
  zoom: 17,
  minZoom: 10,
  maxZoom: 19
};

// 🚗 Configuración específica para OpenRouteService
export const OPENROUTE_CONFIG = {
  // 🔑 API Key de OpenRouteService (GRATIS: 2000 requests/día)
  apiKey: import.meta.env.VITE_OPENROUTE_API_KEY,

  // 🌐 URLs base para diferentes tipos de ruta
  baseUrls: {
    walking: 'https://api.openrouteservice.org/v2/directions/foot-walking',
    cycling: 'https://api.openrouteservice.org/v2/directions/cycling-regular',
    driving: 'https://api.openrouteservice.org/v2/directions/driving-car'
  },

  // ⚙️ Configuraciones por defecto
  defaultProfile: 'walking', // Para campus universitario

  // 📊 Parámetros de la API
  defaultParams: {
    format: 'json',
    geometry_format: 'geojson',
    instructions: 'true',
    units: 'km'
  }
};

// 🗺️ Configuración específica para tiles OSM
export const TILE_CONFIG = {
  // OpenStreetMap estándar (tu elección)
  osm: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19,
    minZoom: 1
  }
};

// ✅ SE MANTIENE IGUAL: Configuraciones de geolocalización
export const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 1000
};

// 🔧 Función para validar configuración de OpenRouteService
export const validateOpenRouteConfig = () => {
  if (!OPENROUTE_CONFIG.apiKey) {
    console.warn('⚠️ OpenRouteService API key no configurada');
    console.log('📝 Para obtener una API key gratuita:');
    console.log('1. Ir a https://openrouteservice.org/dev/#/signup');
    console.log('2. Registrarse (gratis)');
    console.log('3. Obtener API key (2000 requests/día gratis)');
    console.log('4. Agregar VITE_OPENROUTE_API_KEY=tu_api_key al archivo .env');
    return false;
  }

  console.log('✅ OpenRouteService configurado correctamente');
  return true;
};

// 🎯 Función helper para construir URLs de OpenRouteService
export const buildOpenRouteURL = (start, end, profile = 'walking') => {
  const baseUrl = OPENROUTE_CONFIG.baseUrls[profile];
  const apiKey = OPENROUTE_CONFIG.apiKey;

  if (!apiKey) {
    throw new Error('API key de OpenRouteService no configurada');
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    start: `${start.lng},${start.lat}`,
    end: `${end.lng},${end.lat}`,
    ...OPENROUTE_CONFIG.defaultParams
  });

  return `${baseUrl}?${params.toString()}`;
};