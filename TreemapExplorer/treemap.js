
// Input variables you can change
var tW = 600,
    tH = 500,
    pad = [0,0,0,0],
    isSticky = true
    tcolor = d3.scale.category20c(),
    csvUrl = "ura_complete4.csv",
	time = d3.time.format("%d-%b-%Y"),
    //csvUrl = "../rdata/ura_complete5.csv",
    //time = d3.time.format("%Y-%m-%d"),
    //csvUrl = "../rdata/25082011110815_10_SMULibrary_202.161.41.65_8263462_efe0c4915f069b1d-D0A8109A-CE98-DE9B-C9624FD758EBCDFA.csv",
    //time = d3.time.format("%d-%b-%Y"),
	mtime = d3.time.format("%Y-%m");

//console.dir(time.parse("15-MAR-11"));
//console.dir(time.parse("2011-03-15"));
//console.dir(time.parse("15-MAR-2011"));

var pscale = d3.scale.linear()
    .domain([2000,40000])
    .range([1.0,0.2])
    .clamp(true);

var cscale =  d3.scale.linear()
    .domain([0,10])
    .range([1.0,0.2])
    .clamp(true);

var customScale =  d3.scale.linear()
    .range([1.0,0.2])
    .clamp(true);

var dcolor = d3.scale.linear()
  .domain([0,100])
  .interpolate(d3.interpolateRgb)
  .range(["#ff0000", "#0000ff"]);


// This simply inserts a new empty html div element, which the treemap will fill.
var tdiv = d3.select("#treemapDiv").append("div")
    .style("position", "relative")
    .style("width", tW + "px")
    .style("height", tH + "px");

// These are the default variables & functions used to generate the treemap
var treemap = null;
var parsedCsv = new Array();
var availableColumns = [];
var columnsQuantileArray = {};

var nestOrder = [ 'Property Type', 'Type of Sale', 'Postal Sector'];
var rollupFunc = preCalculateStatsRollupFunc;         // Choices: [ allRowsRollupFunc, preCalculateStatsRollupFunc ]
var leafSizeFunc = calCountSizeFunc;        // Choices: [ calCountSizeFunc, fetchCountSizeFunc ]
var backgroundFunc = calAvgPsmPriceBgFunc;  // Choices: [ calAvgPsmPriceBgFunc, fetchAvgPsmPriceBgFunc ]
var nestOrderBinArray = {};


// Load data & nest by selection before placing inside treeObj.
d3.csv(csvUrl, function(csv) {

  // Clean blank lines in csv
  if (csv[csv.length-1]['Project Name'] == "") {
    csv.splice(csv.length-1, 1);
  }
  //log(csv);

  // Parse numerical values/strings using + operator (to improve performance)
  csv.forEach(function(e) {
    for (var i in e) {

      if (i.indexOf('Code') != -1) {
         // If Postal Code, or other codes, skip it.
        continue;
      }
      else if (i.indexOf('Date') != -1) {
        // If Date, parse it
        var date = time.parse(e[i]);
        if (date) e[i] = date;
      }
      else if (!isNaN(e[i])) {
        // If Numerical, parse it
        e[i] = +e[i];
      }
    }
  });
  //log(csv);

  parsedCsv = parsedCsv.concat(csv);
  for (var column in parsedCsv[0]) {
    //log(column);
    availableColumns.push(column);
  }

  // Populate Jquery Sortable Nesting Lists
  populateNestLists(nestOrder, availableColumns.filter(function(e,i,a) { return (nestOrder.indexOf(e) == -1); }) );
  populateNestListsUniqueVals(parsedCsv, availableColumns);

  // Nest the CSV data in this order
  var data = d3.nest()
          //.key(function(d) { return d['Planning Area']; })
          .key(function(d) { return d['Property Type']; })
          .key(function(d) { return d['Type of Sale']; })
          .key(function(d) { return d['Postal Sector']; })
          //.key(function(d) { return d['Area (sqm)'] >= 120 ? '>120sqm' : '<120sqm' ; })
          //.key(genNestBinFunc('Area (sqm)', [50,100,150]))
          .rollup(rollupFunc)
          .entries(parsedCsv);

  //log(data);

  var treeObj = {"key":"ALL", "values":data};
  generateTreemap(treeObj);
  focusChart(parsedCsv);
});

// ---------------------------------------------------------------------------
// ------------------ Procedural Programming ends here -----------------------
// ---------------------------------------------------------------------------

