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

{
    function init() {
        var fixtureIndex = {

        }


        function FixtureFactory(struct) {
            var config = struct.config || {},
                dest = config.dest;

            if (_.isArray(dest)) {
                dest = _.map(dest, function(destConfig) {
                    return FixtureFactory(destConfig);
                });
            }
            else if (_.isObject(dest)) {
                dest = FixtureFactory(dest);
            }
            config.dest = dest;

            if (struct.type == 'Bucket') {
                var fixture = new Bucket(config);
                fixtureIndex[fixture.id] = fixture;
                return fixture;
            }
            else if (struct.type == 'Fork') {
                config.branches = config.dest;
                delete config.dest;

                var fixture = new Fork(config);
                fixtureIndex[fixture.id] = fixture;
                return fixture;
            }
            else if (struct.type == 'Funnel') {
                var fixture = new Funnel(config);
                fixtureIndex[fixture.id] = fixture;
                return fixture;
            }
            else if (struct.type == 'Pipe') {
                var fixture = new Pipe(config);
                fixtureIndex[fixture.id] = fixture;
                return fixture;
            }

            return null;
        }

        function Fixture(options) {
            options = options || {};
            this.id = options.id || Math.round(Math.random() * 100000);
            this.priority = options.priority || 0;
            this.buffer = [];

            if (options.dest) {
                this.outFlow = options.dest;
                this.outFlow.addSource(this);
            }

            if (options.source) {

                this.addSource(options.source);
            }

            this.options = options;
        }

        _.extend(Fixture.prototype, {
            fixtureType: 'Fixture',
            fixtureFactory: FixtureFactory,

            addSource: function(inFlow) {
                this.inFlow = inFlow
            },

            add: function(point) {
                return this.outFlow && this.outFlow.add(point);
            },

            getFixture: function(fixtureID) {
                return fixtureIndex[fixtureID];
            }
        })

        function Funnel(options) {
            // A big opening for a stream to flow into
            Fixture.call(this, options);

            this.poolSize = options.poolSize || 0;
        }
        _.extend(Funnel.prototype, Fixture.prototype, {
            fixtureType: 'Funnel',
            add: function(point) {
                if (!this.outFlow) {
                    return point;
                }

                var resultPoint = this.outFlow.add(point);



                return resultPoint;

                /*if (
                    return true;
                }
                else {
                    if (this.bufferFull(point)) {
                        return false;
                    }
                    this.buffer.push(point);
                    console.log('Buffered by Funnel', this.id, point);
                    return true;
                }*/
            },

            bufferFull: function() {
                return this.buffer.length >= this.poolSize;
            }
        });

        function Fork(options) {
            // Divide the stream into different directions
            Fixture.call(this, options);

            this.branches = options.branches || [];
        }
        _.extend(Fork.prototype, Fixture.prototype, {
            fixtureType: 'Fork',
            add: function(point) {
                // Iterate until the point is accepted

                var nextPoint = point;
                _.find(_.sortBy(this.branches, function(outFlow) { return outFlow.priority; }), function(outFlow) {
                    var resultPoint = outFlow.add(nextPoint);
                    if (resultPoint.value > 0) {
                        console.log('Fork branch', this.id, nextPoint.value - resultPoint.value);
                        nextPoint = resultPoint;
                    }
                    else {
                        // Stop the iteration
                        nextPoint = resultPoint;
                        return true;
                    }
                }, this);

                return nextPoint;
            },

            addBranch: function(outFlow) {
                this.branches.push(outFlow);
            }
        });

        function Pipe(options) {
            // Cap flow rate and/or connect to other areas
            Fixture.call(this, options);
        }
        _.extend(Pipe.prototype, Fixture.prototype, {
            fixtureType: 'Pipe',
            add: function(point) {
                var result = point;

                if (this.outFlow && this.flowRateOK(point)) {
                    result = this.outFlow.add(point);
                    if (result.value < point.value) {
                        console.log('Passed through pipe', this.id, point.value - result.value);
                    }
                }
                return result;
            },

            flowRateOK: function(point) {
                return true;
            }
        });

        var ctr = 0;

        function Bucket(options) {
            this.total = 0;
            this.maxCapacity = options.capacity;
            this.interval = options.interval || null;
            this.history = options.history || [];

            // A stream destination. Has an outflow
            Fixture.call(this, options);

            this.$el = $('<div>')
                            .css({
                                position: 'absolute',
                                top: '50px',
                                left: 50 + (ctr * 200) + 'px',
                                width: '190px',
                                height: '0px',
                                border: '2px solid #8888',
                                'background-color': 'orange',
                                'text-align': 'center'
                            })
                            .html(this.id)
                            .appendTo(_this.$container);

            ctr += 1;

        }
        _.extend(Bucket.prototype, Fixture.prototype, {
            fixtureType: 'Bucket',

            getValue: function() {
                return this.total;
            },

            add: function(point) {
                var result = point,
                    pointVal = point.value,
                    total = this.total,
                    maxCapacity = this.maxCapacity;

                if (this.flowLimited()) {
                    return point;
                }

                if (total < maxCapacity) {
                    var receivedValue = Math.min(pointVal, maxCapacity - total);
                    this.total += receivedValue;
                    this.addHistory(receivedValue);

                    console.log('Added to bucket', this.id, receivedValue);
                    result = {
                        value: pointVal - receivedValue
                    }
                }

                var height = ((this.total / this.maxCapacity) * 190);
                this.$el.css({
                    top: (50 + (190 - height)) + 'px',
                    height: height + 'px'
                });
                return result;
            },

            flowLimited: function() {
                if (!this.interval) {
                    return false;
                }

                // Target flow defaults to maxCapacity
                var targetFlow = this.interval.maxFlow || this.maxCapacity,
                    intervalLength = this.interval.intervalLength,
                    refTime = Date.now() - (intervalLength * 1000);

                // Reach back until the last time the targetFlow was reached
                // Limit the flow until it is as far back as the intervalLength

                var sum = 0,
                    lastTargetTime = null,
                    history = this.history;

                _.find(history, function(point) {
                    sum += point.value;

                    if (sum >= targetFlow) {
                        lastTargetTime = point.ts;
                        return true;
                    }

                    return false;
                });

                var timeSinceTarget = Date.now() - lastTargetTime;
                if (this.id == 'Food') {
                    console.log('sum', sum, 'target', targetFlow, timeSinceTarget / 1000, history);
                }

                return timeSinceTarget < intervalLength * 1000;
            },

            addHistory: function(value) {
                var now = Date.now();
                console.log('add', now, value);
                this.history.unshift({
                    ts: now,
                    value: value
                });
            },

            remove: function(point) {
                var result = point,
                    pointVal = point.value;

                var newTotal = this.total - pointVal;
                if (newTotal <= 0) {
                    this.total = 0;
                    result = {
                        value: Math.abs(newTotal)
                    }
                }
                else {
                    this.total = newTotal
                    result = {
                        value: 0
                    }
                }

                this.$el.css({
                    height: ((this.total / this.maxCapacity) * 190) + 'px'
                });

                return result;
            }
        });

        var x = {
            type: 'Funnel',
            config: {
                poolSize: 20,
                dest: {
                    type: 'Fork',
                    config: {
                        dest: [
                            {
                                type: 'Bucket',
                                config: {
                                    id: 'Rent',
                                    priority: 1,
                                    capacity: 850,
                                    interval: {
                                        intervalLength: 20,
                                        begin: Date.now(),
                                        length: 5,
                                        func: function(periodBegin, periodLength) {
                                            return periodBegin + periodLength;
                                        }
                                    }
                                }
                            },
                            {
                                type: 'Bucket',
                                config: {
                                    id: 'Food',
                                    priority: 2,
                                    capacity: 300,
                                    interval: {
                                        intervalLength: 20,
                                        begin: Date.now(),
                                        func: function(periodBegin) {
                                            return periodBegin + 5;
                                        }
                                    }
                                }
                            },
                            {
                                type: 'Bucket',
                                config: {
                                    id: 'Bills',
                                    priority: 3,
                                    capacity: 1275 + 600,
                                    interval: {
                                        intervalLength: 20,
                                        begin: Date.now(),
                                        func: function(periodBegin) {
                                            return periodBegin + 5;
                                        }
                                    }
                                }
                            },
                            {
                                type: 'Bucket',
                                config: {
                                    id: 'Misc',
                                    priority: 4,
                                    capacity: 65 + 85 + 60 + 100,
                                    interval: {
                                        intervalLength: 20,
                                        begin: Date.now(),
                                        func: function(periodBegin) {
                                            return periodBegin + 5;
                                        }
                                    }
                                }
                            },
                            {
                                type: 'Bucket',
                                config: {
                                    id: 'Buffer',
                                    priority: 100,
                                    capacity: 9000,
                                    reflowSource: true,
                                    reflowPriority: 1
                                }
                            }
                        ]
                    }
                }
            }
        }

        //this.funnel = FixtureFactory(x);
    },

    addValue: function(val) {
        var point = {
            value: val || 1
        }

        var resultPoint = this.funnel.add(point);

        var valueRemaining = resultPoint.value;
        //Accepted = point.value - resultPoint.value;
        if (valueRemaining > 0) {
            console.log('Remaining value', valueRemaining);
        }
        else {
            console.log('Fully accepted');
        }
    },

    getBucket: function(bucketID) {
        return this.funnel.getFixture(bucketID);
    },

    withdrawValue: function(val, bucketID) {
        if (bucketID) {
            // Withdraw as much as possible from this bucket
            var bucket = this.getBucket(bucketID);
            bucket.remove({
                value: val
            });
        }
        else {
            // Withdraw from lowest-priority first, traversing all buckets
        }
    },

    reflowBuffer: function(bucketID) {
        var bucket = this.getBucket(bucketID),
            bucketValue = bucket.getValue();

        bucket.remove({
            value: bucketValue
        });

        this.addValue(bucketValue);
    }
}