/* global d3 */
/* eslint-env browser */
// maybe: https://beta.observablehq.com/@mbostock/d3-multi-line-chart

// var dataSet = [80, 100, 56, 120, 180, 30, 40, 120, 160];

// Callback from client.js
// eslint-disable-next-line no-unused-vars
const makeGraph = (dataSet) => {
        const colorLegend = (selection, props) => {
            const {
                colorScale,
                circleRadius,
                spacing,
                textOffset,
            } = props;

            const groups = selection.selectAll('g')
            .data(colorScale.domain());
            const groupsEnter = groups
            .enter().append('g')
                .attr('class', 'tick');
            groupsEnter
            .merge(groups)
                .attr('transform', (d, i) => `translate(0, ${i * spacing})`);
            groups.exit().remove();

            groupsEnter.append('circle')
            .merge(groups.select('circle'))
                .attr('r', circleRadius)
                .attr('fill', colorScale);

            groupsEnter.append('text')
            .merge(groups.select('text'))
                .text(d => d)
                .attr('dy', '0.32em')
                .attr('x', textOffset);
        };
            const svg = d3.select('svg');

            const width = +svg.attr('width');
            const height = +svg.attr('height');

            const render = (data) => {
                // data.columns = ["count", "team", "timestamp", "type"]
                const title = 'Open Convos';

                const xValue = d => d.timestamp;
                const xAxisLabel = 'Time';

                const yValue = d => d.count;
                const yAxisLabel = 'Count';

                const colorValue = d => d.team;

                const margin = {
                    top: 60, right: 160, bottom: 88, left: 105,
                };
                const innerWidth = width - margin.left - margin.right;
                const innerHeight = height - margin.top - margin.bottom;

                const xScale = d3.scaleTime()
                    .domain(d3.extent(data, xValue))
                    .range([0, innerWidth])
                    .nice();

                const yScale = d3.scaleLinear()
                    .domain(d3.extent(data, yValue))
                    .range([innerHeight, 0])
                    .nice();

                const colorScale = d3.scaleOrdinal(d3.schemePastel1);

                const g = svg.append('g')
                    .attr('transform', `translate(${margin.left}, ${margin.top})`);

                const xAxis = d3.axisBottom(xScale)
                    .tickSize(-innerHeight)
                    .tickPadding(15);

                const yAxis = d3.axisLeft(yScale)
                    .tickSize(-innerWidth)
                    .tickPadding(10);

                const yAxisG = g.append('g').call(yAxis);
                yAxisG.selectAll('.domain').remove();

                yAxisG.append('text')
                    .attr('class', 'axis-label')
                    .attr('y', -60)
                    .attr('x', -innerHeight / 2)
                    .attr('fill', 'black')
                    .attr('transform', 'rotate(-90)')
                    .attr('text-anchor', 'middle')
                    .text(yAxisLabel);

                const xAxisG = g.append('g').call(xAxis)
                    .attr('transform', `translate(0, ${innerHeight})`);

                xAxisG.select('.domain').remove();

                xAxisG.append('text')
                    .attr('class', 'axis-label')
                    .attr('y', 80)
                    .attr('x', innerWidth / 2)
                    .attr('fill', 'black')
                    .text(xAxisLabel);

                const lineGenerator = d3.line()
                    .x(d => xScale(xValue(d)))
                    .y(d => yScale(yValue(d)))
                    .curve(d3.curveBasis);

                const lastYValue = d => yValue(d.values[d.values.length - 1]);

                const nested = d3.nest()
                .key(colorValue)
                .entries(data)
                .sort((a, b) => d3.descending(lastYValue(a), lastYValue(b)));

                console.log('data', data, data.columns);
                console.log('nested', nested);

                colorScale.domain(nested.map(d => d.key));

                g.selectAll('.line-path').data(nested)
                    .enter().append('path')
                    .attr('class', 'line-path')
                    .attr('d', d => lineGenerator(d.values))
                    .attr('stroke', d => colorScale(d.key));

                g.append('text')
                    .attr('class', 'title')
                    .attr('y', -10)
                    .text(title);

                svg.append('g')
                    .attr('transform', 'translate(790,121)')
                    .call(colorLegend, {
                      colorScale,
                      circleRadius: 13,
                      spacing: 30,
                      textOffset: 15,
                    });
            };

    // add team attribute to status counts so that d3.nest() can use it
    const explodeByTeam = d => d.map(status => (
        Object.keys(status.data).map(team => ({
            type: status.type,
            timestamp: status.timestamp,
            team,
            count: status.data[team],
        }))
        ));

/*         d3.csv('https://vizhub.com/curran/datasets/data-canvas-sense-your-city-one-week.csv')
        .then(data => {
          data.forEach(d => {
            d.temperature = +d.temperature;
            d.timestamp = new Date(d.timestamp);
          });
          render(data);
        }); */

        // get the exploded by team data and flatten the array of arrays to 1 level
        let data = explodeByTeam(dataSet);
        data = data.flat();

        const newData = data.forEach((d) => {
            const newD = d;
            newD.count = +d.count;
            newD.timestamp = new Date(d.timestamp);
        });
        render(newData);
    };
