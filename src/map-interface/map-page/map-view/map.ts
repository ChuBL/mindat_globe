import { Component, forwardRef } from "react";
import { SETTINGS } from "../../settings";
import { mapStyle } from "../map-style";
import { getPBDBData, getMindatData, getPaleoPoints, getPaleoBounds, getAge, getCoasts } from "./filter-helpers";
import h from "@macrostrat/hyper";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { setMapStyle } from "./style-helpers";
import { MapLayer } from "~/map-interface/app-state";
import { ColumnProperties } from "~/map-interface/app-state/handlers/columns";
// import { getClusters } from "~/map-interface/app-state/hooks"
import Supercluster from "supercluster";

const paleoCoastUrl = `${SETTINGS.coastlinePointDomain}?&model=SETON2012`;
const maxClusterZoom = 6;
const highlightLayers = [
  { layer: "pbdb-points", source: "pbdb-points" },
  { layer: "pbdb-points-clustered", source: "pbdb-points" },
  { layer: "pbdb-clusters", source: "pbdb-clusters" },
  { layer: "mindat-points", source: "mindat-points"},
  { layer: "mindat-clusters", source: "mindat-clusters"},
  { layer: "coasts", source: "coasts"},
];

interface MapProps {
  use3D: boolean;
  isDark: boolean;
  mapIsRotated: boolean;
  mapIsLoading: boolean;
  onQueryMap: (event: any, columns: ColumnProperties[]) => void;
}

//function to decide when to retrieve coasts, this is set when the age slider of paleoCoasts is released
//and it is unset once the command begins to run
let shouldRetrieveCoasts = false;

export function setRetrieveCoasts(shouldRetrieve) {
  shouldRetrieveCoasts = shouldRetrieve;
}

class VestigialMap extends Component<MapProps, {}> {
  map: mapboxgl.Map;
  marker: mapboxgl.Marker | null = null;
  constructor(props) {
    super(props);
    this.mapLoaded = false;
    this.currentSources = [];
    this.elevationPoints = [];

    this.maxValue = 500;
    this.previousZoom = 0;

    // We need to store these for cluster querying...
    this.pbdbPoints = {};
    this.mindatPoints = {};

    // Keep track of unique ids for interaction states
    this.hoverStates = {};
    this.selectedStates = {};
  }

  onStyleLoad() {
    // The initial draw of the layers
    if (!this.map.style._loaded) {
      return;
    }

    const { mapLayers } = this.props;
    mapStyle.layers.forEach((layer) => {
      // Populate the objects that track interaction states
      this.hoverStates[layer.id] = null;
      this.selectedStates[layer.id] = null;

      // Accomodate any URI parameters
      if (
        layer.source === "burwell" &&
        layer["source-layer"] === "units" &&
        mapLayers.has(MapLayer.BEDROCK)
      ) {
        this.map.setLayoutProperty(layer.id, "visibility", "none");
      }
      if (
        layer.source === "burwell" &&
        layer["source-layer"] === "lines" &&
        mapLayers.has(MapLayer.LINES)
      ) {
        this.map.setLayoutProperty(layer.id, "visibility", "none");
      }
      if (
        (layer.source === "pbdb" || layer.source === "pbdb-points") &&
        mapLayers.has(MapLayer.FOSSILS)
      ) {
        this.map.setLayoutProperty(layer.id, "visibility", "visible");
      }
      if (
        (layer.source === "mindat-points" || layer.source === "mindat-clusters") && 
        mapLayers.has(MapLayer.MINDAT)
      ) {
        this.map.setLayoutProperty(layer.id, "visibility", "visible")
      }
      if (layer.source === "columns" && mapLayers.has(MapLayer.COLUMNS)) {
        this.map.setLayoutProperty(layer.id, "visibility", "visible");
      }
      if (layer.source === "coasts" && mapLayers.has(MapLayer.PALEOCOAST)) {
        this.map.setLayoutProperty(layer.id, "visibility", "visible");
      }
    });

    if (mapLayers.has(MapLayer.FOSSILS)) {
      this.refreshPBDB();
    }

    if (mapLayers.has(MapLayer.MINDAT)) {
      this.refreshMindat();
    }

    if (mapLayers.has(MapLayer.PALEOCOAST) && shouldRetrieveCoasts == true) {
      this.refreshPaleoCoast();
    }

    // NO idea why timeout is needed
    setTimeout(() => {
      this.mapLoaded = true;
    }, 1);
  }

