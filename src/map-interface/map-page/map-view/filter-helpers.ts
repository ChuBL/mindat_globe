import { Feature, FeatureCollection, Geometry, Point } from "geojson";
import {
  FilterData,
  IntervalFilterData,
} from "~/map-interface/app-state/handlers/filters";
import { SETTINGS } from "../../settings";
import axios from "axios";
import mapboxgl from 'mapbox-gl';

const paleoCoastUrl = `${SETTINGS.coastlinePointDomain}?&model=SETON2012`;

export function getExpressionForFilters(
  filters: FilterData[]
): mapboxgl.Expression {
  // Separate time filters and other filters for different rules
  // i.e. time filters are <interval> OR <interval> and all others are AND
  // Keep track of name: index values of time filters for easier removing
  let expr: mapboxgl.Expression = ["all", ["!=", "color", ""]];

  const timeFilters = filters
    .filter((f) => f.type === "intervals")
    .map(buildFilterExpression);
  if (timeFilters.length > 0) {
    expr.push(["any", ...timeFilters]);
  }

  const otherFilters = filters
    .filter((f) => f.type !== "intervals")
    .map(buildFilterExpression);
  if (otherFilters.length > 0) {
    expr.push(["any", ...otherFilters]);
  }
  return expr;
}

function buildFilterClasses(
  type: string,
  name: string | number
): mapboxgl.Expression {
  /* This function implements filtering over numbered classes.
   It is used to provide filtering over the complex structure created for
   MVT tiles of the 'carto' style. */
  let filter: mapboxgl.Expression = ["any"];
  for (let i = 1; i < 14; i++) {
    filter.push(["==", `${type}${i}`, name]);
  }
  return filter;
}

function buildFilterExpression(filter: FilterData): mapboxgl.Expression {
  // Check which kind of filter it is
  switch (filter.type) {
    case "intervals":
      // These should be added to the timeFilters array
      // Everything else goes in normal filters
      return [
        "all",
        [">", "best_age_bottom", filter.t_age],
        ["<", "best_age_top", filter.b_age],
      ];
    case "lithology_classes":
      return buildFilterClasses("lith_class", filter.name ?? filter.id);
    case "lithology_types":
      return buildFilterClasses("lith_type", filter.name ?? filter.id);
    case "lithologies":
    case "all_lithologies":
    case "all_lithology_types":
    case "all_lithology_classes":
      return ["in", "legend_id", ...filter.legend_ids];
    case "strat_name_orphans":
    case "strat_name_concepts":
      return ["in", "legend_id", ...filter.legend_ids];
  }
}

