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
    Backbone = require('backbone'),
    _ = require('backbone/node_modules/underscore');
Backbone.$ = $;

// -------------

var OptionView = Backbone.View.extend({
    tagName: 'div',
    className: 'option-view',

    events: {
    },

    initialize: function(options) {

    },

    render: function(data, contextID) {
        //$('#current-time').text(moment().format('hh:mm'));

        if (!data) {
            return;
        }

        var structure = data.Contexts,
            $actions = this.$el,
            initialWidth = $actions.width(),
            contexts = data.Overdue.concat(data.Upcoming);

        var contextGroups = _.chain(contexts)
                                .groupBy('ParentContextID')
                                .sortBy(function(z) {
                                    // Average
                                    var sum = _.reduce(z, function(memo, c){ return memo + c.CurrentScore; }, 0);
                                    return sum / z.length;
                                })
                                .sortBy(function(z) {
                                    return _.min(z, function(z) {
                                        return z.CurrentScore;
                                    })
                                })
                                .value();

        _.each(contextGroups, function(contextGroup) {
            var parentContextID = contextGroup[0].ParentContextID,
                parentContext = structure[parentContextID];

            var $context = $('<div>')
                                .addClass('context-group')
                                .css({
                                    //'background-color': 'yellow'
                                })
                                .data('ContextID', parentContextID)
                                .click(function() {
                                    window.location = containerHost + '/report/current4/' + $(this).data('ContextID');
                                });

            $context.append($('<div>')
                                .text(parentContext.label)
                                .addClass('context-label'))

            var tier1 = _.filter(contextGroup, function(v, i) {
                return v.CurrentScore < 100;
            });

            var $tier1Container = $('<div>')
                                        .addClass('tier-1')
                                        .css({
                                            width: initialWidth + 'px'
                                        });

            _.each(tier1, function(v, i) {
                var $a = $('<div>')
                                .text(v.Label)
                                .addClass('action-item')
                                .css({
                                    'background-color': B.getColor(v.ContextID)
                                })
                                .data('contextID', v.ContextID)
                                .click(function(e) {
                                    addContextPoint($(this).data('contextID'));
                                    return false;
                                });
                $tier1Container.append($a);
            });

            $context.append($tier1Container);

            var tier2 = _.filter(contextGroup, function(v, i) {
                return v.CurrentScore >= 100;
            });

            if (tier2.length) {
                var $tier2Container = $('<div>')
                                            .addClass('tier-2')
                                            .css({
                                                width: (initialWidth * 0.5) + 'px',
                                                left: initialWidth + 'px'
                                            });
                
                _.each(tier2, function(v, i) {
                    var $a = $('<div>')
                                    .text(v.Label)
                                    .addClass('action-item')
                                    .css({
                                        'background-color': B.getColor(v.ContextID)
                                    })
                                    .data('contextID', v.ContextID)
                                    .click(function(e) {
                                        addContextPoint($(this).data('contextID'));
                                        return false;
                                    });
                    $tier2Container.append($a);
                });

                $context.append($tier2Container);
            }

            $actions.append($context);
        });
    }
});

module.exports = OptionView;