// d3.layout.Treemap objects cannot be reused.
function newTreemap() {
  return d3.layout.treemap()
    .padding(pad)
    .size([tW, tH])
    .sticky(isSticky)
    .children(function(d) { return (d.values instanceof Array) ? d.values : null; })
    .value(leafSizeFunc);
}

// Generate & Render Treemap unto browser's DOM/SVG.
  // Alternative values for div.data():
  // [treeObj]
  // [[treeObj][0].values[2]]
  // [treeObj.values[2]]
  // [treeObj.values[2].values[1]]
function generateTreemap(treeObj) {
  //log(treeObj);

  treemap = newTreemap();

  // This is the original form of the next few lines
  //  div.data([treeObj]).selectAll("div")
  //    .data(treemap.nodes)

  tdiv.selectAll("div")
      .data(treemap.nodes(treeObj))
    .enter().append("div")
      .attr("class", "cell")
      .style("background-color", backgroundFunc)
      .call(cell)
      //.classed("invisible", function(d) { return d.depth <= 1 ? false : true; })
      .attr("data-showall", function(d) { return d.depth <= 1 ? false : true; })
      .text(function(d) {
            if (d.key) {
              return d.key;
            } else if (d['Project Name']) {
              return d['Project Name'];
            } else {
              return null;
            }
          })
      .classed("hasChildren", function(d) { return d.children ? true : false; });

  // Next, wire treemap nodes events
  wireTreemapNodesEvents();

  // Lastly, button events must be wired.
  wireButtonEvents();

  // Reset buttons
  resetButtonStates();

  // Fire starting animations
  //div.selectAll("div .invisible").classed("invisible", false).call(fadeIn);
  toggleTitle(true);
}

// ---------------------------------------------------------------------------
// -------------------- UI Enhancements starts here --------------------------
// ---------------------------------------------------------------------------

function wireTreemapNodesEvents() {
  tdiv.selectAll("div").on("click", function(d, i) {
    var e = d3.event, datum = d, dep = d.depth;
    if (d.children) {
      //alert("Key: " + d.key + ", i: " + i);

      tdiv.selectAll("div")
        .filter(function(d) {
          if (d.parent) {
            return d.depth == dep+1 && d.parent == datum;
          } else {
            return d.depth == dep+1;
          }
        })
          .style("opacity", 0.0)
          .classed("invisible", false)
        .transition()
          .duration(500)
          .style("opacity", 1.0);

      var rows = combineAllChildrenRows(d);
      //console.dir(rows);
      focusChart(rows);
    } else {
      //alert("Key: " + d.key + ", Average Psm Price: " + d.values['avgPsmPrice']);
      //focusChart(d.values.rows);

      var postalSector = d.values.rows[0]["Postal Sector"];
      $('#singaporeMap').dialog('open');
      $("#"+postalSector).dblclick();
      $("#"+postalSector).attr("data-clicked", "true");
    }
  });

  tdiv.selectAll("div").on("mousedown", function(d, i) {
    var e = d3.event;
    //return false;

    if (e.which === 3) {
      zeroWithChildren(d);

      tdiv.selectAll("div")
          .data(treemap.value(function(d) { return d.value; }))
        .transition()
          .duration(1500)
          .call(cell);
    }
    e.stopPropagation();
    return false;
  });

  tdiv.selectAll("div").on("mouseover", function(d, i) {
    var e = d3.event;
	if (d.children){
		var postalSector = d.values.rows[0]["Postal Sector"];
		$("#"+postalSector).dblclick();
	}
    //log( d.values['avgPsmPrice'] ? d.values['avgPsmPrice'] : d.key );
    //d.values.rows && log(d.values.rows);
    //log(d.parent.key);
    //log(d.parent.parent.key);

    /*
    if (d.values.rows) {
      var lineData = d3.nest()
              .key(function(d2) { return mtime(d2['Contract Date']); }).sortKeys(d3.ascending)
              .rollup(function(d2) {
                var maxPsmPrice = d3.max(d2, function(d3) { return d3['Unit Price ($ psm)']; } );
                return { "rows": d.values.rows, "maxPsmPrice": maxPsmPrice };
              })
              .entries(d.values.rows);

      //console.dir(lineData);
      //zoomchartNS.generateLine("lines", lineData);
    }*/

  });

  tdiv.selectAll("div").on("mouseout", function(d, i) {
    if (d.children){
		var e = d3.event;
	
		var postalSector = d.values.rows[0]["Postal Sector"];
		$("#"+postalSector).click();
	}
  });
}

