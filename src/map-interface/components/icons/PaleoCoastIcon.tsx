import React, { Component } from "react";
import { useDarkMode } from "@macrostrat/ui-components";

class PaleoCoastIcon extends Component {
  constructor(props) {
    super(props);
  }


  render() {
    let style = {
      fill: "#cccccc",
      stroke: "#cccccc",
      strokeWidth: "4px",
    };
    // let scale = `scale(${this.props.size / 500})`
    let scale = "scale(1)";
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 129 107"
        height={this.props.size || 50}
        width={this.props.size || 50}
        className="custom-svg-icon"
      >
       <g transform={scale}>
          <polyline points="35,10 50,20 40,35 55,40 50,50 70,50 80,60 75,80 60,70 50,90 30,80 25,60 35,50 20,40 35,30 25,20 35,10"
            style={style} />
          <polyline points="60,20 70,30 75,25 85,35 75,40 70,30 60,20"
            style={style} />
          <polyline points="80,50 90,60 85,70 75,60 80,50"
            style={style} />
      </g>
     </svg>
    );
  }
}

export default PaleoCoastIcon;
