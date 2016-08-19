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
    Backbone = require('backbone');

// -------------

function WaveState(options) {
    options = options || {};
    _.bindAll(this, 'summedWaves', 'avgSummedWaves');

    this.waveSize = options.waveSize || 2;
    this.waveColor = options.waveColor || '#00f';
    this.getWaveFunc = options.waveFunc;
    this.waves = {};
    this.refTime = Date.now() - 0;
}
_.extend(WaveState.prototype, Backbone.Events);
_.extend(WaveState.prototype, {
    updateWave: function(waveDef) {
        this.waves[waveDef.waveID] = waveDef;
        this.trigger('FuncChanged', this.waves[this.getWaveFunc()]);
    },

    deleteWave: function(waveDef) {
        delete this.waves[waveDef.waveID];
        this.trigger('FuncChanged', this.waves[this.getWaveFunc()]);
    },

    getFuncs: function() {
        var _this = this;

        return [
            {
                size: this.waveSize,
                color: this.waveColor,
                func: function(t) {
                    return _this.avgSummedWaves(t)
                }
            }
        ]
    },

    sin2: function(x) {
        var y = Math.cos(x * (2 * Math.PI)),
        val = (y + 1) / 2;
        return val;
    },

    sin: function(t, waveDef) {
        var period = waveDef.Period * 1000,
            decay = waveDef.Decay || 0,
            waveRefTime = waveDef.RefTime * 1000,

            projection = t - waveRefTime,
            x = projection / period,
            d = Math.pow(Math.E, -decay * x),
            y = Math.cos(x * (2 * Math.PI)),

            val = ((y + 1) / 2);

        /*if (Math.random() < 0.01) {
            console.log(d);
        }*/
        return {
            val: val, 
            decay: d
        };
    },

    summedWaves: function(t) {
        var sum = 0,
            decayFactorSum = 0;

        _.each(this.waves, function(waveDef, waveID) {
            var result = this.sin(t, waveDef),
                val = result.val,
                decayFactor = result.decay;

            sum += val * decayFactor;
            decayFactorSum += decayFactor; //val - (decayFactor * val);
        }, this);

        return {
            total: sum,
            decayTotal: decayFactorSum
        };
    },

    avgSummedWaves: function(t) {
        var result = this.summedWaves(t),
            numWaves = _.keys(this.waves).length,
            decayFactorSum = result.decayTotal / numWaves,
            val = result.total / numWaves;

        return {
            val: val,
            decayFactor: decayFactorSum
        }
    }
});

module.exports = WaveState;