function wireButtonEvents() {

  d3.select("#sizeByUnitPrice").on("click", function() {
    tdiv.selectAll("div")
        .data(treemap.value(function(d) { return d.values['avgPsmPrice']; }))
      .transition()
        .style("background-color", fetchCountBgFunc)
        .duration(1500)
        .call(cell);

    d3.select("#sizeByCount").classed("active", false);
    d3.select("#sizeByArea").classed("active", false);
    d3.select("#sizeByUnitPrice").classed("active", true);
  });

  d3.select("#sizeByCount").on("click", function() {
    tdiv.selectAll("div")
        .data(treemap.value(function(d) { return d.values['count']; }))
      .transition()
        .style("background-color", fetchAvgPsmPriceBgFunc)
        .duration(1500)
        .call(cell);

    d3.select("#sizeByCount").classed("active", true);
    d3.select("#sizeByArea").classed("active", false);
    d3.select("#sizeByUnitPrice").classed("active", false);
  });

  d3.select("#sizeByArea").on("click", function() {
    tdiv.selectAll("div")
        //.data(treemap.value(function(d) { return d.values['avgArea']; }))
        .data(treemap.value(genCalColumnTotalSizeFunc("Area (sqm)")))
      .transition()
        //.style("background-color", fetchAvgPsmPriceBgFunc)
        .style("background-color", genCalColumnAvgBgFunc(10, pscale, "Unit Price ($ psm)", "No. of Units"))
        .duration(1500)
        .call(cell);

    d3.select("#sizeByCount").classed("active", false);
    d3.select("#sizeByArea").classed("active", true);
    d3.select("#sizeByUnitPrice").classed("active", false);
  });

  d3.select("#renderByCustom").on("click", function() {
    var sizeByColumn = d3.select("#sizeByCustom").node().value;
    var colorByColumn = d3.select("#colorByCustom").node().value;

    var q = columnsQuantileArray[colorByColumn]
    var lightScale = q ? customScale.domain([ q[0], q[3] ]) : pscale;

    tdiv.selectAll("div")
        .data(treemap.value(genCalColumnTotalSizeFunc(sizeByColumn)))
      .transition()
        .style("background-color", genCalColumnAvgBgFunc(10, lightScale, colorByColumn, "No. of Units"))
        .duration(1500)
        .call(cell);

    d3.select("#sizeByCount").classed("active", false);
    d3.select("#sizeByArea").classed("active", false);
    d3.select("#sizeByUnitPrice").classed("active", false);
  });

  d3.select("#toggleTitle").on("click", toggleTitle);

  d3.select("#toggleSticky").on("click", function() {
    var newSticky = !d3.select("#toggleSticky").classed("active");
    treemap.sticky(newSticky);
    d3.select("#toggleSticky").classed("active", newSticky);
  });

  d3.select("#toggleShowAll").on("click", function() {
    if (d3.select("#toggleShowAll").classed("active") == true) {
      tdiv.selectAll("div [data-showall=true]").attr("data-showall", false).call(fadeOut).classed("invisible", true);
      d3.select("#toggleShowAll").classed("active", false);
    } else {
      tdiv.selectAll("div .invisible").attr("data-showall", true).classed("invisible", false).call(fadeIn);
      d3.select("#toggleShowAll").classed("active", true);
    }
  });

  d3.select("#hideAll").on("click", function() {
  });

  d3.select("#renestData").on("click", function() {
    nestOrder = [];
    d3.select("#nestOrderList").selectAll("li").each(function(d) {
      //log(d);
      nestOrder.push(d);
    });

    tdiv.selectAll("div").remove();

    var nest = d3.nest();
    for (var i in nestOrder) {
      var colName = nestOrder[i];
      
      if (nestOrderBinArray[colName]) {
        nest.key(genNestBinFunc(colName, nestOrderBinArray[colName]));
        log(colName + "=> " + nestOrderBinArray[colName]);
      } else {
        nest.key(genNestKeyFunc(colName));
        log(colName);
      }
    }
    var data = nest.rollup(rollupFunc).entries(parsedCsv);

    //log(data);

    var treeObj2 = {"key":"ALL", "values":data};
    generateTreemap(treeObj2);
    
  });
}

