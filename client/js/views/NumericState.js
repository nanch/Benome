/*
Copyright 2016 Steve Hazel

This file is part of Benome.

Benome is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License version 3
as published by the Free Software Foundation.

Benome is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Benome. If not, see http://www.gnu.org/licenses/.
*/


var numericInput;

var RecordStore = function(name) {
	this.name = name;
	var data = this.get(true);
	this.records = (data && data.split('<<|>>')) || [];
}

_.extend(RecordStore.prototype, {
    save: function(record) {
        this.add(record);
        this.set();
    },

    clear: function() {
        this.records = [];
        this.set(true);
    },

    get: function(asStr, key) {
        key = key || this.name;

        var data = this.localStorage().getItem(key);

        if (asStr) {
            return data;
        }
        else {
            var i,
                result = [],
                strRecords = data ? data.split('<<|>>') : [];

            for (i in strRecords) {
                result.push(JSON.parse(strRecords[i]));
            }

            return result;
        }
    },

    add: function(record) {
        this.records.push(JSON.stringify(record));
    },

    set: function(clear) {
        this.localStorage().setItem(this.name, clear ? '' : this.records.join('<<|>>'));
    },

    localStorage: function() {
        return localStorage;
    }
});

var NumericInput = function(config) {
    this.points = [];
};

