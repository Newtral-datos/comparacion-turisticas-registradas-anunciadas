// VARIABLES GLOBALES PARA ACCESO DESDE EL HTML
let map, isFreeNav, isCanariasView, currentStep = 0;

const CONFIG = {
    pmtilesFile: 'geo_comparacion_viviendas.pmtiles',
    sourceLayer: 'geo_comparacion_viviendas',
    searchZoom: 12,
    fields: {
        municipio: 'municipio', 
        provincia: 'Provincia',
        anunciadas: 'viviendas', 
        registradas: 'registradas', 
        diferencia: 'diferencia'
    },
    views: {
        peninsula: { center: [-3.7038, 40.4168], zoom: 5.5 },
        canarias: { center: [-15.7, 28.3], zoom: 7 }
    },
    tourSteps: [
        { center: [-3.7038, 40.4168], zoom: 12, text: "Madrid presenta la mayor saturación de anuncios frente a registros oficiales.", pos: { top: '30%', left: '50%' } },
        { center: [2.1734, 41.3851], zoom: 13, text: "Barcelona ha implementado medidas drásticas en Ciutat Vella.", pos: { bottom: '25%', right: '10%' } }
    ]
};

// REGISTRO PMTILES
if (typeof pmtiles !== 'undefined') {
    let protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
}

// FUNCIÓN PARA CAMBIAR MODOS
function startMode(mode) {
    document.getElementById('mode-selector').style.display = 'none';
    document.getElementById('backToMenu').style.display = 'block';
    
    if (mode === 'tour') {
        isFreeNav = false;
        document.getElementById('tour-ui').style.display = 'block';
        document.getElementById('free-nav-ui').style.display = 'none';
        document.getElementById('map-legend').style.display = 'none'; // Para mostrar o no la leyenda en la navegación guiáda
        setMapInteractivity(false);
        updateTour();

    } else {
        isFreeNav = true;
        document.getElementById('tour-ui').style.display = 'none';
        document.getElementById('free-nav-ui').style.display = 'flex';
        
        // MOSTRAR LEYENDA
        document.getElementById('map-legend').style.display = 'block';
        
        setMapInteractivity(true);
    }
}

function setMapInteractivity(enabled) {
    const handlers = ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate'];
    handlers.forEach(h => enabled ? map[h].enable() : map[h].disable());
}

function updateTour() {
    const step = CONFIG.tourSteps[currentStep];
    map.flyTo({ center: step.center, zoom: step.zoom, duration: 3000 });
    const box = document.getElementById('tour-content');
    box.style.top = 'auto'; box.style.bottom = 'auto'; box.style.left = 'auto'; box.style.right = 'auto'; box.style.transform = 'none';
    Object.keys(step.pos).forEach(k => box.style[k] = step.pos[k]);
    if(step.pos.left === '50%') box.style.transform = 'translateX(-50%)';
    document.getElementById('tour-inner-text').innerHTML = `<span class="tour-highlight">${step.text}</span>`;
    document.getElementById('prevStep').style.display = (currentStep === 0) ? 'none' : 'flex';
    document.getElementById('nextStep').style.display = (currentStep === CONFIG.tourSteps.length - 1) ? 'none' : 'flex';
}

const getDiferenciaStyle = (field) => [
  'case',
  // Si el valor es nulo o no existe, pintamos de gris claro
  ['any', ['==', ['get', field], null], ['!', ['has', field]]], '#d8d8d8',
  [
    'interpolate',
    ['linear'],
    ['to-number', ['get', field]],

    // ESCALA DE VERDES (Ahora para valores negativos: <-300)
    -1000, '#007959', // Verde ultra intenso (antes rojo ultra intenso)
    -301,  '#018E69', 
    -150,  '#01A378',
    -50,   '#01CC96',
    -10,   '#83D79B',
    -3,    '#CCEBC8', // Verde muy suave

    // RANGO NEUTRO (Casi blanco)
    -2,    '#fefcef', 
    2,     '#fefcef',

    // ESCALA DE ROJOS (Ahora para valores positivos: 3 a >10.000)
    3,     '#fee2e2', // Rojo muy suave (antes verde muy suave)
    10,    '#f87171',
    50,    '#ef4444',
    150,   '#fca5a5',
    300,   '#f87171',
    500,   '#ef4444',
    1000,  '#dc2626',
    2400,  '#b91d1d',
    10000, '#7f1d1d'  // Rojo ultra intenso (antes verde ultra intenso)
  ]
];