function resetButtonStates() {
  d3.select("#toggleShowAll").classed("active", true);
  d3.select("#toggleTitle").classed("active", false);
  d3.select("#toggleSticky").classed("active", true);
}

function toggleTitle(force) {
      if (!force && d3.select("#toggleTitle").classed("active") == true) {

      tdiv.selectAll("div")
          .data(treemap.padding([0,1,1,0]))
        .transition()
          .duration(1500)
          .call(cell);

      d3.select("#toggleTitle").classed("active", false);
    } else {

      tdiv.selectAll("div")
          .data(treemap.padding([12,4,4,4]))
        .transition()
          .duration(1500)
          .call(cell);

      d3.select("#toggleTitle").classed("active", true);
    }
}




function populateNestLists(activeColumns, inactiveColumns) {

  // Populate jquery sortable lists
  var li = d3.select("#nestOrderList").selectAll("li")
            .data(activeColumns)
          .enter().append("li")
            .attr("class", "ui-state-default")
            .attr("data-colName", function(d) { return d; });
  li.append("span").attr("class", "ui-icon ui-icon-arrowthick-2-e-w");
  li.append("div").text(function(d) { return d; });

  var li = d3.select("#availColList").selectAll("li")
            .data(inactiveColumns)
          .enter().append("li")
            .attr("class", "ui-state-default")
            .attr("data-colName", function(d) { return d; });
  li.append("span").attr("class", "ui-icon ui-icon-arrowthick-2-e-w");
  li.append("div").text(function(d) { return d; });

}

function populateNestListsUniqueVals(rowsData, colNames) {
  var colNameKeys = {};

  for (var i in colNames) {
    var colName = colNames[i];   // e.g. "Property Type"
    
    colNameKeys[colName] = unique(rowsData, colName).sort(d3.ascending);

    // Auto-binning if too many unique categories
    if ( colNameKeys[colName].length > 20 && colNameKeys[colName][0].constructor === Number && colName.indexOf('Postal') == -1) {
      var colPopulation = rowsData.map(function(e) { return e[colName]; }).sort(d3.ascending);

      columnsQuantileArray[colName] = [];
      var p = [0, 0.25, 0.5, 0.75, 1];
      for (i in p) {
        columnsQuantileArray[colName].push(d3.quantile(colPopulation, p[i]));
      }
    }
    
  }

  //log(colNameKeys);


  d3.select("#nestOrderList").selectAll("li")
        .append("div")
          .attr("class", "colKeysWindow")
          .html(function(d) {
            var html = "";
            for (i in colNameKeys[d]) {
              var colKey = colNameKeys[d][i];
              html += "<div data-colKey='" + colKey + "'>" + colNameKeys[d][i] + "</div>";
            }
            return html;
          });

  d3.select("#availColList").selectAll("li")
        .append("div")
          .attr("class", "colKeysWindow")
          .html(function(d) {
            var html = "";
            for (i in colNameKeys[d]) {
              html += "<div>" + colNameKeys[d][i] + "</div>";
            }
            return html;
          });
  
}

function unique(ar, colName) {
  var f = {}, i = 0, l = ar.length, r = [];

  while (i < l) {
    var val = ar[i][colName];
    !f[val] && r.push(val);
    var nextVal = ar[i++][colName];
    f[nextVal] = true;
  }

  return r;
};

// ---------------------------------------------------------------------------
// ------------------ Algorithmic Arsenal starts here ------------------------
// ---------------------------------------------------------------------------


// ------- Begin: Static algorithms that pre-calculate -------

function preCalculateStatsRollupFunc(d) {
  var maxPsmPrice = d3.max(d, function(e) { return e['Unit Price ($ psm)']; } );
  var avgPsmPrice = 0;
  var count = 0;
  var avgArea = 0;

  // d is array of all rows with each nesting-property type.
  for (i in d) {
    var psmPrice = +d[i]['Unit Price ($ psm)'];
    var unitCount = +d[i]['No. of Units'];
    var area = +d[i]['Area (sqm)'];

    avgPsmPrice += psmPrice * unitCount;    // avgPsmPrice += psmPrice;
    count += unitCount;   // count ++;
    avgArea += area * unitCount;
  }

  avgPsmPrice = avgPsmPrice / count;
  avgArea = avgArea / count;
  return {"maxPsmPrice":maxPsmPrice, "avgPsmPrice":avgPsmPrice, "count":count, "avgArea":avgArea, "rows": d};
}

