document.addEventListener('DOMContentLoaded', () => {
    const WMS_URL = 'https://kerdes.cica.es/gs-deep_rest/geoserver/wms?';
    const INITIAL_PROJECTION = 'EPSG:3857';
    const INITIAL_CENTER = [0, 0];
    const INITIAL_ZOOM = 2;

    let map;
    let osmLayer;
    const activeWmsLayers = {};

    // Definiciones de Proyecciones con Proj4js
    proj4.defs('EPSG:3575', '+proj=laea +lat_0=90 +lon_0=10 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
    proj4.defs('ATLANTIC_CUSTOM', '+proj=laea +lat_0=15 +lon_0=-45 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
    proj4.defs('PACIFIC_CUSTOM', '+proj=laea +lat_0=0 +lon_0=-150 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
    ol.proj.proj4.register(proj4);

    function initMap() {
        osmLayer = new ol.layer.Tile({
            source: new ol.source.OSM(),
            visible: true,
            zIndex: 0 // Capa base siempre al fondo
        });

        // Definir los controles explícitamente
        // Esto reemplaza ol.control.defaults({ attributionOptions: { collapsible: false } })
        // para asegurar la compatibilidad si ol.control.defaults no se encuentra.
        const mapControls = [
            new ol.control.Zoom(),
            new ol.control.Rotate(),
            new ol.control.Attribution({
                collapsible: false // Mantener la atribución no colapsable
            })
        ];

        map = new ol.Map({
            target: 'map',
            layers: [osmLayer],
            view: new ol.View({
                projection: INITIAL_PROJECTION,
                center: INITIAL_CENTER,
                zoom: INITIAL_ZOOM
            }),
            controls: mapControls // Usar los controles definidos explícitamente
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
                const layerTitle = event.target.dataset.layerTitle;
                const layerType = event.target.dataset.layerType;

                if (layerType === 'osm') {
                    osmLayer.setVisible(event.target.checked);
                } else if (layerName) {
                    if (event.target.checked) {
                        if (!activeWmsLayers[layerName]) {
                            const wmsSource = new ol.source.ImageWMS({
                                url: WMS_URL,
                                params: { 'LAYERS': layerName }, // Se eliminó 'TILED': true
                                serverType: 'geoserver',
                                crossOrigin: 'anonymous'
                            });
                            const wmsLayer = new ol.layer.Image({
                                source: wmsSource,
                                visible: true,
                                zIndex: Object.keys(activeWmsLayers).length + 1 // Asegurar que las capas se superpongan correctamente
                            });
                            map.addLayer(wmsLayer);
                            activeWmsLayers[layerName] = wmsLayer;
                        }
                    } else {
                        if (activeWmsLayers[layerName]) {
                            map.removeLayer(activeWmsLayers[layerName]);
                            delete activeWmsLayers[layerName];
                        }
                    }
                }
            });
            // Activar capas WMS marcadas por defecto si es necesario (ninguna por ahora)
        });
    }

    function changeMapView(projectionCode, center, zoom, extent = null) {
        const newView = new ol.View({
            projection: projectionCode,
            center: center,
            zoom: zoom,
            extent: extent
        });
        map.setView(newView);
    }

    function setupViewButtons() {
        document.getElementById('homeButton').addEventListener('click', () => {
            changeMapView(INITIAL_PROJECTION, INITIAL_CENTER, INITIAL_ZOOM);
        });

        document.getElementById('globalView').addEventListener('click', () => {
            changeMapView(INITIAL_PROJECTION, INITIAL_CENTER, INITIAL_ZOOM);
        });

        document.getElementById('arcticView').addEventListener('click', () => {
            // Extent for EPSG:3575, covering the Arctic region
            const arcticExtent = [-4000000, -4000000, 4000000, 4000000]; // Ajustar según sea necesario
            changeMapView('EPSG:3575', [0,0], 1, arcticExtent);
        });

        document.getElementById('atlanticView').addEventListener('click', () => {
            // Extent for ATLANTIC_CUSTOM
            const atlanticExtent = [-6000000, -5000000, 5000000, 7000000]; // Ajustar según sea necesario
            changeMapView('ATLANTIC_CUSTOM', [0,0], 2, atlanticExtent);
        });

        document.getElementById('pacificView').addEventListener('click', () => {
            // Extent for PACIFIC_CUSTOM
            const pacificExtent = [-9000000, -6000000, 9000000, 6000000]; // Ajustar según sea necesario
            changeMapView('PACIFIC_CUSTOM', [0,0], 2, pacificExtent);
        });
    }

    function setupCategoryToggles() {
        const toggles = document.querySelectorAll('.category-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                const content = toggle.nextElementSibling;
                if (content.style.display === "block") {
                    content.style.display = "none";
                } else {
                    content.style.display = "block";
                }
            });
        });
    }

    initMap();
});
