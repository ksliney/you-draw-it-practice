(function() {
  function clamp(num, min, max){ 
    return Math.max(min, Math.min(max, num))
  }

  var margin = { left: 50, right: 50, top: 30, bottom: 30 }
  var height = 400 - margin.top - margin.bottom
  var width = 600 - margin.left - margin.right

  // Add our SVG normally
  var svg = d3.select('#you-draw-it')
    .append('svg')
    .attr('height', height + margin.top + margin.bottom)
    .attr('width', width + margin.left + margin.right)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // We need this rectangle to collect clicks
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('opacity', 0)

  // Scales obvs
  var xPositionScale = d3.scaleLinear().domain([2000, 2016]).range([0, width])
  var yPositionScale = d3.scaleLinear().domain([0, 15]).range([height, 0])

  // This will be the filled-in part
  var area = d3.area()
    .x(d => xPositionScale(d.year))
    .y(d => yPositionScale(d.unemployment))
    .y1(height)

  // This will be the top of the filled-in part
  var line = d3.line()
    .x(d => xPositionScale(d.year))
    .y(d => yPositionScale(d.unemployment))

  // This is the line where we guess
  // .defined is "don't draw a line here until this has a value"
  var guessLine = d3.line()
    .x(d => xPositionScale(d.year))
    .y(d => yPositionScale(d.guess))
    .defined(d => d.guess !== null)

  // This is used to hide the initially-hidden part of the complete graph
  // Whatever it covers, it shows
  var clipper = svg.append('clipPath')
    .attr('id', 'clipper')
    .append('rect')
    .attr('width', xPositionScale(2008) - 1)
    .attr('height', height)

  // This group is the full graph
  // we clip everything after 2008
  var hiddenGroup = svg.append('g')
    .attr('id', 'finished')
    .attr('clip-path', 'url(#clipper)')

  // This is the path for our guess
  let guessPath = svg.append('path')
      .attr('class', 'guess-line')
      .attr('fill', 'none')
      .attr('stroke', '#fac532')
      .attr('stroke-width', 4)
      .attr('stroke-dasharray', '5 5')

  // Draw the text
  svg.append('text')
    .text('BUSH YEARS')
    .attr('text-anchor', 'middle')
    .attr('x', xPositionScale(2004))
    .attr('y', yPositionScale(2))
    .attr('fill', '#ed462f')
    .attr('letter-spacing', 1.5)

  svg.append('text')
    .text('OBAMA YEARS')
    .attr('text-anchor', 'middle')
    .attr('x', xPositionScale(2012))
    .attr('y', yPositionScale(2))
    .attr('fill', '#4d87b9')
    .attr('letter-spacing', 1.5)

  Promise.all([
    d3.csv("data/obama.csv")
  ]).then(ready)

  function ready([datapoints]) {    
    // Let's draw the full line in here
    hiddenGroup.append('path')
      .attr('class', 'area')
      .attr('d', area(datapoints))
      .attr('fill', '#f2f2f2')

    // Draw Bush years (before 2008)
    hiddenGroup.append('path')
      .attr('class', 'line')
      .attr('d', line(datapoints.filter(d => d.year <= 2008)))
      .attr('stroke', '#ed462f')
      .attr('stroke-width', 5)
      .attr('fill', 'none')

    // Draw Obama line (after 2008)
    hiddenGroup.append('path')
      .attr('class', 'line')
      .attr('d', line(datapoints.filter(d => d.year >= 2008)))
      .attr('stroke', '#4d87b9')
      .attr('stroke-width', 5)
      .attr('fill', 'none')

    // Draw the circles
    svg.append('circle')
      .attr('r', 5)
      .datum(datapoints.find(d => d.year == 2000))
      .attr('cy', d => yPositionScale(d.unemployment))
      .attr('cx', d => xPositionScale(d.year))
      .attr('fill', '#4d87b9')

    svg.append('circle')
      .attr('r', 5)
      .datum(datapoints.find(d => d.year == 2008))
      .attr('cy', d => yPositionScale(d.unemployment))
      .attr('cx', d => xPositionScale(d.year))
      .attr('fill', '#ed462f')

    hiddenGroup.append('circle')
      .attr('r', 5)
      .datum(datapoints.find(d => d.year == 2016))
      .attr('cy', d => yPositionScale(d.unemployment))
      .attr('cx', d => xPositionScale(d.year))
      .attr('fill', '#4d87b9')

    // We make a new dataset from the original dataset
    // the differences are that it's only 2008 and later
    // and is it has a "guess" column
    var drawData = datapoints
      .sort((a, b) => a.year - b.year)
      .filter(d => d.year >= 2008)
      .map(d => { 
        return {
          year: d.year,
          unemployment: d.unemployment,
          guess: null
        }
      })

    // 2008 is where the 'original' data ends, so we need
    // to make sure our line starts at the right spot
    // (they'll be guessing starting 2009)
    drawData[0].guess = drawData[0].unemployment

    // xPositionScale(2) - xPositionScale(1) says
    // if i had the year 2 and the year 1, how wide would the bar be?
    svg.append('g')
      .lower()
      .selectAll('rect')
      .data(drawData.filter(d => d.year != 2016))
      .enter().append('rect')
      .attr('class', 'highlighter')
      .attr('y', 0)
      .attr('x', d => xPositionScale(d.year))
      .attr('height', height)
      .attr('width', xPositionScale(2) - xPositionScale(1))
      .attr('fill', '#fff880')
      .attr('opacity', 0.5)

    var completed = false

    // This function is run whenever there is a drag or a click
    function selected() {
      if(completed) {
        // Are you done already? If yeah, I'm done
        return
      }
      console.log('You are dragging or clicking')
      var [mouseX, mouseY] = d3.mouse(this)

      // What is the year for our x position?
      var mouseYear = xPositionScale.invert(mouseX)
      var year = clamp(mouseYear, 2009, 2016)

      // What is the unemployment for our y position?
      var mouseUnemployment = yPositionScale.invert(mouseY)
      var unemployment = clamp(mouseUnemployment, 0, yPositionScale.domain()[1])

      // console.log(year, unemployment)

      // Instead of bisect we're just finding the closest datapoint
      // to where we're at, then update its unemployment
      var index = d3.scan(drawData, (a, b) => {
          return Math.abs(a.year - year) - Math.abs(b.year - year)
        })
      var closest = drawData[index]
      closest.guess = unemployment

      // Update our path with a new d
      guessPath.attr('d', guessLine(drawData))

      svg.selectAll('.highlighter')
        .attr('opacity', (d, i) => {
          if(d.guess !== null && drawData[i+1].guess !== null) {
            // if you have a guess AND the next datapoint
            // has a guess, don't draw the rectangle
            return 0
          } else {
            return 0.5
          }
        })

      var missing = drawData.filter(d => d.guess === null)
      if(missing.length === 0) {
        console.log("You are done")
        completed = true
        guessPath.attr('stroke-dasharray', 'none')

        // Extend the clipPath to show the rest of the graph
        // (whatever it covers, it shows)
        // and shove it a little further to the right to see
        // obama's final circle
        clipper.transition()
          .duration(750)
          .attr('width', width + 10)
      }
    }

    // Create our d3.drag, then attach it to the svg
    var drag = d3.drag()
      .on('drag', selected)

    svg.call(drag)
      .on('click', selected)

    // Normal axes
    var xAxis = d3.axisBottom(xPositionScale)
      .tickValues([2004, 2008, 2012, 2016])
      .tickFormat(d => d)

    svg
      .append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(xAxis)

    // var yAxis = d3.axisLeft(yPositionScale)
    //   .ticks(5).tickFormat(d => d + '%')

    // svg
    //   .append('g')
    //   .attr('class', 'axis y-axis')
    //   .call(yAxis)


    var markGroup = svg.append('g').lower()

    var xMarks = d3.range(2000, 2016.1)
    markGroup.append('g')
      .attr('class', 'x-marks')
      .selectAll('line')
      .data(xMarks)
      .enter().append('line')
      .attr('x1', d => xPositionScale(d))
      .attr('x2', d => xPositionScale(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke-width', 1.25)
      .attr('stroke-dasharray', '2 3')
      .attr('stroke', '#e6e6e6')

    var yMarks = d3.range(0, 15.1)
    markGroup.append('g')
      .attr('class', 'y-marks')
      .selectAll('line')
      .data(yMarks)
      .enter().append('line')
      .attr('y1', d => yPositionScale(d))
      .attr('y2', d => yPositionScale(d))
      .attr('x1', 0)
      .attr('x2', width)
      .attr('stroke-width', 1.25)
      .attr('stroke-dasharray', '2 3')
      .attr('stroke', '#e6e6e6')
  }
})()