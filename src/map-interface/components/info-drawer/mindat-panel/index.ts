import h from "@macrostrat/hyper";
import { ExpansionPanel } from "../../expansion-panel";
import mindatDisplay from "./collections";

export function MindatCollections(props) {
  const { data, expanded } = props;

  if (!data || data.length <= 0) {
    return null;
  }
  return h(
    ExpansionPanel,
    {
      className: "regional-panel",
      title: "Mindat Locality",
      helpText: "via openmindat",
      expanded,
    },
    [h(mindatDisplay, { data })]
  );
}