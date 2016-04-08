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

var _ = require('backbone/node_modules/underscore');

var Utils = {

    localGet: function(key) {
        return localStorage.getItem(this.instanceID + '-' + key)
    },

    localSet: function(key, val) {
        return localStorage.setItem(this.instanceID + '-' + key, val)
    },

    clearDebug: function() {
        if (this.$debug) {
            this.$debug.html('');
        }
    },

    debugMsg: function(msg) {
        if (!this.$debug) {
            this.$debug = $('<div>')
                            .appendTo(this.$el)
                            .css({
                                width: '75%',
                                height: '50%',
                                left: '50px',
                                top: '50px',
                                'font-size': '0.5em',
                                'pointer-events': 'none',
                                'z-index': 9999999
                            });
        }
        this.$debug
            .show()
            .html(msg + '<br>' + this.$debug.html());
    },

    centerOn: function($refEl, $curEl) {
        var xMid = $refEl.offset().left + ($refEl.width() / 2) - this.$el.offset().left,
            yMid = $refEl.offset().top + ($refEl.height() / 2) - this.$el.offset().top,

            width = $curEl.width(),
            height = $curEl.height(),

            left = (xMid - (width / 2)),
            top = (yMid - (height / 2)),

            size = this.globalSize();

        if (top + height > size.height) {
            top = size.height - height;
        }
        else if (top < 0) {
            top = 0;
        }

        if (left + width > size.width) {
            left = size.width - width;
        }
        else if (left < 0) {
            left = 0;
        }

        $curEl.css({
            top:  top + 'px',
            left: left + 'px'
        });
    },

    /*************************
    * Data
    *************************/
    getContextDepth: function(contextID) {
        if (contextID == this.B.rootContextID) {
            return 0;
        }

        function _getDepth(contextID) {
            var parentContextID = this.B.getParentContextID(contextID);
            if (parentContextID && parentContextID != this.B.rootContextID) {
                return _getDepth(parentContextID) + 1;
            }

            return 1;
        }

        return _getDepth(contextID);
    },

    toDepth: function(contextID, targetDepth, baseDepth) {
        var currentDepth = this.getContextDepth(contextID);
        if (baseDepth) {
            targetDepth += baseDepth;
        }

        if (targetDepth == 0 || currentDepth <= targetDepth) {
            return contextID;
        }

        var nextContextID = contextID;
        while (currentDepth > targetDepth) {
            nextContextID = this.getParentContextID(nextContextID);
            currentDepth -= 1;
        }

        return nextContextID;
    },

    getParentContextID: function(contextID) {
        var contextModel = this.globalCollection.get(contextID);
        if (contextModel) {
            return contextModel.getAssoc('up')[0] || null;
        }
    },

    getItemData: function(contextID) {
        return;
        /*
        var overallData = this.overallData[contextID];

        if (!overallData || _.values(overallData).length == 0) {
            return;
        }

        var result = [
            overallData.Now.CurrentScore / overallData.Now.MaxScore,
            overallData.Day[0] / overallData.Day[1],
            overallData.Week[0] / overallData.Week[1]
        ];

        if (_.isNaN(result[0]) && _.isNaN(result[1]) && _.isNaN(result[2])) {
            return;
        }
        else {
            return result;
        }*/
    },

    formatDuration: function(duration, noSeconds) {
        var hours = Math.floor(duration / 3600),
            minutes = Math.floor((duration - (hours * 3600)) / 60),
            seconds = duration - (hours * 3600) - (minutes * 60),
            durationStr;

        if (hours || noSeconds) {
            durationStr = hours + ':' + this.zeroPad(minutes);
        }
        else {
            durationStr = this.zeroPad(minutes) + ':' + this.zeroPad(seconds);
        }

        return durationStr;
    },

    zeroPad: function(n) {
        var pad = '00';
        return (pad + n).slice(-pad.length);
    },

    getCookie: function(name) {
        var keyValue = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
        return keyValue ? keyValue[2] : null;
    },

    nextID: function(preAdd) {
        preAdd = preAdd || 0;

        var lastID = (this.lastID + preAdd) || 0,
            endRange = parseInt(this.localGet('CurrentEndIDRange'));

        if (lastID >= endRange) {
            var nextBegin = parseInt(this.localGet('NextBeginIDRange')),
                nextEnd = parseInt(this.localGet('NextEndIDRange'));

            this.localSet('CurrentBeginIDRange', nextBegin);
            this.localSet('CurrentEndIDRange', nextEnd);

            if (this.localOnly) {
                this.localSet('NextBeginIDRange', nextEnd + 1);
                this.localSet('NextEndIDRange', nextEnd + this.idRangeSize);
            }

            lastID = nextBegin;
        }
        this.lastID = lastID + 1;
        this.localSet('LastID', this.lastID);

        return this.lastID;
    },

    sum: function(vals) {
        return _.reduce(vals, function(memo, num) { return memo + num; }, 0);
    },

    // All arrays must be of same length or column sum will be NaN
    sumArrays: function(arrayList) {
        var zipped = _.zip.apply(_, arrayList),
            sum = this.sum;
        return _.map(zipped, function(col) {
            return sum(col);
        });
    }
};

module.exports = Utils;