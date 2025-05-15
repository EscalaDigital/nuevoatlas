document.addEventListener('DOMContentLoaded', () => {    // Configuración del sidebar plegable
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const toggleButton = document.getElementById('toggleSidebar');
    
    toggleButton.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        // Trigger a resize event para que el mapa se ajuste al nuevo tamaño
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300); // Esperar a que termine la transición
    });

    // Cerrar sidebar en móviles al hacer click en el mapa
    document.getElementById('map').addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
        }
    });

    const WMS_URL = 'https://kerdes.cica.es/gs-deep_rest/geoserver/wms?';
    const INITIAL_PROJECTION_CODE = 'EPSG:3857'; // Código de la proyección inicial
    const INITIAL_CENTER_LONLAT = [0, 0]; // Centro inicial en LonLat [lon, lat]
    const INITIAL_ZOOM = 2;
    let map;
    let osmLayer;
    let esriLayer;
    let esriLabelsLayer;
    let topoLayer;
    let oceanLayer;
    let terrainLayer;
    const activeWmsLayers = {};    // Definir los colores de fondo para cada capa base
    const BASE_LAYER_COLORS = {
        'esri': '#004255',  // Esri Satellite with Labels
        'osm': '#AAD3DF',   // OpenStreetMap
        'ocean': '#97BCE8', // Esri Ocean
        'topo': '#97D2E3'   // OpenTopoMap
    };

    // Función para actualizar el color de fondo del mapa
    function updateMapBackground(layerType) {
        const mapElement = document.getElementById('map');
        mapElement.style.backgroundColor = BASE_LAYER_COLORS[layerType] || '#ffffff';
    }

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
    }    // Función para actualizar las capas WMS cuando cambia la proyección
    function updateWmsLayers(newProjection) {
        Object.entries(activeWmsLayers).forEach(([layerName, layer]) => {
            // Obtener la visibilidad actual de la capa
            const isVisible = layer.getVisible();
            
            // Remover la capa antigua
            map.removeLayer(layer);
            
            // Usar EPSG:3857 para el WMS y dejar que OpenLayers haga la reproyección
            const wmsSource = new ol.source.ImageWMS({
                url: WMS_URL,
                params: {
                    'LAYERS': layerName,
                    'VERSION': '1.1.1',
                    'SRS': 'EPSG:3857' // Siempre usar Web Mercator para el WMS
                },
                serverType: 'geoserver',
                crossOrigin: 'anonymous',
                projection: 'EPSG:3857' // Proyección de origen
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
            visible: document.querySelector('input[data-layer-type="osm"]').checked,
            zIndex: 0
        });

        // Esri World Imagery - satélite de alta resolución
        esriLayer = new ol.layer.Group({
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                        attributions: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    }),
                    zIndex: 0
                }),
                new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                        attributions: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community'
                    }),
                    zIndex: 1
                })
            ],
            visible: document.querySelector('input[data-layer-type="esri"]').checked
        });

        // OpenTopoMap - mapa topográfico detallado
        topoLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
                attributions: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)'
            }),
            visible: document.querySelector('input[data-layer-type="topo"]').checked,
            zIndex: 0
        });

        // Esri Ocean - mapa especializado en océanos
        oceanLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
                attributions: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri'
            }),
            visible: document.querySelector('input[data-layer-type="ocean"]').checked,
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
            layers: [esriLayer, osmLayer, oceanLayer, topoLayer],
            view: new ol.View({
                projection: initialProjection,
                center: initialCenterProjected,
                zoom: INITIAL_ZOOM
            }),
            controls: mapControls
        });

        // Establecer el color de fondo inicial (asumiendo que Esri es la capa por defecto)
        updateMapBackground('esri');

        setupLayerControls();
        setupViewButtons();
        setupCategoryToggles();

        // Event listeners para los botones de capas base
        document.getElementById('esri').addEventListener('click', () => {
            esriLayer.setVisible(true);
            osmLayer.setVisible(false);
            oceanLayer.setVisible(false);
            topoLayer.setVisible(false);
            updateMapBackground('esri');
        });

        document.getElementById('osm').addEventListener('click', () => {
            esriLayer.setVisible(false);
            osmLayer.setVisible(true);
            oceanLayer.setVisible(false);
            topoLayer.setVisible(false);
            updateMapBackground('osm');
        });

        document.getElementById('ocean').addEventListener('click', () => {
            esriLayer.setVisible(false);
            osmLayer.setVisible(false);
            oceanLayer.setVisible(true);
            topoLayer.setVisible(false);
            updateMapBackground('ocean');
        });

        document.getElementById('topo').addEventListener('click', () => {
            esriLayer.setVisible(false);
            osmLayer.setVisible(false);
            oceanLayer.setVisible(false);
            topoLayer.setVisible(true);
            updateMapBackground('topo');
        });
    }    
    // Función para mostrar/ocultar la leyenda
    function toggleLegend(show = true) {
        const legend = document.getElementById('legend');
        if (show) {
            legend.classList.add('visible');
        } else {
            legend.classList.remove('visible');
        }
    }

    // Función para obtener la leyenda de una capa WMS
    function getLegendForLayer(layerName) {
        return `${WMS_URL}REQUEST=GetLegendGraphic&VERSION=1.1.1&FORMAT=image/png&LAYER=${layerName}`;
    }

    // Función para actualizar la leyenda
    function updateLegend() {
        const legendContent = document.querySelector('.legend-content');
        legendContent.innerHTML = '';
        let hasVisibleLayers = false;

        // Revisar todas las capas WMS activas
        Object.entries(activeWmsLayers).forEach(([layerName, layer]) => {
            if (layer.getVisible()) {
                hasVisibleLayers = true;
                const layerTitle = document.querySelector(`[data-layer-name="${layerName}"]`).dataset.layerTitle;
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                
                // Crear imagen de la leyenda
                const img = document.createElement('img');
                img.src = getLegendForLayer(layerName);
                img.alt = `Leyenda para ${layerTitle}`;
                img.style.maxWidth = '100%';
                
                // Añadir título de la capa
                const title = document.createElement('div');
                title.className = 'legend-title';
                title.textContent = layerTitle;
                
                legendItem.appendChild(title);
                legendItem.appendChild(img);
                legendContent.appendChild(legendItem);
            }
        });

        // Mostrar u ocultar la leyenda según si hay capas visibles
        toggleLegend(hasVisibleLayers);
    }

    // Configurar el botón de cerrar leyenda
    document.querySelector('.legend-header .btn-close').addEventListener('click', () => {
        toggleLegend(false);
    });

    function setupLayerControls() {
        const checkboxes = document.querySelectorAll('.layer-checkbox');
        const baseLayers = ['osm', 'esri', 'topo', 'ocean'];

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const layerName = event.target.dataset.layerName;
                const layerType = event.target.dataset.layerType;
                const currentProjection = map.getView().getProjection();

                // Si es una capa base
                if (baseLayers.includes(layerType)) {
                    // Si se está desmarcando, no permitirlo
                    if (!event.target.checked) {
                        event.target.checked = true;
                        return;
                    }
                    
                    // Desmarcar todas las otras capas base
                    checkboxes.forEach(otherCheckbox => {
                        if (otherCheckbox !== event.target && baseLayers.includes(otherCheckbox.dataset.layerType)) {
                            otherCheckbox.checked = false;
                        }
                    });

                    // Ocultar todas las capas base
                    osmLayer.setVisible(false);
                    esriLayer.setVisible(false);
                    topoLayer.setVisible(false);
                    oceanLayer.setVisible(false);

                    // Activar solo la capa seleccionada
                    if (layerType === 'osm') {
                        osmLayer.setVisible(true);
                    } else if (layerType === 'esri') {
                        esriLayer.setVisible(true);
                    } else if (layerType === 'topo') {
                        topoLayer.setVisible(true);
                    } else if (layerType === 'ocean') {
                        oceanLayer.setVisible(true);
                    }

                    // Actualizar el color de fondo del mapa
                    updateMapBackground(layerType);
                } else if (layerName) {
                    // Para capas WMS
                    if (event.target.checked) {
                        if (!activeWmsLayers[layerName]) {                            const wmsSource = new ol.source.ImageWMS({
                                url: WMS_URL,
                                params: {
                                    'LAYERS': layerName,
                                    'VERSION': '1.1.1',
                                    'SRS': 'EPSG:3857'
                                },
                                serverType: 'geoserver',
                                crossOrigin: 'anonymous',
                                projection: 'EPSG:3857'
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

                // Actualizar la leyenda después de cambiar la visibilidad de la capa
                updateLegend();
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
        });        document.getElementById('atlanticView').addEventListener('click', () => {
            // Usar proyección LAEA centrada en el Atlántico
            changeMapView('ATLANTIC_CUSTOM', [-45, 15], 4);
        });

        document.getElementById('pacificView').addEventListener('click', () => {
            // Usar proyección LAEA centrada en el Pacífico
            changeMapView('PACIFIC_CUSTOM', [-150, 0], 4);
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
