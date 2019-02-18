// maybe: https://beta.observablehq.com/@mbostock/d3-multi-line-chart

// var dataSet = [80, 100, 56, 120, 180, 30, 40, 120, 160];

let makeGraph = (dataSet) => {
  console.log(dataSet)
  d3.select(".chart")
    .selectAll("div")
    .data(dataSet)
      .enter()
      .append("div")
      .style("width", function(d) { return d.data["Community Publishers"]**3 + "px"; })
      .text(function(d) { return d.data["Community Publishers"]; });
}

/*

  var svgWidth = 500, svgHeight = 300, barPadding = 1;
  var barWidth = (svgWidth / dataSet.length);

  var svg = d3.select('svg')
      .attr("width", svgWidth)
      .attr("height", svgHeight);

  var barChart = svg.selectAll("rect")
      .data(dataSet)
      .enter()
      .append("rect")
      .attr("y", function(d) {
          return svgHeight - d.data["Community Publishers"]
        
      })
      .attr("height", function(d) {
          return d.data["Community Publishers"]
      })
      .attr("width", barWidth - barPadding)
      .attr("transform", function (d, i) {
          var translate = [barWidth * i, 0]; 
          return "translate("+ translate +")";
      });

*/