  setupMapHandlers() {
    if (this.map != null) {
      return;
    }

    this.map = this.props.mapRef.current;

    if (this.map == null) {
      return;
    }
    // disable map rotation using right click + drag
    //this.map.dragRotate.disable();

    // disable map rotation using touch rotation gesture
    //this.map.touchZoomRotate.disableRotation();
    const ignoredSources = ["elevationMarker", "elevationPoints"];

    this.map.on("sourcedataloading", (evt) => {
      if (ignoredSources.includes(evt.sourceId) || this.props.mapIsLoading) {
        return;
      }
      this.props.runAction({ type: "map-loading" });

      if (this.props.mapLayers.has(MapLayer.PALEOCOAST) && shouldRetrieveCoasts == true) {
        this.refreshPaleoCoast();
      }
    });

    this.map.on("moveend", () => {
      // Force a hit to the API to refresh
      if (this.props.mapLayers.has(MapLayer.FOSSILS)) {
        this.refreshPBDB();
      }
      if (this.props.mapLayers.has(MapLayer.MINDAT)) {
        this.refreshMindat();
      }
      if (this.props.mapLayers.has(MapLayer.PALEOCOAST) && shouldRetrieveCoasts == true) {
        this.refreshPaleoCoast();
      }
    });

    

    this.map.on("style.load", this.onStyleLoad.bind(this));
    this.onStyleLoad();

    highlightLayers.forEach((layer) => {
      this.map.on("mousemove", layer.layer, (evt) => {
        if (evt.features) {
          if (this.hoverStates[layer.layer]) {
            this.map.setFeatureState(
              { source: layer.source, id: this.hoverStates[layer.layer] },
              { hover: false }
            );
          }
          this.hoverStates[layer.layer] = evt.features[0].id;
          this.map.setFeatureState(
            { source: layer.source, id: evt.features[0].id },
            { hover: true }
          );
        }
      });

      this.map.on("mouseleave", layer.layer, (evt) => {
        if (this.hoverStates[layer.layer]) {
          this.map.setFeatureState(
            { source: layer.source, id: this.hoverStates[layer.layer] },
            { hover: false }
          );
        }
        this.hoverStates[layer.layer] = null;
      });
    });

    this.map.on("click", (event) => {
      // If the elevation drawer is open and we are awaiting to points, add them
      if (
        this.props.elevationChartOpen &&
        this.props.elevationData &&
        this.props.elevationData.length === 0
      ) {
        this.elevationPoints.push([event.lngLat.lng, event.lngLat.lat]);
        this.map.getSource("elevationPoints").setData({
          type: "FeatureCollection",
          features: this.elevationPoints.map((p) => {
            return {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: p,
              },
            };
          }),
        });
        if (this.elevationPoints.length === 2) {
          this.props.runAction({
            type: "get-elevation",
            line: this.elevationPoints,
          });
          this.map.getSource("elevationLine").setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: this.elevationPoints,
                },
              },
            ],
          });
        }
        return;
      }

      const mapZoom = this.map.getZoom();

      // If we are viewing fossils, prioritize clicks on those
      if (this.props.mapLayers.has(MapLayer.FOSSILS)) {
        let collections = this.map.queryRenderedFeatures(event.point, {
          layers: ["pbdb-points-clustered", "pbdb-points", "pbdb-clusters"],
        });
        // Clicked on a hex grid
        if (
          collections.length &&
          collections[0].properties.hasOwnProperty("hex_id")
        ) {
          this.map.zoomTo(mapZoom + 1, { center: event.lngLat });
          return;

          // Clicked on a summary cluster
        } else if (
          collections.length &&
          collections[0].properties.hasOwnProperty("oid") &&
          collections[0].properties.oid.split(":")[0] === "clu" &&
          mapZoom <= 12
        ) {
          this.map.zoomTo(mapZoom + 2, { center: event.lngLat });
          return;
          // Clicked on a real cluster of collections

          // ... the way we do clustering here is kind of strange.
        } else if (
          collections.length &&
          (collections[0].properties.hasOwnProperty("cluster") ||
            // Summary cluster when zoom is too high
            collections[0].properties.oid.split(":")[0] === "clu")
        ) {
          // via https://jsfiddle.net/aznkw784/
          let pointsInCluster = this.pbdbPoints.features
            .filter((f) => {
              let pointPixels = this.map.project(f.geometry.coordinates);
              let pixelDistance = Math.sqrt(
                Math.pow(event.point.x - pointPixels.x, 2) +
                  Math.pow(event.point.y - pointPixels.y, 2)
              );
              return Math.abs(pixelDistance) <= 50;
            })
            .map((f) => {
              return f.properties.oid.replace("col:", "");
            });
          this.props.runAction({
            type: "get-pbdb",
            collection_nos: pointsInCluster,
          });

          // Clicked on an unclustered point
        } else if (
          collections.length &&
          collections[0].properties.hasOwnProperty("oid")
        ) {
          let collection_nos = collections.map((col) => {
            return col.properties.oid.replace("col:", "");
          });
          this.props.runAction({ type: "get-pbdb", collection_nos });
          //    return
        } else {
          // Otherwise make sure that old fossil collections aren't visible
          this.props.runAction({ type: "reset-pbdb" });
        }
      }

      //Queries mindat data points for in depth retrieval
      if(this.props.mapLayers.has(MapLayer.MINDAT)) {
        let collections = this.map.queryRenderedFeatures(event.point, {
          layers: ["mindat-points", "mindat-clusters"],
        });

        if (
          collections.length &&
          collections[0].properties.cluster == true
        ) {
          this.map.zoomTo(mapZoom + 1, { center: event.lngLat });
          return;
        //checks that the data exists and that it has an id so it can search the JSON files
        //if the point clicked has no proper id, it will clear the data from the popout window
        } else if(collections.length && collections[0].properties.hasOwnProperty("id")){
          let id = collections[0].properties.id
          this.props.runAction({ type: "get-mindat", id });
        }else{
          this.props.runAction({ type: "reset-mindat"})
        }
      }
    

      // Otherwise try to query the geologic map
      let features = this.map.queryRenderedFeatures(event.point, {
        layers: ["burwell_fill", "column_fill", "filtered_column_fill"],
      });

      let burwellFeatures = features
        .filter((f) => {
          if (f.layer.id === "burwell_fill") return f;
        })
        .map((f) => {
          return f.properties;
        });

      const columns = features
        .filter((f) => {
          if (
            f.layer.id === "column_fill" ||
            f.layer.id === "filtered_column_fill"
          )
            return f;
        })
        .map((f) => {
          return f.properties;
        });

      this.props.onQueryMap(event, columns);
    });

    // Fired after 'swapBasemap'
    this.map.on("style.load", () => {
      if (!this.currentSources.length) {
        return;
      }

      this.currentSources.forEach((source) => {
        if (this.map.getSource(source.id) == null) {
          this.map.addSource(source.id, source.config);
        }
        if (source.data) {
          this.map.getSource(source.id).setData(source.data);
        }
      });

      // Readd all the previous layers to the map
      this.currentLayers.forEach((layer) => {
        if (layer.filters) {
          this.map.setFilter(layer.layer.id, layer.filters);
        }
      });
      setMapStyle(this, this.map, mapStyle, this.props);
    });
  }

  // Handle updates to the state of the map
  // Since react isn't in charge of updating the map state we use shouldComponentUpdate
  // and always return `false` to prevent DOM updates
  // We basically intercept the changes, handle them, and tell React to ignore them
  shouldComponentUpdate(nextProps) {
    this.setupMapHandlers();
    if (this.map == null) return false;

    setMapStyle(this, this.map, mapStyle, nextProps);

    if (nextProps.mapIsRotated !== this.props.mapIsRotated) {
      return true;
    }

    // Watch the state of the application and adjust the map accordingly
    if (
      !nextProps.elevationChartOpen &&
      this.props.elevationChartOpen &&
      this.map
    ) {
      this.elevationPoints = [];
      this.map.getSource("elevationPoints").setData({
        type: "FeatureCollection",
        features: [],
      });
      this.map.getSource("elevationLine").setData({
        type: "FeatureCollection",
        features: [],
      });
    }
    // Bedrock
    if (
      JSON.stringify(nextProps.mapCenter) !=
      JSON.stringify(this.props.mapCenter)
    ) {
      if (nextProps.mapCenter.type === "place") {
        const { bbox, center } = nextProps.mapCenter.place;
        if (bbox?.length == 4) {
          let bounds = [
            [
              nextProps.mapCenter.place.bbox[0],
              nextProps.mapCenter.place.bbox[1],
            ],
            [
              nextProps.mapCenter.place.bbox[2],
              nextProps.mapCenter.place.bbox[3],
            ],
          ];
          this.map.fitBounds(bounds, {
            duration: 0,
            maxZoom: 16,
          });
        } else {
          this.map.flyTo({
            center,
            duration: 0,
            zoom: Math.max(
              nextProps.mapPosition?.camera?.target?.zoom ?? 10,
              14
            ),
          });
        }
      } else {
        // zoom to user location
      }
    }

    // Handle changes to map filters
    if (nextProps.filters != this.props.filters) {
      // If all filters have been removed simply reset the filter states
      if (nextProps.filters.length === 0) {
        // Remove filtered columns and add unfiltered columns
        if (this.props.mapLayers.has(MapLayer.COLUMNS)) {
          mapStyle.layers.forEach((layer) => {
            if (layer.source === "columns") {
              this.map.setLayoutProperty(layer.id, "visibility", "visible");
            }
          });
          mapStyle.layers.forEach((layer) => {
            if (layer.source === "filteredColumns") {
              this.map.setLayoutProperty(layer.id, "visibility", "none");
            }
          });
        }

        if (this.props.mapLayers.has(MapLayer.PALEOCOAST)) {
          mapStyle.layers.forEach((layer) => {
            if (layer.source === "coasts") {
              this.map.setLayoutProperty(layer.id, "visibility", "visible");
            }
          });
        }


        if (nextProps.mapLayers.has(MapLayer.FOSSILS)) {
          this.refreshPBDB();
        }
        if (nextProps.mapLayers.has(MapLayer.MINDAT)) {
          this.refreshMindat();
        }
        if (nextProps.mapLayers.has(MapLayer.PALEOCOAST) && shouldRetrieveCoasts == true) {
          this.refreshPaleoCoast();
        }

        return false;
      }

      if (nextProps.mapLayers.has(MapLayer.FOSSILS)) {
        this.refreshPBDB();
      }
      if (nextProps.mapLayers.has(MapLayer.MINDAT)) {
        this.refreshMindat();
      }
      if (nextProps.mapLayers.has(MapLayer.PALEOCOAST) && shouldRetrieveCoasts == true) {
        this.refreshPaleoCoast();
      }

      // Update the map styles
      return false;
    }
    return false;
  }

  // PBDB hexgrids and points are refreshed on every map move
  async refreshPBDB() {
    //these are needed if we are trying to set bounds based on paleo age.
    // const { mapLayers } = this.props; 
    // let paleoAge = mapLayers.has(MapLayer.PALEOCOAST) ? getAge() : null;
    // let customBounds = paleoAge ? await getPaleoBounds(paleoAge, zoom, bounds) : bounds;
    let bounds = this.map.getBounds();
    let zoom = this.map.getZoom();
    const maxClusterZoom = 7;
    this.pbdbPoints = await getPBDBData(
      this.props.filters,
      bounds,
      zoom,
      maxClusterZoom
    );
    
    
    // Show or hide the proper PBDB layers
    if (zoom < maxClusterZoom) {
      //paleo bounds doesn't work well with this since there are too many points to put to the url in most cases.
      // if(paleoAge && this.pbdbPoints.features.length > 0){
      //   this.pbdbPoints.features = await getPaleoPoints(paleoAge, this.pbdbPoints.features);
      // }
      this.map.getSource("pbdb-clusters").setData(this.pbdbPoints);
      this.map.setLayoutProperty("pbdb-clusters", "visibility", "visible");
      this.map.setLayoutProperty("pbdb-points-clustered", "visibility", "none");
      //  map.map.setLayoutProperty('pbdb-point-cluster-count', 'visibility', 'none')
      this.map.setLayoutProperty("pbdb-points", "visibility", "none");
    } else {
      // if(paleoAge && this.pbdbPoints.features.length > 0){
      //   this.pbdbPoints.features = await getPaleoPoints(paleoAge, this.pbdbPoints.features);
      // }
      this.map.getSource("pbdb-points").setData(this.pbdbPoints);

      //map.map.getSource("pbdb-clusters").setData(map.pbdbPoints);
      this.map.setLayoutProperty("pbdb-clusters", "visibility", "none");
      this.map.setLayoutProperty(
        "pbdb-points-clustered",
        "visibility",
        "visible"
      );
      //    map.map.setLayoutProperty('pbdb-point-cluster-count', 'visibility', 'visible')
      // map.map.setLayoutProperty("pbdb-points", "visibility", "visible");
    }
  }



  async refreshMindat() {
    let bounds = this.map.getBounds();
    let zoom = this.map.getZoom();
    let maxClusterZoom = 10;

    //necessary for using paleo points
    const { mapLayers } = this.props;
    let paleoAge = mapLayers.has(MapLayer.PALEOCOAST) ? getAge() : null;
    let customBounds = paleoAge ? await getPaleoBounds(paleoAge, bounds) : bounds;

    this.mindatPoints = await getMindatData(
      customBounds,
      zoom,
    );

    if(zoom < maxClusterZoom) {
      const points = this.mindatPoints.features;

      //sets clusters
      let index = new Supercluster({
        log: false,
        radius: 45,
        maxZoom: maxClusterZoom
      }).load(points);
      
      //sets a custom bound for clustering
      let clusters = index.getClusters([customBounds._sw.lng, customBounds._sw.lat, 
                                        customBounds._ne.lng, customBounds._ne.lat], zoom);

      //transforms the points if there is age variable.
      if(paleoAge && clusters.length > 0){
        clusters = await getPaleoPoints(paleoAge, clusters);
      }

      const clusteredPoints = {
        type: "FeatureCollection",
        features: clusters.map((f) => {
          return {
            type: "Feature",
            id: f.id,
            properties: {
              ...f.properties,
              cluster: true,
            },
            geometry: f.geometry,
          };
        }),
      };
      
      this.map.getSource("mindat-clusters").setData(clusteredPoints);
      this.map.setLayoutProperty("mindat-clusters", "visibility", "visible");
      this.map.setLayoutProperty("mindat-points", "visibility", "none");
    } else {
      
            //transforms the points if there is age variable.
      if(paleoAge && this.mindatPoints.features.length > 0){
        this.mindatPoints.features = await getPaleoPoints(paleoAge, this.mindatPoints.features);
      }


      this.map.getSource("mindat-points").setData(this.mindatPoints);
      this.map.setLayoutProperty("mindat-points", "visibility", "visible");
      this.map.setLayoutProperty("mindat-clusters", "visibility", "none");
    }
  }

  //function to return and set paleoCoast data during runtime.
  async refreshPaleoCoast() {
    //setRetrieve makes sure we don't spam requests
    setRetrieveCoasts(false);
    let coasts = await getCoasts();

    const src = this.map.getSource("coasts");
    if (src == null) return;
    src.setData(coasts);
  }

  // Update the colors of the hexgrids
  updateColors(data) {
    for (let i = 0; i < data.length; i++) {
      this.map.setFeatureState(
        {
          source: "pbdb",
          sourceLayer: "hexgrid",
          id: data[i].hex_id,
        },
        {
          color: this.colorScale(parseInt(data[i].count)),
        }
      );
    }
  }

  colorScale(val) {
    let mid = this.maxValue / 2;

    // Max
    if (Math.abs(val - this.maxValue) <= Math.abs(val - mid)) {
      return "#2171b5";
      // Mid
    } else if (Math.abs(val - mid) <= Math.abs(val - 1)) {
      return "#6baed6";
      // Min
    } else {
      return "#bdd7e7";
    }
  }

  render() {
    return null;
  }
}

export default forwardRef((props, ref) =>
  h(VestigialMap, { ...props, elementRef: ref })
);