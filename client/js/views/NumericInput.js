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

// Libs
var $ = require('jquery'),
    _ = require('underscore'),
    Backbone = require('backbone'),
    jqd = require('jquery.event.drag')($);
Backbone.$ = $;

var NumericInputView = Backbone.View.extend({
    tagName: 'div',
    className: 'numeric-input',
    events: {
        'click .scroll-left': 'scrollLeft',
        'click .scroll-right': 'scrollRight',
        'click .inner-expanded': 'handleClick'
    },

    initialize: function(options) {
        options = options || {};
        _.bindAll(this, 'rangeMouseMove', 'rangeClick', 'rangeMouseOut',
                        'dragInit', 'dragStart', 'dragMove', 'dragEnd');

        this.points = options.points || [];
        this.viewID = options.viewID;
        this.minValue = _.isNumber(options.minValue) ? options.minValue : 0;

        this.numericState = this.computeState();

        this.currentValue = null;
        this.newValue = null;

        this.disableActive = false;
        this.scrollWidth = 0.05;

        this.baseHTML = '' + 
            '    <div class="current-value-container value-display"></div>' +
            '    <div class="numeric-input-horiz">' +
            '        <div class="scroll-horiz">' +
            '            <div class="scroll-left"></div>' +
            '            <div class="horiz-container">' +
            '                <div class="inner-expanded"></div>' +
            '            </div>' +
            '            <div class="scroll-right"></div>' +
            '            <div class="value-display active-value"></div>' +
            '            <div class="value-display refine-value"></div>' +
            '        </div>' +
            '    </div>';

        this.$el.append(this.baseHTML);

        this.$currentValue = $('.current-value-container', this.$el);
        this.$activeValue = $('.active-value', this.$el);
        this.$refineValue = $('.refine-value', this.$el);
        this.$rootContainer = $('.numeric-input-horiz', this.$el);
        this.$container = $('.inner-expanded', this.$el);
        this.$internalContainer = $('.horiz-container', this.$el);

        var value = options.value;
        if (_.isNumber(value)) {
            this.setCurrentValue(value, {silent: true});

            if (options.valueToHistory) {
                this.recordValue(value);
                this.newValue = value;
            }
        }
    },

    scrollRight: function() {
        this.setScroll(this.internalWidth * -0.66);
    },

    scrollLeft: function() {
        this.setScroll(this.internalWidth * 0.66);
    },

    render: function(options) {
        options = options || {};
        var $el = this.$el;

        if (options.width && options.height) {
            this.scale(options);
        }

        var $container = this.$container,
            focusValue = options.focusValue || this.getFocus();

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
        var prevValue = null,
            gapDiff = 3,
            totalWidth = 0,
            focusPos = 0,
            smallGapWidth = 0;

        _.each(sortedValues, function(value, i) {
            if (value < this.minValue) {
                return;
            }

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

            if (_.isNull(prevValue)) {
                prevValue = Math.max(this.minValue, value - 50);
            }

            this.setSlidable($val, prevValue, nextValue);

            var currentWidth = (this.fontSize * 2) + 4; // FIXME: set to actual border width
            // Add extra width for each digit past 3
            currentWidth += Math.max(0, ((value + '').length - 3)) * (this.fontSize * 0.564);

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

    containerSize: function() {
        var $parent = this.$el.parent();
        return {
            width: $parent.width(),
            height: $parent.height()
        }
    },

    scale: function(options) {
        var containerWidth = options.width,
            containerHeight = options.height,
            widthPct = options.widthPct || 0.9,
            scrollWidthPx = options.scrollWidth || 0;

        var width = containerWidth * widthPct,
            left = containerWidth * ((1 - widthPct) / 2),
            height = width * 0.2,
            top = (containerHeight - height) / 2,

            topPct = (top / containerHeight) * 100,
            leftPct = (left / containerWidth) * 100,
            widthPct = (width / containerWidth) * 100,
            heightPct = (height / containerHeight) * 100,

            scrollWidth,
            internalWidth,
            fontSize = height * 0.9;

        if (scrollWidthPx) {
            scrollWidth = scrollWidthPx;
        }
        else {
            scrollWidth = width * this.scrollWidth;
        }
        internalWidth = width - (2 * scrollWidth);

        //this.posLeft = this.$el.parent().offset().left;
        this.internalWidth = internalWidth;

        this.$container.css({
            'width': (width * 8) + 'px',
        });

        this.$rootContainer.css({
            'width': widthPct + '%',
            'height': heightPct + '%',
            'top': topPct + '%',
            'left': leftPct + '%',
            'font-size': fontSize + 'px'
        });

        this.$internalContainer.css({
            'width': internalWidth + 'px',
            'left': scrollWidth + 'px'
        });

        $('.scroll-left, .scroll-right', this.$rootContainer).css({
            'width': scrollWidth + 'px'
        });

        var currentValueWidth = fontSize * 3;

        this.$currentValue.css({
            'top': (topPct / 3) + '%',
            'left': ((containerWidth - currentValueWidth) / 2) + 'px',
            'width': currentValueWidth + 'px',
            'height': heightPct + '%',
            'font-size': fontSize + 'px'
        });

        this.fontSize = fontSize;
    },

    handleClick: function(e) {
        if (this.disableActive || !$(e.target).hasClass('inner-expanded')) {
            return;
        }

        var x = e.originalEvent.layerX,
            value = this.computeValue(x);

        this.setCurrentValue(value);
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

            return [pointScore[0], s];
        });

        var focusedValue = _.max(focusScores, function(s) { return s[1]; })[0];
        return focusedValue;
    },

    setCurrentValue: function(value, options) {
        options = options || {};
        this.currentValue = value;
        this.$currentValue.html(value || '');

        if (!options.silent) {
            this.trigger('ValueChanged', this.currentValue);
        }
    },

    recordValue: function(value, noStore) {
        var record = {
            val: value,
            ts: Math.round(new Date().getTime() / 1000)
        }
        this.points.push(record);

        if (!noStore) {
            //this.store.save(record);
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

        //this.setActiveValue(value, $target.offset().left + x - this.posLeft);

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
        this.addValue(value, false);
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
        var $target = $(dd.target);

        var value = $target.data('value') || 0,
            prevValue = $target.data('prevValue'),
            nextValue = $target.data('nextValue');

        dd.value = value;
        dd.prevValue = prevValue;
        dd.nextValue = nextValue;
        dd.adjustLeft = $('.horiz-container', this.$rootContainer).offset().left;

        return null;
    },

    dragStart: function(ev, dd) {
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
        if (dd.$proxy) {
            dd.$proxy.remove();
        }

        if (!_.isNull(dd.currentValue)) {
            var value = dd.currentValue;

            this.setCurrentValue(value);
            this.addValue(value, false);
        }

        this.disableActive = false;
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
        this.newValue = value;
        this.recordValue(value, noStore);
        this.render();
        this.setCurrentValue(value);
    },

    getContainer: function() {
        return this.$container;
    },

    setScroll: function(position, isAbs) {
        var marginLeft = isAbs ? 0 : this.getScroll();
        this.$container.css('margin-left', (marginLeft + position) + 'px');
    },

    getScroll: function() {
        return parseInt(this.$container.css('margin-left') || 0);
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
    }
});
_.extend(NumericInputView.prototype, Backbone.Events);

module.exports = NumericInputView;