// INICIALIZACIÓN CUANDO EL DOM ESTÁ LISTO
document.addEventListener("DOMContentLoaded", () => {
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: { 'carto-light': { type: 'raster', tiles: ["https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"], tileSize: 256 } },
            layers: [{ id: 'base', type: 'raster', source: 'carto-light' }]
        },
        center: CONFIG.views.peninsula.center, 
        zoom: CONFIG.views.peninsula.zoom
    });

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px' });
    const safe = (v) => isNaN(parseFloat(v)) ? "0" : parseFloat(v).toLocaleString('es-ES');

    const showFeaturePopup = (feature, lngLat) => {
        const p = feature.properties;
        const html = `<div style="padding:5px;">
            <big><strong>${p[CONFIG.fields.municipio]}</strong></big> <i style="color:#aaaaaa">(${p[CONFIG.fields.provincia]})</i><br>
            <strong>Viviendas turísticas:</strong><br>
            • Anunciadas: ${safe(p[CONFIG.fields.anunciadas])}<br>
            • Registradas: ${safe(p[CONFIG.fields.registradas])}<br>
            • Diferencia: <span style="color:${p[CONFIG.fields.diferencia]>0?'red':'green'}">${safe(p[CONFIG.fields.diferencia])}</span>
        </div>`;
        popup.setLngLat(lngLat).setHTML(html).addTo(map);
    };

    map.on('load', () => {
        map.addSource('mapa_rua', { type: 'vector', url: `pmtiles://${CONFIG.pmtilesFile}` });
        map.addLayer({ 
            id: 'capa_fill', type: 'fill', source: 'mapa_rua', 'source-layer': CONFIG.sourceLayer, 
            paint: { 'fill-color': getDiferenciaStyle(CONFIG.fields.diferencia), 'fill-opacity': 0.8, 'fill-outline-color': 'rgba(0,0,0,0.1)' } 
        });

        document.getElementById('randomLocation').onclick = () => {
            const features = map.queryRenderedFeatures({ layers: ['capa_fill'] });
            if (features.length > 0) {
                const f = features[Math.floor(Math.random() * features.length)];
                const center = turf.center(f).geometry.coordinates;
                map.flyTo({ center, zoom: 11 });
                map.once('moveend', () => showFeaturePopup(f, center));
            }
        };

        const btnCanarias = document.getElementById('toggleCanarias');
        btnCanarias.onclick = () => {
            if (!isCanariasView) {
                map.flyTo({ center: CONFIG.views.canarias.center, zoom: CONFIG.views.canarias.zoom, essential: true });
                btnCanarias.innerText = "🇪🇸"; isCanariasView = true;
            } else {
                map.flyTo({ center: CONFIG.views.peninsula.center, zoom: CONFIG.views.peninsula.zoom, essential: true });
                btnCanarias.innerText = "🇮🇨"; isCanariasView = false;
            }
        };

        const geocoder = new MaplibreGeocoder({
            forwardGeocode: async (c) => {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(c.query)}&format=geojson&countrycodes=es&limit=5`);
                const j = await res.json();
                return { features: j.features.map(f => ({ type: 'Feature', geometry: f.geometry, place_name: f.properties.display_name, center: f.geometry.coordinates }))};
            }
        }, { maplibregl: maplibregl, marker: false, placeholder: "Busca aquí un municipio", flyTo: false });

        document.getElementById("geocoder-container").appendChild(geocoder.onAdd(map));
        geocoder.on('result', (e) => {
            setTimeout(() => { map.flyTo({ center: e.result.center, zoom: CONFIG.searchZoom, speed: 1.2, essential: true }); }, 50); 
        });

        map.on('click', 'capa_fill', (e) => { if(isFreeNav) showFeaturePopup(e.features[0], e.lngLat); });
        setMapInteractivity(false);
    });

    document.getElementById('nextStep').onclick = () => { currentStep++; updateTour(); };
    document.getElementById('prevStep').onclick = () => { currentStep--; updateTour(); };
    document.getElementById('backToMenu').onclick = () => location.reload();
});