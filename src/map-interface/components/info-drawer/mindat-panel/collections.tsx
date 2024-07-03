import React from "react";
import { Tabs, Tab } from "@blueprintjs/core";
import hyper from "@macrostrat/hyper";
import styles from "./main.module.sass";
const h = hyper.styled(styles);

export default function mindatDisplay( data ) {
  if (data['data']['properties'] == null) return null;
  return h(
    "div.collections",
    h(MindatCollection, { key: 0, locality: data['data']['properties'] })
  );
}

function MindatCollection({ locality }) {
  return h(
    "div.fossil-collection",
    <>
      <Header locality={locality} />
      <Tabs>
        <Tab 
          title="Info"
          panel={<InfoPanel locality={locality}/>} 
          id="info" />
      </Tabs>
    </>
  );
}

function LocalityId({ locality }) {
  const num = locality.id;
  return h("div.collection-number", [
    h("span.collection-number-prefix", "#"),
    h(
      "a",
      {
        href: `https://www.mindat.org/loc-${num}.html`,
        target: "_blank",
      },
      num
    ),
  ]);
}

function Header({ locality }) {
  return h("div.mindat-panel-header", [
    h.if(locality.txt)("h4", {}, locality.txt),
    h.if(locality.id)(LocalityId, { locality }),
  ]);
}

function InfoPanel(props) {
  const { locality } = props;

  return (
    <div>
      {locality.txt && (
        <div className="map-source-attr">
          <span className="attr">Title: </span> {locality.txt}
        </div>
      )}
      {locality.description_short && (
        <div className="map-source-attr">
          <span className="attr">Description: </span> {locality.description_short}
        </div>
      )}
      {locality.elements && (
        <div className="map-source-attr">
          <span className="attr">Elements: </span> {locality.elements}
        </div>
      )}
      {locality.links && (
        <div className="map-source-attr">
          <span className="attr">Links: </span> {locality.links}
        </div>
      )}
    </div>
  );
}
