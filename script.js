document.addEventListener('DOMContentLoaded', () => {
    const WMS_URL = 'https://kerdes.cica.es/gs-deep_rest/geoserver/wms?';
    const INITIAL_PROJECTION_CODE = 'EPSG:3857'; // Código de la proyección inicial
    const INITIAL_CENTER_LONLAT = [0, 0]; // Centro inicial en LonLat [lon, lat]
    const INITIAL_ZOOM = 2;

    let map;
    let osmLayer;
    let terrainLayer;
    const activeWmsLayers = {};

    // Definiciones de Proyecciones con Proj4js
    // Asegúrate de que Proj4js está cargado antes que este script
    if (typeof proj4 !== 'undefined') {
        proj4.defs('EPSG:3575', '+proj=laea +lat_0=90 +lon_0=10 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
        proj4.defs('ATLANTIC_CUSTOM', '+proj=laea +lat_0=15 +lon_0=-45 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
        proj4.defs('PACIFIC_CUSTOM', '+proj=laea +lat_0=0 +lon_0=-150 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
        ol.proj.proj4.register(proj4);
    } else {
        console.error("Proj4js no está cargado. Las proyecciones personalizadas no funcionarán.");
        return;
    }

    // Función para actualizar las capas WMS cuando cambia la proyección
    function updateWmsLayers(newProjection) {
        Object.entries(activeWmsLayers).forEach(([layerName, layer]) => {
            // Obtener la visibilidad actual de la capa
            const isVisible = layer.getVisible();
            
            // Remover la capa antigua
            map.removeLayer(layer);
            
            // Crear una nueva fuente WMS con la proyección actualizada
            const wmsSource = new ol.source.ImageWMS({
                url: WMS_URL,
                params: {
                    'LAYERS': layerName,
                    'VERSION': '1.1.1',
                    'SRS': newProjection.getCode() // Usar el código de la nueva proyección
                },
                serverType: 'geoserver',
                crossOrigin: 'anonymous',
                projection: newProjection
            });

            // Crear una nueva capa con la fuente actualizada
            const newWmsLayer = new ol.layer.Image({
                source: wmsSource,
                visible: isVisible,
                zIndex: layer.getZIndex()
            });

            // Añadir la nueva capa al mapa y actualizar la referencia
            map.addLayer(newWmsLayer);
            activeWmsLayers[layerName] = newWmsLayer;
        });
    }

    function initMap() {
        osmLayer = new ol.layer.Tile({
            source: new ol.source.OSM(),
            visible: document.querySelector('input[data-layer-type="osm"]').checked, // Visibilidad según HTML
            zIndex: 0
        });

        terrainLayer = new ol.layer.Tile({
            source: new ol.source.OSM({ // Fuente de ejemplo para Terrain Map
                url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
                attributions: 'Map data: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            }),
            visible: document.querySelector('input[data-layer-type="terrain"]').checked, // Visibilidad según HTML
            zIndex: 0
        });

        const mapControls = [
            new ol.control.Zoom(),
            new ol.control.Rotate(),
            new ol.control.Attribution({
                collapsible: false
            })
        ];

        const initialProjection = ol.proj.get(INITIAL_PROJECTION_CODE);
        const initialCenterProjected = ol.proj.fromLonLat(INITIAL_CENTER_LONLAT, initialProjection);

        map = new ol.Map({
            target: 'map',
            layers: [osmLayer, terrainLayer],
            view: new ol.View({
                projection: initialProjection,
                center: initialCenterProjected,
                zoom: INITIAL_ZOOM
            }),
            controls: mapControls
        });

        setupLayerControls();
        setupViewButtons();
        setupCategoryToggles();
    }

    function setupLayerControls() {
        const checkboxes = document.querySelectorAll('.layer-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const layerName = event.target.dataset.layerName;
                const layerType = event.target.dataset.layerType;
                const currentProjection = map.getView().getProjection();

                if (layerType === 'osm') {
                    osmLayer.setVisible(event.target.checked);
                } else if (layerType === 'terrain') {
                    terrainLayer.setVisible(event.target.checked);
                } else if (layerName) {
                    if (event.target.checked) {
                        if (!activeWmsLayers[layerName]) {
                            const wmsSource = new ol.source.ImageWMS({
                                url: WMS_URL,
                                params: {
                                    'LAYERS': layerName,
                                    'VERSION': '1.1.1',
                                    'SRS': currentProjection.getCode()
                                },
                                serverType: 'geoserver',
                                crossOrigin: 'anonymous',
                                projection: currentProjection
                            });
                            const wmsLayer = new ol.layer.Image({
                                source: wmsSource,
                                visible: true,
                                zIndex: Object.keys(activeWmsLayers).length + 1
                            });
                            map.addLayer(wmsLayer);
                            activeWmsLayers[layerName] = wmsLayer;
                        } else {
                            activeWmsLayers[layerName].setVisible(true);
                        }
                    } else if (activeWmsLayers[layerName]) {
                        activeWmsLayers[layerName].setVisible(false);
                    }
                }
            });
        });
    }

    function changeMapView(projectionCode, centerLonLat, zoom) {
        const targetProjection = ol.proj.get(projectionCode);
        if (!targetProjection) {
            console.error(`Proyección ${projectionCode} no encontrada. Asegúrate de que esté definida y registrada.`);
            return;
        }
        
        const projectedCenter = ol.proj.fromLonLat(centerLonLat, targetProjection);
        
        const newView = new ol.View({
            projection: targetProjection,
            center: projectedCenter,
            zoom: zoom
        });
        map.setView(newView);

        // Actualizar las capas WMS con la nueva proyección
        updateWmsLayers(targetProjection);
    }

    function setupViewButtons() {
        document.getElementById('homeButton').addEventListener('click', () => {
            changeMapView(INITIAL_PROJECTION_CODE, INITIAL_CENTER_LONLAT, INITIAL_ZOOM);
        });

        document.getElementById('globalView').addEventListener('click', () => {
            changeMapView(INITIAL_PROJECTION_CODE, INITIAL_CENTER_LONLAT, INITIAL_ZOOM);
        });

        document.getElementById('arcticView').addEventListener('click', () => {
            // Centro LonLat [10, 90] para EPSG:3575 (proyección centrada en Lon 10, Lat 90)
            changeMapView('EPSG:3575', [10, 90], 2); // Zoom ajustado para mejor visualización del Ártico
        });

        document.getElementById('atlanticView').addEventListener('click', () => {
            // Centro LonLat [-45, 15] para ATLANTIC_CUSTOM (proyección centrada en Lon -45, Lat 15)
            changeMapView('ATLANTIC_CUSTOM', [-45, 15], 3);
        });

        document.getElementById('pacificView').addEventListener('click', () => {
            // Centro LonLat [-150, 0] para PACIFIC_CUSTOM (proyección centrada en Lon -150, Lat 0)
            changeMapView('PACIFIC_CUSTOM', [-150, 0], 3);
        });
    }

    function setupCategoryToggles() {
        const toggles = document.querySelectorAll('.category-toggle');
        toggles.forEach(toggle => {
            const content = toggle.nextElementSibling;
            // Respetar estado inicial del HTML para 'active' y 'open'
            if (toggle.classList.contains('active')) {
                content.classList.add('open');
                 // Asegurar que el display:block no interfiera con la animación si se quita 'open'
                if (!content.classList.contains('open')) {
                    content.style.display = 'none'; 
                } else {
                    content.style.display = 'block'; // Necesario si 'open' solo controla max-height
                }
            } else {
                content.classList.remove('open');
                content.style.display = 'none';
            }

            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                content.classList.toggle('open');
                if (content.classList.contains('open')) {
                    content.style.display = 'block'; // Para iniciar la animación de apertura
                } else {
                    // El cierre se maneja por la transición de max-height a 0 en CSS
                    // Si no usas max-height para animar, entonces: content.style.display = 'none';
                }
            });
        });
         // Asegurar que el contenido inicialmente abierto (Base Layers) sea visible
        const initiallyOpenContent = document.querySelector('.category-toggle.active + .layers-content');
        if (initiallyOpenContent && initiallyOpenContent.classList.contains('open')) {
            initiallyOpenContent.style.display = 'block';
        }
    }

    initMap();
});