export async function getPBDBData(
  filters: FilterData[],
  bounds: mapboxgl.LngLatBounds,
  zoom: number,
  maxClusterZoom: number = 7
): Promise<FeatureCollection<Point, any>> {
  // One for time, one for everything else because
  // time filters require a separate request for each filter
  let timeQuery = [];
  let queryString = [];

  const timeFilters = filters.filter(
    (f) => f.type === "intervals"
  ) as IntervalFilterData[];
  const stratNameFilters = filters.filter(
    (f) => f.type === "strat_name_concepts" || f.type === "strat_name_orphans"
  );

  if (timeFilters.length > 0) {
    for (const f of timeFilters) {
      timeQuery.push(`max_ma=${f.b_age}`, `min_ma=${f.t_age}`);
    }
  }
  // lith filters broken on pbdb (500 error returned)
  // if (map.lithFilters.length) {
  //   let filters = map.lithFilters.filter((f) => f != "sedimentary");
  //   if (filters.length) {
  //     queryString.push(`lithology=${filters.join(",")}`);
  //   }
  // }
  if (stratNameFilters.length > 0) {
    const names = stratNameFilters.map((f) => f.name);
    queryString.push(`strat=${names.join(",")}`);
  }

  // Define the pbdb cluster level
  let level = zoom < 3 ? "&level=2" : "&level=3";

  let urls = [];
  // Make sure lngs are between -180 and 180
  const lngMin = bounds._sw.lng < -180 ? -180 : bounds._sw.lng;
  const lngMax = bounds._ne.lng > 180 ? 180 : bounds._ne.lng;
  // If more than one time filter is present, multiple requests are needed

  /* Currently there is a limitation in the globe for the getBounds function that
  resolves incorrect latitude ranges for low zoom levels.
  - https://docs.mapbox.com/mapbox-gl-js/guides/globe/#limitations-of-globe
  - https://github.com/mapbox/mapbox-gl-js/issues/11795
  -   https://github.com/UW-Macrostrat/web/issues/68

  This is a workaround for that issue.
  */
  let latMin = bounds._sw.lat;
  let latMax = bounds._ne.lat;

  if (zoom < 5) {
    latMin = Math.max(Math.min(latMin, latMin * 5), -85);
    latMax = Math.min(Math.max(latMax, latMax * 5), 85);
  }

  if (timeFilters.length && timeFilters.length > 1) {
    urls = timeFilters.map((f) => {
      let url = `${SETTINGS.pbdbDomain}/data1.2/colls/${
        zoom < maxClusterZoom ? "summary" : "list"
      }.json?lngmin=${lngMin}&lngmax=${lngMax}&latmin=${latMin}&latmax=${latMax}&max_ma=${
        f.b_age
      }&min_ma=${f.t_age}${zoom < maxClusterZoom ? level : ""}`;
      if (queryString.length) {
        url += `&${queryString.join("&")}`;
      }
      return url;
    });
  } else {
    let url = `${SETTINGS.pbdbDomain}/data1.2/colls/${
      zoom < maxClusterZoom ? "summary" : "list"
    }.json?lngmin=${lngMin}&lngmax=${lngMax}&latmin=${latMin}&latmax=${latMax}${
      zoom < maxClusterZoom ? level : ""
    }`;
    if (timeQuery.length) {
      url += `&${timeQuery.join("&")}`;
    }
    if (queryString.length) {
      url += `&${queryString.join("&")}`;
    }
    urls = [url];
  }

  // Fetch the data
  return await Promise.all(
    urls.map((url) => fetch(url).then((response) => response.json()))
  ).then((responses) => {
    // Ignore data that comes with warnings, as it means nothing was
    // found under most conditions
    let data = responses
      .filter((res) => {
        if (!res.warnings) return res;
      })
      .map((res) => res.records)
      .reduce((a, b) => {
        return [...a, ...b];
      }, []);

    return {
      type: "FeatureCollection",
      features: data.map((f, i) => {
        return {
          type: "Feature",
          properties: f,
          id: i,
          geometry: {
            type: "Point",
            coordinates: [f.lng, f.lat],
          },
        };
      }),
    };
  });
}

