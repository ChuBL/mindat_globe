import axios from "axios";
import { joinURL } from "~/map-interface/utils";
import { SETTINGS } from "../../settings";
import { ColumnGeoJSONRecord } from "../reducers";

export const base = `${SETTINGS.apiDomain}/api/v2`;
const basev1 = `${SETTINGS.gddDomain}/api/v1`;
const pbdbURL = `${SETTINGS.pbdbDomain}/data1.2/colls/list.json`;
const pbdbURLOccs = `${SETTINGS.pbdbDomain}/data1.2/occs/list.json`;
const paleoCoastUrl = `${SETTINGS.coastlineDomain}?&model=SETON2012`;

import { FilterType } from "./filters";

type PossibleFields = {
  [Property in FilterType]: string[];
};

function formColumnQueryString(filters) {
  let possibleFields: PossibleFields = {
    intervals: ["int_id", "id"], // [value, attr]
    strat_name_concepts: ["strat_name_concept_id", "id"],
    strat_name_orphans: ["strat_name_id", "id"],
    lithology_classes: ["lith_class", "name"],
    lithology_types: ["lith_type", "name"],
    lithologies: ["lith_id", "id"],
    // These cases weren't handled in v3, hopefully adding
    // them here does not cause new problems...
    all_lithology_classes: ["lith_class", "name"],
    all_lithology_types: ["lith_type", "name"],
    all_lithologies: ["lith_id", "id"],
    // Environments are unused for now in map filtering, but used in
    // column filtering (I think)
    environments: ["environ_id", "id"],
    environment_types: ["environ_type", "name"],
    environment_classes: ["environ_class", "name"],
  };

  let query = {};
  filters.forEach((f) => {
    let [value, attr] = possibleFields[f.type];
    if (query[value]) {
      query[value].push(f[attr]);
    } else {
      query[value] = [f[attr]];
    }
  });
  let queryString = Object.keys(query)
    .map((k) => {
      return `${k}=${query[k].join(",")}`;
    })
    .join("&");

  return queryString;
}

export async function fetchFilteredColumns(providedFilters) {
  let queryString = formColumnQueryString(providedFilters);
  let url = `${base}/columns?format=geojson_bare&${queryString}`;
  let res = await axios.get(url, { responseType: "json" });
  return res.data;
}


export async function fetchPaleoCoast(age) {
  let url = `${paleoCoastUrl}&&time=${age}`;
  let res = await axios.get(url, {responseType: "json"});
  return res.data;
}

export interface XDDSnippet {
  pubname: string;
  publisher: string;
  _gddid: string;
  title: string;
  doi: string;
  coverDate: string;
  URL: string;
  authors: string;
  hits: number;
  highlight: string[];
}

export async function handleXDDQuery(
  mapInfo,
  cancelToken
): Promise<XDDSnippet[]> {
  if (
    !mapInfo ||
    !mapInfo.mapData.length ||
    Object.keys(mapInfo.mapData[0].macrostrat).length === 0
  ) {
    return [];
  }
  let stratNames = mapInfo.mapData[0].macrostrat.strat_names
    .map((d) => {
      return d.rank_name;
    })
    .join(",");

  let url = `${basev1}/snippets`;

  const res = await axios.get(url, {
    params: {
      article_limit: 20,
      term: stratNames,
    },
    cancelToken: cancelToken,
    responseType: "json",
  });
  try {
    return res.data.success.data;
  } catch (error) {
    return [];
  }
}

function addMapIdToRef(data) {
  data.success.data.mapData = data.success.data.mapData.map((source) => {
    source.ref.map_id = source.map_id;
    return source;
  });
  return data;
}

export async function fetchAllColumns(): Promise<ColumnGeoJSONRecord[]> {
  let res = await axios.get(joinURL(base, "columns"), {
    responseType: "json",
    params: { format: "geojson_bare", all: true },
  });

  return res.data.features;
}

export async function fetchAllCoasts(age): Promise<ColumnGeoJSONRecord[]> {
  let url = `${paleoCoastUrl}&time=${age}`;
  let res = await axios.get(url, {responseType: "json"});

  return res.data.features;
}

