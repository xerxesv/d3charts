nv.models.multiBarLine = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 0, right: 0, bottom: 0, left: 0}
        , width = 960
        , height = 500
        , x = d3.scale.ordinal()
        , y = d3.scale.linear()
        , id = Math.floor(Math.random() * 10000) //Create semi-unique ID in case user doesn't select one
        , getX = function(d) { return d.x }
        , getY = function(d) { return d.y }
        , forceY = [0] // 0 is forced by default.. this makes sense for the majority of bar graphs... user can always do chart.forceY([]) to remove
        , clipEdge = true
        , stacked = false
        , stackOffset = 'zero' // options include 'silhouette', 'wiggle', 'expand', 'zero', or a custom function
        , color = nv.utils.defaultColor()
        , hideable = false
        , barColor = null // adding the ability to set the color for each rather than the whole group
        , disabled // used in conjunction with barColor to communicate from multiBarHorizontalChart what series are disabled
        , duration = 500
        , xDomain
        , yDomain
        , xRange
        , yRange
        , groupSpacing = 0.1
        , dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove', 'renderEnd')
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var x0, y0 //used to store previous scales
        , renderWatch = nv.utils.renderWatch(dispatch, duration)
        ;

    var last_datalength = 0;

    function chart(selection) {
        renderWatch.reset();
        selection.each(function(data) {
            var availableWidth = width - margin.left - margin.right,
                availableHeight = height - margin.top - margin.bottom,
                container = d3.select(this);
            nv.utils.initSVG(container);

            // This function defines the requirements for render complete
            var endFn = function(d, i) {
                if (d.series === data.length - 1 && i === data[0].values.length - 1)
                    return true;
                return false;
            };

            if(hideable && data.length) hideable = [{
                values: data[0].values.map(function(d) {
                        return {
                            x: d.x,
                            y: 0,
                            series: d.series,
                            size: 0.01
                        };}
                )}];

            if (stacked)
                data = d3.layout.stack()
                    .offset(stackOffset)
                    .values(function(d){ return d.values })
                    .y(getY)
                (!data.length && hideable ? hideable : data);


            //add series index and key to each data point for reference
            data.forEach(function(series, i) {
                series.values.forEach(function(point) {
                    point.series = i;
                    point.key = series.key;
                });
            });

            // HACK for negative value stacking
            if (stacked)
                data[0].values.map(function(d,i) {
                    var posBase = 0, negBase = 0;
                    data.map(function(d) {
                        var f = d.values[i]
                        f.size = Math.abs(f.y);
                        if (f.y<0)  {
                            f.y1 = negBase;
                            negBase = negBase - f.size;
                        } else
                        {
                            f.y1 = f.size + posBase;
                            posBase = posBase + f.size;
                        }
                    });
                });

            // Setup Scales
            // remap and flatten the data for use in calculating the scales' domains
            var seriesData = (xDomain && yDomain) ? [] : // if we know xDomain and yDomain, no need to calculate
                data.map(function(d) {
                    return d.values.map(function(d,i) {
                        return { x: getX(d,i), y: getY(d,i), y0: d.y0, y1: d.y1 }
                    })
                });

            x.domain(xDomain || d3.merge(seriesData).map(function(d) { return d.x }))
                .rangeBands(xRange || [0, availableWidth], groupSpacing);

            y.domain(yDomain || d3.extent(d3.merge(seriesData).map(function(d) { return stacked ? (d.y > 0 ? d.y1 : d.y1 + d.y ) : d.y }).concat(forceY)))
                .range(yRange || [availableHeight, 0]);

            // If scale's domain don't have a range, slightly adjust to make one... so a chart can show a single data point
            if (x.domain()[0] === x.domain()[1])
                x.domain()[0] ?
                    x.domain([x.domain()[0] - x.domain()[0] * 0.01, x.domain()[1] + x.domain()[1] * 0.01])
                    : x.domain([-1,1]);

            if (y.domain()[0] === y.domain()[1])
                y.domain()[0] ?
                    y.domain([y.domain()[0] + y.domain()[0] * 0.01, y.domain()[1] - y.domain()[1] * 0.01])
                    : y.domain([-1,1]);

            x0 = x0 || x;
            y0 = y0 || y;

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-multibar').data([data]);
            var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-multibar');
            var defsEnter = wrapEnter.append('defs');
            var gEnter = wrapEnter.append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-groups');
            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            defsEnter.append('clipPath')
                .attr('id', 'nv-edge-clip-' + id)
                .append('rect');
            wrap.select('#nv-edge-clip-' + id + ' rect')
                .attr('width', availableWidth)
                .attr('height', availableHeight);

            g.attr('clip-path', clipEdge ? 'url(#nv-edge-clip-' + id + ')' : '');

            var lines = wrap.select('.nv-groups').selectAll('.meanMedianLine')
                .data(function (d) {
                    console.log('meanMedianLine data: ', d); 
                    return d; 
                }, 
                    function(d,i) { return i; });
            
            lines.exit().remove();

            lines.enter().insert('line', ':first-child')
                .attr('x1', 0)
                .attr('x2', availableWidth)
                .attr('y1', function (d) { return y0(0) || 0; })
                .attr('y2', function (d) {
                    console.log('d.total in line in linegroup: ', d.total)
                    return y0(0) || 0;
                })
                .attr('stroke', function (d,i) { return color(d,i); })
                .attr('stroke-width', 1);

            lines
                .attr('class', function(d,i) { return 'meanMedianLine nv-series-' + i });

            var groups = wrap.select('.nv-groups').selectAll('.nv-group')
                .data(function(d) { return d }, function(d,i) { return i });
            groups.enter().append('g')
                .style('stroke-opacity', 1e-6)
                .style('fill-opacity', 1e-6);

            var exitTransition = renderWatch
                .transition(groups.exit().selectAll('line, rect.nv-bar'), 'multibarExit', Math.min(100, duration))
                .attr('y', function(d) { return (stacked ? y0(d.y0) : y0(0)) || 0 })
                .attr('height', 0)
                .remove();
            if (exitTransition.delay)
                exitTransition.delay(function(d,i) {
                    var delay = i * (duration / (last_datalength + 1)) - i;
                    return delay;
                });

            groups
                .attr('class', function(d,i) { return 'nv-group nv-series-' + i })
                .classed('hover', function(d) { return d.hover })
                .style('fill', function(d,i){ return color(d, i) })
                .style('stroke', function(d,i){ return color(d, i) });
            groups
                .style('stroke-opacity', 1)
                .style('fill-opacity', 0.75);
          
            var bars = groups.selectAll('rect.nv-bar')
                .data(function(d) { return (hideable && !data.length) ? hideable.values : d.values });
            bars.exit().remove();

            var barsEnter = bars.enter().append('rect')
                    .attr('class', function(d,i) { return getY(d,i) < 0 ? 'nv-bar negative' : 'nv-bar positive'})
                    .attr('x', function(d,i,j) {
                        return stacked ? 0 : (j * x.rangeBand() / data.length )
                    })
                    .attr('y', function(d) { return y0(stacked ? d.y0 : 0) || 0 })
                    .attr('height', 0)
                    .attr('width', x.rangeBand() / (stacked ? 1 : data.length) )
                    .attr('transform', function(d,i) { return 'translate(' + x(getX(d,i)) + ',0)'; })
                ;

            bars
                .style('fill', function(d,i,j){ return color(d, j, i);  })
                .style('stroke', function(d,i,j){ return color(d, j, i); })
                .on('mouseover', function(d,i) { //TODO: figure out why j works above, but not here
                    d3.select(this).classed('hover', true);
                    dispatch.elementMouseover({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('mouseout', function(d,i) {
                    d3.select(this).classed('hover', false);
                    dispatch.elementMouseout({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('mousemove', function(d,i) {
                    dispatch.elementMousemove({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                })
                .on('click', function(d,i) {
                    dispatch.elementClick({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                    d3.event.stopPropagation();
                })
                .on('dblclick', function(d,i) {
                    dispatch.elementDblClick({
                        data: d,
                        index: i,
                        color: d3.select(this).style("fill")
                    });
                    d3.event.stopPropagation();
                });
            bars
                .attr('class', function(d,i) { return getY(d,i) < 0 ? 'nv-bar negative' : 'nv-bar positive'})
                .attr('transform', function(d,i) { return 'translate(' + x(getX(d,i)) + ',0)'; })

            if (barColor) {
                if (!disabled) disabled = data.map(function() { return true });
                bars
                    .style('fill', function(d,i,j) { return d3.rgb(barColor(d,i)).darker(  disabled.map(function(d,i) { return i }).filter(function(d,i){ return !disabled[i]  })[j]   ).toString(); })
                    .style('stroke', function(d,i,j) { return d3.rgb(barColor(d,i)).darker(  disabled.map(function(d,i) { return i }).filter(function(d,i){ return !disabled[i]  })[j]   ).toString(); });
            }

            var barSelection =
                bars.watchTransition(renderWatch, 'multibar', Math.min(250, duration))
                    .delay(function(d,i) {
                        return i * duration / data[0].values.length;
                    });

            var lineSelection =
                lines.watchTransition(renderWatch, 'multibar', Math.min(250,duration));


            if (stacked) {
                barSelection
                    .attr('y', function(d,i) {
                        return y(d.y1);
                    })
                    .attr('height', function(d,i) {
                        return Math.max(Math.abs(y(d.y + d.y0) - y(d.y0)),1);
                    })
                    .attr('x', function(d,i) {
                        return 0;
                    })
                    .attr('width', x.rangeBand());
            }
            else {
                barSelection
                    .attr('x', function(d,i) {
                        return d.series * x.rangeBand() / data.length
                    })
                    .attr('width', x.rangeBand() / data.length)
                    .attr('y', function(d,i) {
                        return getY(d,i) < 0 ?
                            y(0) :
                                y(0) - y(getY(d,i)) < 1 ?
                            y(0) - 1 :
                            y(getY(d,i)) || 0;
                    })
                    .attr('height', function(d,i) {
                        return Math.max(Math.abs(y(getY(d,i)) - y(0)),1) || 0;
                    });              
            }

            lineSelection
                .attr('y1', function (d) { return y(d.total); })
                .attr('y2', function (d) {
                    console.log('re rendering putting line in: ', d)
                    return y(d.total);
                });  

            //store old scales for use in transitions on update
            x0 = x.copy();
            y0 = y.copy();

            // keep track of the last data value length for transition calculations
            if (data[0] && data[0].values) {
                last_datalength = data[0].values.length;
            }

        });

        renderWatch.renderEnd('multibar immediate');

        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.dispatch = dispatch;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:   {get: function(){return width;}, set: function(_){width=_;}},
        height:  {get: function(){return height;}, set: function(_){height=_;}},
        x:       {get: function(){return getX;}, set: function(_){getX=_;}},
        y:       {get: function(){return getY;}, set: function(_){getY=_;}},
        xScale:  {get: function(){return x;}, set: function(_){x=_;}},
        yScale:  {get: function(){return y;}, set: function(_){y=_;}},
        xDomain: {get: function(){return xDomain;}, set: function(_){xDomain=_;}},
        yDomain: {get: function(){return yDomain;}, set: function(_){yDomain=_;}},
        xRange:  {get: function(){return xRange;}, set: function(_){xRange=_;}},
        yRange:  {get: function(){return yRange;}, set: function(_){yRange=_;}},
        forceY:  {get: function(){return forceY;}, set: function(_){forceY=_;}},
        stacked: {get: function(){return stacked;}, set: function(_){stacked=_;}},
        stackOffset: {get: function(){return stackOffset;}, set: function(_){stackOffset=_;}},
        clipEdge:    {get: function(){return clipEdge;}, set: function(_){clipEdge=_;}},
        disabled:    {get: function(){return disabled;}, set: function(_){disabled=_;}},
        id:          {get: function(){return id;}, set: function(_){id=_;}},
        hideable:    {get: function(){return hideable;}, set: function(_){hideable=_;}},
        groupSpacing:{get: function(){return groupSpacing;}, set: function(_){groupSpacing=_;}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            renderWatch.reset(duration);
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
        }},
        barColor:  {get: function(){return barColor;}, set: function(_){
            barColor = _ ? nv.utils.getColor(_) : null;
        }}
    });

    nv.utils.initOptions(chart);

    return chart;
};

nv.models.multiBarChartLine = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var multibar = nv.models.multiBarLine()
        , xAxis = nv.models.axis()
        , yAxis = nv.models.axis()
        , legend = nv.models.legend()
        , controls = nv.models.legend()
        , tooltip = nv.models.tooltip()
        ;

    var margin = {top: 30, right: 20, bottom: 50, left: 60}
        , width = null
        , height = null
        , color = nv.utils.defaultColor()
        , showControls = true
        , controlLabels = {}
        , showLegend = true
        , showXAxis = true
        , showYAxis = true
        , rightAlignYAxis = false
        , reduceXTicks = true // if false a tick will show for every data point
        , staggerLabels = false
        , rotateLabels = 0
        , x //can be accessed via chart.xScale()
        , y //can be accessed via chart.yScale()
        , state = nv.utils.state()
        , defaultState = null
        , noData = null
        , dispatch = d3.dispatch('stateChange', 'changeState', 'renderEnd')
        , controlWidth = function() { return showControls ? 180 : 0 }
        , duration = 250
        ;

    state.stacked = false // DEPRECATED Maintained for backward compatibility

    multibar.stacked(false);
    xAxis
        .orient('bottom')
        .tickPadding(7)
        .showMaxMin(false)
        .tickFormat(function(d) { return d })
    ;
    yAxis
        .orient((rightAlignYAxis) ? 'right' : 'left')
        .tickFormat(d3.format(',.1f'))
    ;

    tooltip
        .duration(0)
        .valueFormatter(function(d, i) {
            return yAxis.tickFormat()(d, i);
        })
        .headerFormatter(function(d, i) {
            return xAxis.tickFormat()(d, i);
        });

    controls.updateState(false);

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch);
    var stacked = false;

    var stateGetter = function(data) {
        return function(){
            return {
                active: data.map(function(d) { return !d.disabled }),
                stacked: stacked
            };
        }
    };

    var stateSetter = function(data) {
        return function(state) {
            if (state.stacked !== undefined)
                stacked = state.stacked;
            if (state.active !== undefined)
                data.forEach(function(series,i) {
                    series.disabled = !state.active[i];
                });
        }
    };

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(multibar);
        if (showXAxis) renderWatch.models(xAxis);
        if (showYAxis) renderWatch.models(yAxis);

        selection.each(function(data) {
            var container = d3.select(this),
                that = this;
            nv.utils.initSVG(container);
            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight = nv.utils.availableHeight(height, container, margin);

            chart.update = function() {
                if (duration === 0)
                    container.call(chart);
                else
                    container.transition()
                        .duration(duration)
                        .call(chart);
            };
            chart.container = this;

            state
                .setter(stateSetter(data), chart.update)
                .getter(stateGetter(data))
                .update();

            // DEPRECATED set state.disableddisabled
            state.disabled = data.map(function(d) { return !!d.disabled });

            if (!defaultState) {
                var key;
                defaultState = {};
                for (key in state) {
                    if (state[key] instanceof Array)
                        defaultState[key] = state[key].slice(0);
                    else
                        defaultState[key] = state[key];
                }
            }

            // Display noData message if there's nothing to show.
            if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                nv.utils.noData(chart, container)
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            // Setup Scales
            x = multibar.xScale();
            y = multibar.yScale();

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-multiBarWithLegend').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-multiBarWithLegend').append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-x nv-axis');
            gEnter.append('g').attr('class', 'nv-y nv-axis');
            gEnter.append('g').attr('class', 'nv-barsWrap');
            gEnter.append('g').attr('class', 'nv-legendWrap');
            gEnter.append('g').attr('class', 'nv-controlsWrap');

            // Legend
            if (showLegend) {
                legend.width(availableWidth - controlWidth());

                g.select('.nv-legendWrap')
                    .datum(data)
                    .call(legend);

                if ( margin.top != legend.height()) {
                    margin.top = legend.height();
                    availableHeight = nv.utils.availableHeight(height, container, margin);
                }

                g.select('.nv-legendWrap')
                    .attr('transform', 'translate(' + controlWidth() + ',' + (-margin.top) +')');
            }

            // Controls
            if (showControls) {
                var controlsData = [
                    { key: controlLabels.grouped || 'Grouped', disabled: multibar.stacked() },
                    { key: controlLabels.stacked || 'Stacked', disabled: !multibar.stacked() }
                ];

                controls.width(controlWidth()).color(['#444', '#444', '#444']);
                g.select('.nv-controlsWrap')
                    .datum(controlsData)
                    .attr('transform', 'translate(0,' + (-margin.top) +')')
                    .call(controls);
            }

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
            if (rightAlignYAxis) {
                g.select(".nv-y.nv-axis")
                    .attr("transform", "translate(" + availableWidth + ",0)");
            }

            // Main Chart Component(s)
            multibar
                .disabled(data.map(function(series) { return series.disabled }))
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function(d,i) {
                    return d.color || color(d, i);
                }).filter(function(d,i) { return !data[i].disabled }));


            var barsWrap = g.select('.nv-barsWrap')
                .datum(data.filter(function(d) { return !d.disabled }));

            barsWrap.call(multibar);

            // Setup Axes
            if (showXAxis) {
                xAxis
                    .scale(x)
                    ._ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                    .tickSize(-availableHeight, 0);

                g.select('.nv-x.nv-axis')
                    .attr('transform', 'translate(0,' + y.range()[0] + ')');
                g.select('.nv-x.nv-axis')
                    .call(xAxis);

                var xTicks = g.select('.nv-x.nv-axis > g').selectAll('g');

                xTicks
                    .selectAll('line, text')
                    .style('opacity', 1)

                if (staggerLabels) {
                    var getTranslate = function(x,y) {
                        return "translate(" + x + "," + y + ")";
                    };

                    var staggerUp = 5, staggerDown = 17;  //pixels to stagger by
                    // Issue #140
                    xTicks
                        .selectAll("text")
                        .attr('transform', function(d,i,j) {
                            return  getTranslate(0, (j % 2 == 0 ? staggerUp : staggerDown));
                        });

                    var totalInBetweenTicks = d3.selectAll(".nv-x.nv-axis .nv-wrap g g text")[0].length;
                    g.selectAll(".nv-x.nv-axis .nv-axisMaxMin text")
                        .attr("transform", function(d,i) {
                            return getTranslate(0, (i === 0 || totalInBetweenTicks % 2 !== 0) ? staggerDown : staggerUp);
                        });
                }

                if (reduceXTicks)
                    xTicks
                        .filter(function(d,i) {
                            return i % Math.ceil(data[0].values.length / (availableWidth / 100)) !== 0;
                        })
                        .selectAll('text, line')
                        .style('opacity', 0);

                if(rotateLabels)
                    xTicks
                        .selectAll('.tick text')
                        .attr('transform', 'rotate(' + rotateLabels + ' 0,0)')
                        .style('text-anchor', rotateLabels > 0 ? 'start' : 'end');

                g.select('.nv-x.nv-axis').selectAll('g.nv-axisMaxMin text')
                    .style('opacity', 1);
            }

            if (showYAxis) {
                yAxis
                    .scale(y)
                    ._ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                    .tickSize( -availableWidth, 0);

                g.select('.nv-y.nv-axis')
                    .call(yAxis);
            }

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            legend.dispatch.on('stateChange', function(newState) {
                console.log('newState: ', newState);
                for (var key in newState)
                    state[key] = newState[key];
                dispatch.stateChange(state);
                chart.update();
            });

            controls.dispatch.on('legendClick', function(d,i) {
                if (!d.disabled) return;
                controlsData = controlsData.map(function(s) {
                    s.disabled = true;
                    return s;
                });
                d.disabled = false;

                switch (d.key) {
                    case 'Grouped':
                    case controlLabels.grouped:
                        multibar.stacked(false);
                        break;
                    case 'Stacked':
                    case controlLabels.stacked:
                        multibar.stacked(true);
                        break;
                }

                state.stacked = multibar.stacked();
                dispatch.stateChange(state);
                chart.update();
            });

            // Update chart from a state object passed to event handler
            dispatch.on('changeState', function(e) {
                if (typeof e.disabled !== 'undefined') {
                    data.forEach(function(series,i) {
                        series.disabled = e.disabled[i];
                    });
                    state.disabled = e.disabled;
                }
                if (typeof e.stacked !== 'undefined') {
                    multibar.stacked(e.stacked);
                    state.stacked = e.stacked;
                    stacked = e.stacked;
                }
                chart.update();
            });
        });

        renderWatch.renderEnd('multibarchart immediate');
        return chart;
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    multibar.dispatch.on('elementMouseover.tooltip', function(evt) {
        evt.value = chart.x()(evt.data);
        evt['series'] = {
            key: evt.data.key,
            value: chart.y()(evt.data),
            color: evt.color
        };
        tooltip.data(evt).hidden(false);
    });

    multibar.dispatch.on('elementMouseout.tooltip', function(evt) {
        tooltip.hidden(true);
    });

    multibar.dispatch.on('elementMousemove.tooltip', function(evt) {
        tooltip.position({top: d3.event.pageY, left: d3.event.pageX})();
    });

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.multibar = multibar;
    chart.legend = legend;
    chart.controls = controls;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;
    chart.state = state;
    chart.tooltip = tooltip;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
        showControls: {get: function(){return showControls;}, set: function(_){showControls=_;}},
        controlLabels: {get: function(){return controlLabels;}, set: function(_){controlLabels=_;}},
        showXAxis:      {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
        showYAxis:    {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
        defaultState:    {get: function(){return defaultState;}, set: function(_){defaultState=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        reduceXTicks:    {get: function(){return reduceXTicks;}, set: function(_){reduceXTicks=_;}},
        rotateLabels:    {get: function(){return rotateLabels;}, set: function(_){rotateLabels=_;}},
        staggerLabels:    {get: function(){return staggerLabels;}, set: function(_){staggerLabels=_;}},

        // deprecated options
        tooltips:    {get: function(){return tooltip.enabled();}, set: function(_){
            // deprecated after 1.7.1
            nv.deprecated('tooltips', 'use chart.tooltip.enabled() instead');
            tooltip.enabled(!!_);
        }},
        tooltipContent:    {get: function(){return tooltip.contentGenerator();}, set: function(_){
            // deprecated after 1.7.1
            nv.deprecated('tooltipContent', 'use chart.tooltip.contentGenerator() instead');
            tooltip.contentGenerator(_);
        }},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            multibar.duration(duration);
            xAxis.duration(duration);
            yAxis.duration(duration);
            renderWatch.reset(duration);
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
            legend.color(color);
        }},
        rightAlignYAxis: {get: function(){return rightAlignYAxis;}, set: function(_){
            rightAlignYAxis = _;
            yAxis.orient( rightAlignYAxis ? 'right' : 'left');
        }},
        barColor:  {get: function(){return multibar.barColor;}, set: function(_){
            multibar.barColor(_);
            legend.color(function(d,i) {return d3.rgb('#ccc').darker(i * 1.5).toString();})
        }}
    });

    nv.utils.inheritOptions(chart, multibar);
    nv.utils.initOptions(chart);

    return chart;
};