_.extend(NumericInput.prototype, {
	init: function() {
		_.bindAll(this, 'handleClick', 'handleMouseMove', 'handleSave', 'rangeMouseMove', 'rangeClick',
						'rangeMouseOut', 'dragInit', 'dragStart', 'dragMove', 'dragEnd', 'handleClear',
						'handleResize', 'handleMouseDown', 'handleMouseUp');

		this.numericState = this.computeState();

		this.$currentValue = $('.current-value-container');

		this.$activeValue = $('<div>')
								.addClass('value-display')
								.addClass('active-value')
								.appendTo($('.scroll-horiz', this.$rootContainer));

		this.$refineValue = $('<div>')
								.addClass('value-display')
								.addClass('refine-value')
								.appendTo($('.scroll-horiz', this.$rootContainer));

		this.currentValue = null;
		this.newValue = null;

		this.store = new RecordStore('NumericInput');
		this.points = this.store.get();

		this.disableActive = false;

		this.$rootContainer = $('.numeric-input-horiz');
		this.$container = $('.inner-expanded', this.$rootContainer);
		this.$internalContainer = $('.horiz-container', this.$rootContainer);

		this.baseWidth = 0.8;
		this.baseHeight = 0.075;
		this.baseLeft = 0.185;
		this.baseTop = 0.1;
		this.scrollWidth = 0.05;

		this.$container.click(this.handleClick);
		//this.$container.mousemove(this.handleMouseMove);
		
		/*this.$container.mousedown(this.handleMouseDown);
		this.$container.mouseup(this.handleMouseUp);*/

		$('.save-button').click(this.handleSave);
		$('.clear-button').click(this.handleClear);

		var _this = this;
		$('.scroll-left')
            .click(function() {
            	_this.setScroll(_this.internalWidth * 0.66);
            });

        $('.scroll-right')
            .click(function() {
            	_this.setScroll(_this.internalWidth * -0.66);
            });

		// Delay resize until there is a pause
        this.handleResize = _.debounce(this.handleResize, 100);
        $(window).bind('resize', this.handleResize);

		this.render2();
	},

    handleResize: function() {
        if (this.resizeDisabled) {
            return;
        }
        this.render2();
    },

	handleClick: function(e) {
		if (this.disableActive || !$(e.target).hasClass('inner-expanded')) {
			return;
		}

		var x = e.originalEvent.layerX,
			value = this.computeValue(x);

		this.setCurrentValue(value);
	},

	handleMouseDown: function(e) {
		if (!$(e.target).hasClass('prev-value-gap')) {
			return;
		}

		this.refineMode = true;
		this.disableActive = true;

		var x = e.originalEvent.layerX,
			value = this.computeValue(x);

		//this.setSlidable(this.$refineValue, value - 5, value + 5);

		this.setRefineValue(value, x);
	},

	handleMouseUp: function(e) {
		if (!this.refineMode) {
			return;
		}
		this.disableActive = false;
		this.$refineValue.hide();
		this.refineMode = false;
	},

	setRefineValue: function(value, x) {
		this.$refineValue
			.html(value);

		this.$refineValue
			.css({
				'left': (x - (this.$refineValue.width() / 2)) + 'px'
			})
			.show();				
	},

	handleMouseMove: function(e) {
		if (this.refineMode) {
			var x = e.originalEvent.layerX,
				value = this.computeValue(x);

			debugger;

			this.setRefineValue(value, x);
			return;
		}

		if (this.disableActive || $(e.target).hasClass('prev-value') || $(e.target).hasClass('prev-value-two') || $(e.target).hasClass('prev-value-gap')) {
			this.$activeValue.hide();
			return;
		}

		var x = e.originalEvent.layerX,
			value = this.computeValue(x);

		this.setActiveValue(value, x);
	},

	handleSave: function() {
		if (!_.isNull(this.currentValue)) {
			this.addValue(this.currentValue);
		}
	},

	handleClear: function() {
		this.newValue = null;
		this.setCurrentValue(null);
		this.store.clear();
		this.points = [];
		this.render2();
		this.setScroll(0, true);
	},

	/*
	TODO: Differentiate between focus and arbitrary range?
	*/
	getFocus: function() {
		if (!this.points) {
			return null;
		}

		if (!_.isNull(this.newValue)) {
			return this.newValue;
		}

		var scoredPoints = _.chain(this.points)
								.sortBy(function(valueDetails) {
						            return -valueDetails.ts;
						        })
								.first(20)
								.groupBy(function(valueDetails) {
						            return valueDetails.val;
						        })
								.map(function(groupedValues) {
									return [groupedValues[0].val, groupedValues.length]
								})
								.sortBy(function(valueDetails) {
						            return valueDetails.val;
						        })
								.value();

		//console.log(scoredPoints);

		var maxDistance = 5;

		// Iterate the sorted list, computing focus clusters
		var focusScores = _.map(scoredPoints, function(pointScore, i) {
			// Nice and slow n^2, but it's a short list
			var focusScores2 = _.compact(_.map(scoredPoints, function(p, j) {
				var distance = Math.abs(j - i);
				if (distance == 0 || distance > maxDistance) {
					return;
				}

				return (pointScore[1] + p[1]) / Math.pow(pointScore[0] - p[0], 2);
			}));

			var s = _.reduce(focusScores2, function(memo, num){ return memo + num; }, 0);

			//console.log(pointScore, i, focusScores2, s);

			return [pointScore[0], s];
		});

		var focusedValue = _.max(focusScores, function(s) { return s[1]; })[0];
		
		/*var result = {
			'scoredPoints': scoredPoints,
			'focusIdx': focusIdx,
			'focusValue': focusedValue
		}*/

		//console.log(focusedValue);
		return focusedValue;
	},

	filterValues: function(values, num) {
		num = num || 20;

		// Sort by timestamp, then return the newest.
		var sortedValues = _.sortBy(values, function(valueDetails) {
						            return -valueDetails.ts;
						        });

        return _.first(sortedValues, num);
	},

	scoreValues: function(values) {
		// Iterate recent values to score and bucket them

		var valueBuckets = {};
		var now = parseInt(new Date().getTime() / 1000);

		function addToBucket(val, age) {
			if (!valueBuckets[val]) {
				valueBuckets[val] = {
					ct: 0,
					totalAge: 0,
					ages: []
				};
			}

			valueBuckets[val].ct += 1;
			valueBuckets[val].totalAge += age;
			valueBuckets[val].ages.push(age);
		}

		_.each(values, function(valueDetails) {
			var val = valueDetails.val,
				timeStamp = parseInt(valueDetails.ts),
				age = now - timeStamp;

			if (age < 0) {
				age = 0;
			}

			addToBucket(val, age);
		});

		// Now that values have been bucketed, calculate the score for each
		return _.map(valueBuckets, function(bucketDetails, value) {
			var score = Math.max(bucketDetails.totalAge / bucketDetails.ct, 1);
			
			return [parseInt(value), score];
		});
	},

	getRelevantValues: function(values) {
		// Calculate a relevance score for each value, between 0 and 1.
		var maxVal = _.max(values, function(v, k) { return v[1]; }),
			maxScore = maxVal[1];

		return _.map(values, function(v, k) {
			return [v[0], v[1] / maxScore];
		});
	},

	bandedValues: function(values) {
		var bands = {
				1: 0,
				2: 0,
				3: 0,
				4: 0,
				5: 0,
				6: 0
			},
			totalScore = 0;

		_.each(values, function(v) {
			var value = v[0],
				score = v[1];

			totalScore += score;

			_.each(_.range(3, -1, -1), function(b) {
				var bbl = Math.pow(10, b),
					bbh = Math.pow(10, b + 1);

				if (value > bbl && value <= bbh) {
					bands[b + 1] += score;
				}
			});
		});

		// Start with whichever band has the highest score. It gets 70% or so?
		var largestBand = parseInt(_.max(_.invert(bands), function(k, v) { return v - 0}));

		var result = [],
			remaining = 0.2;

		// Then go smaller if there are any values there
		if (parseInt(largestBand) > 1) {
			var prevBand = parseInt(largestBand) - 1;
			result.push({
				min: prevBand == 1 ? 0 : Math.pow(10, prevBand - 1),
				max: Math.pow(10, prevBand),
				proportion: 0.1
			});

			remaining -= 0.1;
		}

		result.push({
			min: largestBand == 1 ? 0 : Math.pow(10, largestBand - 1),
			max: Math.pow(10, largestBand),
			proportion: 0.8
		});

		// Always add a larger band
		result.push({
			min: Math.pow(10, largestBand),
			max: Math.pow(10, largestBand + 1),
			proportion: remaining
		});

		return result;
	},

	computeState: function(valueConfig) {
		var recentValues = this.points,
			state = {},
			defaultState = {
				bands: [
					{
						min: 0,
						max: 10,
						proportion: 0.8
					},
					{
						min: 10,
						max: 100,
						proportion: 0.2
					}
				],
				values: []
			};

		// Filter out irrelevant recent values. Too old?

		if (!recentValues || recentValues.length == 0) {
			state = defaultState;
		}
		else {
			var filteredValues = this.filterValues(recentValues),
				scoredValues = this.scoreValues(filteredValues),
				relevant = this.getRelevantValues(scoredValues),
				bands = this.bandedValues(relevant);

			state = {
				bands: bands,
				values: relevant
			}

		}

		return state;
	},

	setCurrentValue: function(value) {
		this.currentValue = value;

		this.$currentValue.html(value || '');
		this.$currentValue.css({
				'left': (this.posLeft - this.$currentValue.width()) + 'px'
			});
	},

	recordValue: function(value, noStore) {
		var record = {
			val: value,
			ts: Math.round(new Date().getTime() / 1000)
		}
		this.newValue = value;
		this.points.push(record);

		if (!noStore) {
			this.store.save(record);
		}
	},

	globalSize: function() {
        return {
            width: $(window).width(),
            height: $(window).height()
        }
    },

    scale: function() {
		var globalSize = this.globalSize(),
			width = globalSize.width * this.baseWidth,
			height = globalSize.height * this.baseHeight,
			left = globalSize.width * this.baseLeft,
			top = globalSize.height * this.baseTop,
			scrollWidth = width * this.scrollWidth,
			internalWidth = width - (2 * scrollWidth),
			fontSize = height * 0.9;

		this.posLeft = left;
		this.internalWidth = internalWidth;

		this.$rootContainer.css({
			'width': width + 'px',
			'height': height + 'px',
			'top': top + 'px',
			'left': left + 'px',
			'font-size': fontSize + 'px'
		});

		this.$internalContainer.css({
			'width': internalWidth + 'px',
			'left': scrollWidth + 'px'
		});

		$('.scroll-left, .scroll-right', this.$rootContainer).css({
			'width': scrollWidth + 'px'
		});

		$('.current-value-container').css({
			'top': top + 'px',
			'left': left + 'px',
			'height': height + 'px',
			'font-size': fontSize + 'px'
		});

		$('.save-button').css({
			'top': (top + (height * 1.2)) + 'px',
			'left': (left + (width / 2)) + 'px',
			'font-size': (fontSize / 2) + 'px'
		});

		$('.clear-button').css({
			'top': (top + (height * 1.2)) + 'px',
			'left': (left + (width / 1.5)) + 'px',
			'font-size': (fontSize / 2) + 'px'
		});
    },

	render2: function() {
		var $container = this.$container,
			inputWidth = $container.width(),
			focusValue = this.getFocus();

		this.scale();

		// Filter and sort relevant values
		var sortedValues = _.chain(this.points)
						.sortBy(function(valueDetails) {
				            return -valueDetails.ts;
				        })
				        .first(50)
						.groupBy(function(v) {
							return v.val;
						})
						.map(function(groupedValues) {
							return groupedValues[0].val
						})
						.sortBy(function(v) { return v; })
						.value();

		// Get index of focus
		var focusIdx = _.indexOf(sortedValues, focusValue);

		$container.empty();

		// Add in previous values
		var prevValue = 0,
			gapDiff = 3,
			totalWidth = 0,
			focusPos = 0,
			smallGapWidth = 0;

		_.each(sortedValues, function(value, i) {
			var _this = this,
				nextValue = null,
				$spaceEl = null;

			if (i == 0 && value > gapDiff) {
				$spaceEl = this.addSpace(1, value);
			}
			else if (Math.abs(value - prevValue) > gapDiff) {
				$spaceEl = this.addSpace(prevValue, value);
			}

			if ($spaceEl) {
				smallGapWidth = $spaceEl.width();
				totalWidth += smallGapWidth;
			}

			if (i < sortedValues.length - 1) {
				nextValue = sortedValues[i + 1];
			}
			else {
				nextValue = value + 50;
			}

			var $val = $('<div>')
				.addClass('value-display')
				.addClass('prev-value-two')
				.data('value', value)
				.click(function() {
					_this.setCurrentValue(value);
					return false;
				})
				.html(value)
				.appendTo($container);

			this.setSlidable($val, prevValue, nextValue);

			var currentWidth = $val.width() + 4; // FIXME: set to actual border width

			if (i == focusIdx) {
				focusPos = totalWidth + (currentWidth / 2);
			}

			totalWidth += currentWidth;
			prevValue = value;
		}, this);

		this.smallGapWidth = smallGapWidth;

		// Add 
		var lowValue = sortedValues.length ? _.max(sortedValues) : 1,
			visWidth = this.getWidth(),
			gapWidth = visWidth * 0.75;

		function nextMagnitude(beginValue) {
			return beginValue > 0 ? beginValue * 10 : 10;
		}

		_.each(_.range(0, 3), function(i) {
			var highValue = nextMagnitude(lowValue);
			var $spaceEl = this.addSpace(lowValue, highValue, gapWidth + 'px', {
				'slidable': false
			});

			totalWidth += $spaceEl.width();

			var $label = $('<div>')
				.addClass('value-display')
				.addClass('band-label')
				.html(highValue)
				.appendTo(this.$container);

			$label.css({
				'margin-left': (totalWidth - ($label.width() / 2)) + 'px'
			});

			lowValue = highValue;
		}, this);

		if (focusPos) {
			focusPos -= visWidth / 2;
			this.setScroll(-focusPos, true);
		}
	},

	addSpace: function(low, high, width, options) {
		if (!width) {
			width = '1em';
		}
		options = options || {};

		var $el = $('<div>')
			.addClass('value-display')
			.addClass('prev-value-gap')
			.css({
				'width': width
			})
			.data('value', Math.round((high + low) / 2))
			.data('highValue', high)
			.data('lowValue', low)
			.html('')
			.appendTo(this.$container);

		if (options.slidable !== false) {
			this.setSlidable($el, low, high);
		}
		this.setHover($el);
		this.setClickable($el);

		return $el;
	},

	hideActive: function(disable) {
		if (_.isBoolean(disable)) {
    		this.disableActive = disable;
    	}
    	$(this.$activeValue).hide();
    },

	setHover: function($el) {
		$el.mousemove(this.rangeMouseMove);
		$el.mouseout(this.rangeMouseOut);
	},

	rangeMouseOut: function(e) {
		this.hideActive();
	},

	rangeMouseMove: function(e) {
		if (this.disableActive) {
			$(this.$activeValue).hide();
			return;
		}

		var $target = $(e.target),
			x = e.originalEvent.layerX,
			value = this.computeRangeValue(e);

		this.setActiveValue(value, $target.offset().left + x - this.posLeft);

		e.stopPropagation();
		return false;
	},

	computeRangeValue: function(e) {
		var $target = $(e.target),
			lowValue = $target.data('lowValue'),
			highValue = $target.data('highValue'),
			x = e.originalEvent.layerX,
			width = $target.width(),
			value = Math.round(lowValue + ((highValue - lowValue) * (x / width)));

		return value;
	},

	setClickable: function($el) {
		$el.click(this.rangeClick);
	},

	rangeClick: function(e) {
		var value = this.computeRangeValue(e);
		this.setCurrentValue(value);
		/*this.addValue(value, false);
		this.render2();*/
	},

	setSlidable: function($el, low, high) {
		$el
			.data('nextValue', high)
			.data('prevValue', low)
			.drag('init', this.dragInit, {relative: false, drop: false, distance: 1})
            .drag('start', this.dragStart)
            .drag(this.dragMove)
            .drag('end', this.dragEnd);
	},

	dragInit: function(ev, dd) {
		//console.log('dragInit', ev, dd);
		var $target = $(dd.target);

		var value = $target.data('value') || 0,
			prevValue = $target.data('prevValue'),
			nextValue = $target.data('nextValue');
			/*leftLimits = null,
			rightLimits = null;*/

		dd.value = value;
		dd.prevValue = prevValue;
		dd.nextValue = nextValue;
		dd.adjustLeft = $('.horiz-container', this.$rootContainer).offset().left;

		/*if (value - prevValue > 1) {
			leftLimits = {
				'min': prevValue + 1,
				'max': value - 1,
				'inc': 1
			}
		}

		if (!_.isNull(nextValue) && (nextValue - value > 1)) {
			rightLimits = {
				'min': value + 1,
				'max': nextValue - 1,
				'inc': 1
			}
		}

		if (!leftLimits && !rightLimits) {
			return false;
		}

		dd.leftLimits = leftLimits;
		dd.rightLimits = rightLimits;
		*/

        return null;
    },

    dragStart: function(ev, dd) {
        //console.log('dragStart', ev, dd);
        this.hideActive(true);

        dd.$proxy = $('<div>')
        				.addClass('drag-value')
        				.appendTo(this.$container);
        return true;
    },

    dragMove: function(ev, dd) {
    	var dragLimit = this.smallGapWidth;
		if (Math.abs(dd.deltaX) > dragLimit) {
			return null;
		}

		var activeValue = dd.value;

		if (dd.deltaX <= 0) {
			activeValue += Math.round((dd.deltaX / dragLimit) * (dd.value - dd.prevValue - 1));
		}
		else if (dd.deltaX > 0) {
			activeValue += Math.round(dd.deltaX / dragLimit * (dd.nextValue - dd.value - 1));
		}

        dd.$proxy.css({
            left: (dd.originalX - dd.adjustLeft) + dd.deltaX
        });

		dd.currentValue = activeValue;
        dd.$proxy.html(activeValue);
    },

    dragEnd: function(ev, dd) {
    	//console.log('dragEnd', ev, dd);
        if (dd.$proxy) {
            dd.$proxy.remove();
        }

        if (!_.isNull(dd.currentValue)) {
        	this.setCurrentValue(dd.currentValue);
        }

        this.disableActive = false;
    },

	render: function() {
		var grad = '',
			numericState = this.computeState(),
			inputWidth = this.$container.width(),
			minValue = numericState.bands[0].min,
			maxValue = numericState.bands[numericState.bands.length - 1].max,
			range = maxValue - minValue,
			aggregatePercent = 0,
			sortedValues = _.sortBy(numericState.values, function(v) { return -v[1]; });

		this.$container.empty();

		_.each(numericState.bands, function(b, i) {
			var percent = Math.ceil(b.proportion * 100),
				lowColor = 40 + Math.floor((b.min / range) * 175),
				highColor = 40 + Math.floor((b.max / range) * 175);

			aggregatePercent += percent;

			if (i == 0) {
				grad += ', rgba(' + lowColor + ',' + lowColor + ',' + lowColor + ',1.0) 0%';
			}

			grad += ', rgba(' + highColor + ',' + highColor + ',' + highColor + ',1.0) ' + aggregatePercent + '%';

			// Add the boundary values
			if (i < numericState.bands.length - 1) {
				$('<div>')
					.addClass('value-display')
					.addClass('band-label')
					.css({
						'left': Math.round(inputWidth * (aggregatePercent / 100)) + 'px'
					})
					.html(b.max)
					.appendTo(this.$container);
			}

			// Add in previous values
			_.each(sortedValues, function(v, j) {
				var zIndex = (100 * (i + 1)) - j,
					r = b.max - b.min,
					value = v[0],
					_this = this;

				if (value >= b.min && value <= b.max) {
					// Compute position from value
					var z = ((value - b.min) / r), // proportion of band

						// width of band
						zz = Math.round(inputWidth * b.proportion),

						// beginning of band
						zzz = Math.round(inputWidth * ((aggregatePercent - percent) / 100)); 

					$('<div>')
						.addClass('value-display')
						.addClass('prev-value')
						.css({
							'left':  + ((z * zz) + zzz) + 'px',
							'zIndex': zIndex
						})
						.data('value', value)
						.click(function() {
							_this.setCurrentValue(value);
							return false;
						})
						.html(value)
						.appendTo(this.$container);
				}
			}, this);
		}, this);

		this.$container.css({
			'background': 'linear-gradient(to right' + grad + ')'
		});
	},

	setActiveValue: function(value, x) {
		this.$activeValue
			.html(value);

		this.$activeValue
			.css({
				'left': (x - (this.$activeValue.width() / 2)) + 'px'
			})
			.show();				
	},

	getWidth: function() {
		return $('.horiz-container', this.$rootContainer).width();
	},

	computeValue: function(x) {
		var value,
			inputWidth = this.getWidth(),
			proportion = x / inputWidth,
			aggregateProportion = 0;

		_.find(this.numericState.bands, function(b) {
			aggregateProportion += b.proportion;

			if (proportion <= aggregateProportion) {
				var lowX = (aggregateProportion - b.proportion) * inputWidth,
					highX = aggregateProportion * inputWidth,
					xRange = highX - lowX,
					xProportion = (x - lowX) / xRange;

				value = Math.round(b.min + ((b.max - b.min) * xProportion));

				return true;
			}
		});

		return value;
	},

	addValue: function(value, noStore) {
		this.recordValue(value, noStore);
		this.render2();
		this.setCurrentValue(value);
	},

	setScroll: function(position, isAbs) {
		var marginLeft = isAbs ? 0 : this.getScroll();
        this.$container.css('margin-left', (marginLeft + position) + 'px');
	},

	getScroll: function() {
        return parseInt(this.$container.css('margin-left') || 0);
	}
});