export async function getMindatData(
  bounds: mapboxgl.LngLatBounds,
  zoom: number,
): Promise<FeatureCollection<Point, any>> {

  // Make sure lngs are between -180 and 180
  let lngMin = bounds._sw.lng < -180 ? -180 : bounds._sw.lng;
  let lngMax = bounds._ne.lng > 180 ? 180 : bounds._ne.lng;
  // If more than one time filter is present, multiple requests are needed

  /* Currently there is a limitation in the globe for the getBounds function that
  resolves incorrect latitude ranges for low zoom levels.
  - https://docs.mapbox.com/mapbox-gl-js/guides/globe/#limitations-of-globe
  - https://github.com/mapbox/mapbox-gl-js/issues/11795
  -   https://github.com/UW-Macrostrat/web/issues/68

  This is a workaround for that issue.
  */
  let latMin = bounds._sw.lat;
  let latMax = bounds._ne.lat;

  if (zoom < 5) {
    latMin = Math.max(Math.min(latMin, latMin * 5), -85);
    latMax = Math.min(Math.max(latMax, latMax * 5), 85);
  }
  
  // if(age){
  //   const url = `${paleoCoastUrl}&points=${lngMin},${latMin},${lngMin},${latMax},${lngMax},${latMin},${lngMax},${latMax}&time=${age}&reverse`;
  //   let res = await axios.get(url, { responseType: "json" });

  //   lngMin = (res.data.coordinates[0][0]+res.data.coordinates[1][0])/2;
  //   lngMax = (res.data.coordinates[2][0]+res.data.coordinates[3][0])/2;
  //   latMin = (res.data.coordinates[0][1]+res.data.coordinates[2][1])/2;
  //   latMax = (res.data.coordinates[1][1]+res.data.coordinates[3][1])/2;
  // }
  
  let parsedData = []

  //grabs the data from the public directory.
  //if the data is not there, run "jsonDownload.py" to install the necessary files
  try {
    const jsonData = await fetch('/Mindat_data_partial.json');
    parsedData = await jsonData.json();
  } catch (error) {
    console.error('Error fetching Mindat data:', error);
  }

  //filters out all of the data that is not within the correct range.
  //I am sure there is some time optimization that can happen here.
  let coordinates = [];
  let filteredData = [];
  try {
    parsedData.results.forEach((dict) => {
      if(dict.longitude > lngMin && dict.longitude < lngMax && dict.latitude > latMin && dict.latitude < latMax){
        filteredData.push(dict);
      }
    });
  } catch(error) {
    console.error("The type of jsonData is", typeof(parsedData), "The error is this", error);
  }

  //returns the datapoints in a featureCollection geoJSON, this allows it to be plotted by other functions
  return {
    type: "FeatureCollection",
    features: filteredData.map((f, i) => {
      return {
        type: "Feature",
        id: i,
        properties: {
          ...f,
          cluster: false,
        },
        geometry: {
          type: "Point",
          coordinates: [f.longitude, f.latitude],
        },
      };
    }),
  };
}

export async function getPaleoPoints(age, POINTS)
{
  let points = POINTS;
  if(age <= 200 && age > 0){
    let coordinates = [];
    points.forEach((dict) => {
      coordinates.push(dict.geometry.coordinates[0]);
      coordinates.push(dict.geometry.coordinates[1]);
    });

    console.log(coordinates);

    if(coordinates.length > 0){
      const coordStr = coordinates.join(',');
      const url = `${paleoCoastUrl}&points=${coordStr}&time=${age}`;
      try{
        let response = await axios.get(url, { responseType: "json" })
  
        for(let i = 0; i < points.length; i++){
          points[i].geometry.coordinates[0] = response.data.coordinates[i][0];
          points[i].geometry.coordinates[1] = response.data.coordinates[i][1];
          // points[i].longitude = response.data.coordinates[i][0];
          // points[i].latitude = response.data.coordinates[i][1];
        }
      } catch (error) {
        console.error("Issue gathering new point data, this can occur because the url is too long: ", error);
      }
    }
    return points;
  }else{
    console.log("Invalid age range for paleoCoast.");
    return null;
  }
}

export async function getPaleoBounds(age, zoom, BOUNDS){
  let bounds = BOUNDS;

  let lngMin = bounds._sw.lng < -180 ? -180 : bounds._sw.lng;
  let lngMax = bounds._ne.lng > 180 ? 180 : bounds._ne.lng;
  let latMin = bounds._sw.lat;
  let latMax = bounds._ne.lat;


  if(age){
    const url = `${paleoCoastUrl}&points=${lngMin},${latMin},${lngMax},${latMax}&time=${age}&reverse`;
    let res = await axios.get(url, { responseType: "json" });

    lngMin = res.data.coordinates[0][0];
    lngMax = res.data.coordinates[1][0];
    latMin = res.data.coordinates[0][1];
    latMax = res.data.coordinates[1][1];
  }

  const changedBounds = new mapboxgl.LngLatBounds([lngMin, latMin], [lngMax, latMax]);
  return changedBounds;
}

let age: number | null = null;
age = 20;

export function getAge(): number | null {
  return age;
}

export function setAge(newAge: number): void {
  if (newAge <= 200 && newAge > 0) {
    age = newAge;
  } else {
    console.error("Invalid age range. Age must be between 1 and 200.");
  }
}