export async function runMapQuery(lng, lat, z, map_id, cancelToken) {
  const params = { lng, lat, z, map_id };
  let url = base + "/mobile/map_query_v2";
  let res = await axios.get(url, { cancelToken, responseType: "json", params });
  let data = addMapIdToRef(res.data).success.data;

  // if (data.hasColumns) {
  //   // TODO: fix this...
  //   // Somewhat ridiculously, we need to run a separate query to get the
  //   // column ID, because the map query doesn't return it.
  //   // This needs to get a lot better.
  //   const pointData = await axios.get(base + "/mobile/point", {
  //     params: {
  //       lng,
  //       lat,
  //       z,
  //     },
  //   });
  //   const col_id = pointData.data.success.data.col_id;
  //   data.col_id = col_id;
  // }

  return data;
}

export async function runColumnQuery(column, cancelToken) {
  const res = await axios.get(base + "/units", {
    cancelToken,
    responseType: "json",
    params: { response: "long", col_id: column.col_id },
  });
  try {
    return res.data.success.data;
  } catch (error) {
    return [];
  }
}

export const asyncGetElevation = async (line, cancelToken) => {
  const [start_lng, start_lat] = line[0];
  const [end_lng, end_lat] = line[1];

  let params = { start_lng, start_lat, end_lng, end_lat };

  let url = `${base}/elevation`;

  const res = await axios.get(url, {
    //cancelToken,
    responseType: "json",
    params: params,
  });
  const data = res.data;
  try {
    return data.success.data;
  } catch (error) {
    return [];
  }
};

/* PBDB data */
// use new cancellation API

let abortController = null;

export async function getPBDBData(collections: number[]) {
  abortController?.abort();
  abortController = new AbortController();
  const coll_id = collections.join(",");
  const opts: any = {
    responseType: "json",
    signal: abortController.signal,
  };

  return Promise.all([
    axios.get(pbdbURL, {
      ...opts,
      params: {
        id: coll_id,
        show: "ref,time,strat,geo,lith,entname,prot",
        markrefs: true,
      },
    }),
    axios.get(pbdbURLOccs, {
      ...opts,
      params: { coll_id, show: "phylo,ident" },
    }),
  ])
    .then(([collections, occurences]) => {
      return mergePBDBResponses(collections, occurences);
    })
    .finally(() => {
      abortController = null;
    });
}

function mergePBDBResponses(collectionResponse, occurrenceResponse) {
  try {
    const occurrences = occurrenceResponse.data.records;
    return collectionResponse.data.records.map((col) => {
      col.occurrences = [];
      occurrences.forEach((occ) => {
        if (occ.cid === col.oid) {
          col.occurrences.push(occ);
        }
      });
      return col;
    });
  } catch (error) {
    console.log(error);
    return [];
  }
}

//retrieves a mindat entry based on id
export async function getMindatPoint(id) {
  let dataset = [];
  let datapoint = {};
  //path is where you store your data, by default it is stored in public or '/'
  let path = '/';

  //fetch initial mindat_locality file, works best with format found in public/jsondownload.py
  try {
    const jsonData = await fetch(path + 'Mindat_Localities_0.json');
    dataset = await jsonData.json();
  } catch (error) {
    console.error('Cannot find mindal Locality data:', error);
  }

  //If the data is split into seperate files, checks if the id is within the range so it doesn't need to iterate entire file
  //If id is not present, traverses to the next file since they are formated like a linked list.
  while(id < dataset['range']['min'] || id > dataset['range']['max']) {
    if('next' in dataset){
      try {
        const jsonData = await fetch(path + dataset['next']); // Assuming readJsonFile returns jsonData
        dataset = await jsonData.json();
      } catch (error) {
        console.error('Error fetching Mindat data:', error);
      }    
    } else {
      console.error('Missing object in DataSet');
    }
  }

  //checks which half of the dataset the id would be on, arguably neccessary, but cuts average response time by ~half
  if(id < (dataset['range']['max']/2)){
    for (let i = 0; i < dataset['results'].length; i++) {
      if (dataset['results'][i]['id'] == id) {
        datapoint = dataset['results'][i];
      }
    }
  } else {
    for (let i = dataset['results'].length-1; i > 0; i--) {
      if (dataset['results'][i]['id'] == id) {
        datapoint = dataset['results'][i];
      }
    }
  }

  //return in type of geojson, might have to change this if we find out clustering
  return {
    type: "Feature",
    properties: datapoint,
    id: id,
    geometry: {
      type: "Point",
      coordinates: [null, null],
    },
  };
}