function preCalculateMaxStatsRollupFunc(d) {
  var maxPsmPrice = d3.max(d, function(d) {return d['Unit Price ($psm)']; });
  return {"rows": d, "maxPsmPrice": maxPsmPrice};
}

function fetchCountSizeFunc(d) {
  return d['No. of Units'] ? +d['No. of Units'] : +d.values['count'];
}

function fetchAvgPsmPriceBgFunc(d) {
  if (d.children) {
    return tcolor((d.parent ? d.parent.key + "-" : null) + d.key);
    //return "grey";
  } else if (d.values && d.values['avgPsmPrice']) {
    return d3.hsl(10, 0.8, pscale(d.values.avgPsmPrice));
  } else {
    return null;
  }
}

function fetchCountBgFunc(d) {
  if (d.children) {
    return tcolor((d.parent ? d.parent.key + "-" : null) + d.key);
    //return "grey";
  } else if (d.values && d.values['count']) {
    return d3.hsl(300, 0.8, cscale(d.values.count));
  } else {
    return null;
  }
}


// ------- Begin: Static algorithms that calculate-on-the-fly -------

function allRowsRollupFunc(d) {
  return {"rows": d};
}

function calCountSizeFunc(d) {
  return d.values.rows.reduce(function(prevVal, curVal, idx, array) {
    return prevVal + curVal['No. of Units'];
  }, 0);
}

function calAvgPsmPriceSizeFunc(d) {
  var count = calCountSizeFunc(d);
  var total = d.values.rows.reduce(function(prevVal, curVal, idx, array) {
      return prevVal + (curVal['Unit Price ($ psm)'] * curVal['No. of Units']);
    }, 0);
  var avgPsmPrice = total/count;

  return avgPsmPrice;
}

function calAvgPsmPriceBgFunc(d) {
  if (d.children) {
    return tcolor((d.parent ? d.parent.key + "-" : null) + d.key);
    //return "grey";
  } else if (d.values && d.values.rows) {
    var avgPsmPrice = calAvgPsmPriceSizeFunc(d);

    return d3.hsl(10, 0.8, pscale(avgPsmPrice));
  } else {
    return null;
  }
}


// ------- Begin: Dynamic generators for algorithms that calculate-on-the-fly -------

function genCalColumnTotalSizeFunc(colName) {
  return function(d) {
    return d.values.rows.reduce(function(prevVal, curVal, idx, array) {
      return prevVal + curVal[colName];
    }, 0);
  };
}

function genCalColumnAvgSizeFunc(colName, countColName) {
  if (countColName === undefined) {
    // Normal Average
    return function(d) {
      var count = d.values.rows.length;
      var total = d.values.rows.reduce(function(prevVal, curVal, idx, array) {
            return prevVal + curVal[colName];
          }, 0);
      var colAverage = total/count;

      return colAverage;
    };

  } else {
    // Weighted Average
    return function(d) {
      var count = genCalColumnTotalSizeFunc(countColName)(d);
      var total = d.values.rows.reduce(function(prevVal, curVal, idx, array) {
            return prevVal + (curVal[colName] * curVal[countColName]);
          }, 0);
      var colAverage = total/count;

      return colAverage;
    };
  }
}

function genCalColumnAvgBgFunc(hue, lightScale, colName, countColName) {
  return function(d) {
    if (d.children) {
      return tcolor((d.parent ? d.parent.key + "-" : null) + d.key);
      //return "grey";
    } else if (d.values && d.values.rows) {
      var colAverage = genCalColumnAvgSizeFunc(colName, countColName)(d);

      return d3.hsl(hue, 0.8, lightScale(colAverage));
    } else {
      return null;
    }
  };
}


// ------- Begin: Dynamic generators for nesting algorithms -------

function genNestKeyFunc(colName) {
  // This is rescope/closures programming technique.
  // See: http://stackoverflow.com/questions/2382359/how-to-copy-a-variable-in-javascript
  return function(d) { return d[colName]; };
}

function genNestBinFunc(colName, binArray) {
  binArray.sort(d3.ascending);
  return function(d) {
    for(var i in binArray) {
      if (d[colName] <= binArray[i]) {
        return "<=" + binArray[i];
      }
    }
    return ">" + binArray[binArray.length-1];
  };
}


// ---------------------------------------------------------------------------
// ------------------ Helper functions starts here ---------------------------
// ---------------------------------------------------------------------------

