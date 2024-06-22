import React from "react";
import { useDarkMode } from "@macrostrat/ui-components";

function MindatIcon(props) {
  const darkMode = useDarkMode();
  const color = darkMode.isEnabled ? "#cccccc" : "#666666";
  const { size = 50, ...rest } = props;
  let style = {
    fill: color,
    stroke: color,
    strokeWidth: "4px",
    ...props,
  };
  // let scale = `scale(${this.props.size / 500})`
  let scale = "scale(1)";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 129 107"
      height={size}
      width={size}
      className="custom-svg-icon"
    >
      <g transform={scale}>
        <polyline points="80 10 100 30 45 30 60 10" style={style} />
        
        <polyline points="45 30 100 30 100 120 45 120 45 30" style={style} />
        
        <polyline points="35 40 100 40 100 120 35 120 35 40" style={style} />
    </g>
    </svg>
  );
}

export default MindatIcon;
