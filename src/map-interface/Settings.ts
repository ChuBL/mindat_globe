export const SETTINGS = {
  emptyMapStyle:
    "style: {version: 8,sources: {},layers: []",
  darkMapURL:
    //"mapbox://styles/jczaplewski/cl5uoqzzq003614o6url9ou9z?optimize=true",
    "mapbox://styles/mapbox/dark-v11",
  baseMapURL:
   //"mapbox://styles/jczaplewski/clatdbkw4002q14lov8zx0bm0?optimize=true",
   "mapbox://styles/mapbox/light-v11",
  satelliteMapURL:
    //"mapbox://styles/jczaplewski/cl51esfdm000e14mq51erype3?optimize=true",
    "mapbox://styles/mapbox/satellite-v9",
  // TODO: make these configurable with environment variables
  // burwellTileDomain:
  //   window.location.hostname === "localhost"
  //     ? "https://tiles.macrostrat.org"
  //     : window.location.hostname === "dev.macrostrat.org"
  //     ? "https://devtiles.macrostrat.org"
  //     : "https://tiles.macrostrat.org",
  // apiDomain:
  //   window.location.hostname === "localhost"
  //     ? "https://dev.macrostrat.org"
  //     : `https://${window.location.hostname}`,
  // burwellTileDomain: "https://devtiles.macrostrat.org",
  // apiDomain: "https://dev.macrostrat.org",
  burwellTileDomain: process.env.MACROSTRAT_TILESERVER_DOMAIN,
  apiDomain: process.env.MACROSTRAT_API_DOMAIN,
  gddDomain: "https://xdd.wisc.edu",
  pbdbDomain: "https://paleobiodb.org",
  mapboxAccessToken: process.env.MAPBOX_API_TOKEN,
  coastlineDomain: "https://gws.gplates.org/reconstruct/coastlines/",
  coastlinePointDomain: "https://gws.gplates.org/reconstruct/reconstruct_points/",
};

export const routerBasename = process.env.PUBLIC_URL;