function cell() {
  this
      .style("left", function(d) { return d.x + "px"; })
      .style("top", function(d) { return d.y + "px"; })
      .style("width", function(d) { return d.dx - 1 + "px"; })
      .style("height", function(d) { return d.dy - 1 + "px"; });
}

function combineAllChildrenRows(d) {
  return recurseAllChildrenRows(d);
}

function recurseAllChildrenRows(d) {
  if (d.children)
  {
    var childs = d.values;
    var collectorArray = new Array();

    for (var i in childs) {
      var eachChild = childs[i];
      var eachChildRows = recurseAllChildrenRows(eachChild);
      collectorArray = collectorArray.concat(eachChildRows);
    }
    return collectorArray;
  }
  else
  {
    return d.values.rows;
  }
}

function zeroWithChildren(datum) {
	datum.value = 0;
	if(datum.children) {
		for (var i=0; i < datum.children.length; i++) {
			zeroWithChildren(datum.children[i]);
		}
	}
}

function fadeIn() {
  this
        .style("opacity", 0.0)
      .transition()
        .duration(500)
        .style("opacity", 1.0);
}

function fadeOut() {
  this
        .style("opacity", 1.0)
      .transition()
        .duration(500)
        .style("opacity", 0.0);
}

function log(msg, args) {
  var params = null;
  var logDiv = document.getElementById('log');

  if (msg === null) msg = "null";
  if (args) {
    params = [msg];
    params = params.concat(args);
    console.log.apply(console, params);
   }

  try {
    var timeString = (new Date()).toLocaleTimeString();
    timeString = "<small>" + timeString + "</small>";

    if (msg instanceof Object) {
      console.dir(msg);
      logDiv.innerHTML += timeString + "<br />" + JSON.stringify(msg) + "<hr />";
    } else {
      logDiv.innerHTML += timeString + "<br />" + msg + "<hr />";
    }
  } catch(ex) {
    //console.warn("Error:", ex.type);
  }

  return msg;
}



/*
// Problem with the below.
Array.prototype.getUnique = function(){
   var u = {}, a = [];
   for(var i = 0, l = this.length; i < l; ++i){
      if(this[i] in u)
         continue;
      a.push(this[i]);
      u[this[i]] = 1;
   }
   return a;
}*/

/*
// Tutorial:

d3.json("../data/flare.json", function(json) {
  div.data([json]).selectAll("div")
      .data(treemap.nodes)
    .enter().append("div")
      .attr("class", "cell")
      .style("background", function(d) { return d.children ? color(d.name) : null; })
      .call(cell)
      .text(function(d) { return d.children ? null : d.name; });

  d3.select("#size").on("click", function() {
    div.selectAll("div")
        .data(treemap.value(function(d) { return d.size; }))
      .transition()
        .duration(1500)
        .call(cell);

    d3.select("#size").classed("active", true);
    d3.select("#count").classed("active", false);
  });

  d3.select("#count").on("click", function() {
    div.selectAll("div")
        .data(treemap.value(function(d) { return 1; }))
      .transition()
        .duration(1500)
        .call(cell);

    d3.select("#size").classed("active", false);
    d3.select("#count").classed("active", true);
  });
});

*/


// ---------------------------------------------------------------------------
// ------------------ Jquery functions starts here ---------------------------
// ---------------------------------------------------------------------------

function wireSlider(thisSlider) {

  var colName = thisSlider.attr("data-colName");
  var colQuantileArray = columnsQuantileArray[colName];
  var colBinArray = nestOrderBinArray[colName];
  
  var thisSliderStatus = $('<div></div>').addClass("slider-status");
  thisSlider.before(thisSliderStatus);

  thisSlider.slider({
    //range: true,//don't set range
    //min: 0,
    //max: 300;
    //step: 10,
    //values: [ 50, 100, 150, 280 ],
    min: colQuantileArray[0],
    max: colQuantileArray[colQuantileArray.length-2] + 10,
    step: 1,
    values: (colBinArray ? colBinArray : colQuantileArray.slice(1, colQuantileArray.length-1)),
    slide: function(evt,ui) {
      thisSliderStatus.text(ui.values.join(" - "));
      return true;
    },
    change: function(evt,ui) {
      nestOrderBinArray[colName] = ui.values;
      //log(nestOrderBinArray);
    }
  });

  nestOrderBinArray[colName] = thisSlider.slider("values");
  thisSliderStatus.text(thisSlider.slider("values").join(" - "));
}