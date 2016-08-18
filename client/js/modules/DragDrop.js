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

var $ = require('jquery'),
	_ = require('backbone/node_modules/underscore'),
    Hammer = require('hammerjs');

var G = global,
    GE = G.Events;

function DragDrop($el, options) {
    this.$el = $el;
    this.initDragDrop(options);
}

_.extend(DragDrop.prototype, {
    initDragDrop: function(options) {
        _.bindAll(this, 'dragMove', 'dragInit', 'dragEnd', 'dragHeld');
        this.dragThreshold = options.dragThreshold || 4;

        var mc = new Hammer(this.$el.get()[0]);
        mc.get('pan').set({
            direction: Hammer.DIRECTION_ALL,
            threshold: this.dragThreshold
        });

        mc.on('panstart', this.dragInit);
        mc.on('panmove', this.dragMove);
        mc.on('panend', this.dragEnd);
    },

    beginHoldTimer: function() {
        this.cancelHoldTimer();
        this.lastTimerBegin = Date.now();
        this.holdtimer = setTimeout(this.dragHeld, 1100);
    },

    cancelHoldTimer: function() {
        clearTimeout(this.holdtimer);
    },

    dragHeld: function() {
        var currentPos = this.getPosition(),
            currentX = currentPos.x,
            currentY = currentPos.y,
            targetEl = document.elementFromPoint(currentX, currentY);

        if (this.isDragHoldTarget(targetEl)) {
            this.execDrop(null, {
                isHold: true,
                cancelEnd: true
            });
        }
    },

    dragInit: function(e) {
        if (this.dragging) {
            return false;
        }

        //GE.trigger('DragBegin');

        var button = e.button,
            startX = e.pageX,
            startY = e.pageY;

        if (e.center) {
            if (e.pointerType == 'touch') {
                button = 0;
            }
            else {
                button = e.changedPointers[0].button;
            }
            startX = e.center.x;
            startY = e.center.y;
        }

        if (button == -1) {
            button = 0;
        }

        if (button !== 0 && button != 1) {
            console.log('Invalid button: ' + button);
            return true;
        }

        var targetEl = document.elementFromPoint(startX, startY);
        if (this.isDragSource(targetEl)) {
            var dragDetails = {
                    dragButton: button,
                    dragStartX: startX,
                    dragStartY: startY,
                    originalTarget: targetEl
                },
                dragView = this.getDragDropView(targetEl);

            if (dragView && dragView.dragHandler) {
                var dragData = dragView.dragHandler(dragView, dragDetails) || {};

                dragDetails.dragView = dragView;
                dragDetails.dragData = dragData;

                this.dragDetails = dragDetails;
                this.initDrag = true;
            }
            else {
                console.log('Element has no drag handler', dragView);
            }
        }

        return true;
    },

    dragMove: function(e) {
        var now = Date.now();
        if (!this.lastTimerBegin || (now - this.lastTimerBegin > 100)) {
            this.beginHoldTimer(this.dragDetails);
        }

        var currentPos = this.getPosition(e),
            currentX = currentPos.x,
            currentY = currentPos.y;

        //G.updateLastActivity();
        this.currentCursorX = currentX;
        this.currentCursorY = currentY;

        var dragDetails = this.dragDetails,
            $dragProxy;

        if (this.initDrag) {
            this.dragging = true;
            this.initDrag = false;

            var $proxyEl = dragDetails.dragData.$dragProxyEl;
            if (!$proxyEl) {
                $dragProxy = dragDetails.dragData.$dragProxy;
            }
            else {
                $dragProxy = $proxyEl
                                .clone()
                                .addClass('drag-proxy')
                                .css({
                                    left: $proxyEl.offset().left,
                                    top: $proxyEl.offset().top
                                })
                                .appendTo(this.$el);

                if (dragDetails.dragData.proxyClass) {
                    $dragProxy.addClass(dragDetails.dragData.proxyClass);
                }
            }

            if ($dragProxy) {
                if (parseInt($dragProxy.css('left')) == 0) {
                    var nextX = currentX - ($dragProxy.width() / 2),
                        nextY = currentY - ($dragProxy.height() / 2);

                    $dragProxy.css('left', nextX - this.$el.offset().left);
                    $dragProxy.css('top', nextY - this.$el.offset().top);
                }

                dragDetails.dragProxyStartX = parseInt($dragProxy.css('left'));
                dragDetails.dragProxyStartY = parseInt($dragProxy.css('top'));

                dragDetails.dragProxyWidth = $dragProxy.width();
                dragDetails.dragProxyHeight = $dragProxy.height();

                dragDetails.$dragProxy = $dragProxy;
            }
        }

        if (!this.dragging) {
            return;
        }

        e.preventDefault();

        $dragProxy = dragDetails.$dragProxy;

        var deltaX = dragDetails.dragStartX - currentX,
            deltaY = dragDetails.dragStartY - currentY,

            newX = dragDetails.dragProxyStartX - deltaX,
            newY = dragDetails.dragProxyStartY - deltaY;

        newX -= this.$el.offset().left;
        newY -= this.$el.offset().top;

        if (dragDetails.dragData.dragMoveHandler) {
            dragDetails.dragData.dragMoveHandler(dragDetails, {
                deltaX: deltaX,
                deltaY: deltaY,
                proxyStartX: dragDetails.dragProxyStartX,
                proxyStartY: dragDetails.dragProxyStartY,
                newX: newX,
                newY: newY
            });
        }
        else if ($dragProxy) {
            dragDetails.dragProxyX = newX;
            dragDetails.dragProxyY = newY;

            $dragProxy.css({
                'left': dragDetails.dragProxyX + 'px',
                'top': dragDetails.dragProxyY + 'px'
            });
        }

        var targetEl = document.elementFromPoint(currentX, currentY);
        if (targetEl != this.lastElOver) {
            this.clearDropHighlight();

            if (!dragDetails.dragData.dropHighlightDisabled && this.isDropHighlight(targetEl)) {
                this.setDropHighlight(targetEl);
            }
        }
        this.lastElOver = targetEl;
    },

    dragEnd: function(e) {
        this.initDrag = false;
        this.cancelHoldTimer();

        if (!this.dragging) {
            return true;
        }

        this.dragging = false;

        if (!this.cancelDragEnd) {
            this.execDrop(e);
        }

        //GE.trigger('DragEnd');
        this.cancelDragEnd = false;
        return false;
    },

    execDrop: function(e, options) {
        options = options || {};
        this.clearDropHighlight();

        var dropResult = {},
            dragDetails = this.dragDetails,
            currentPos = this.getPosition(e),
            currentX = currentPos.x,
            currentY = currentPos.y;

        var dropDetails = {
            currentX: currentX,
            currentY: currentY
        }
        _.extend(dropDetails, options);

        var targetEl = document.elementFromPoint(currentX, currentY);
        if (this.isDropTarget(targetEl)) {
            var dropView = this.getDragDropView(targetEl),
                dragView = dragDetails.dragView;

            if (dropView && dropView.dropHandler) {
                dropResult = dropView.dropHandler(dropView, dragView, dragDetails, dropDetails) || dropResult;
            }
            else {
                console.log('Dest element not a drop target', dropView);
            }
        }

        if (dragDetails.$dragProxy && !dropResult.keepProxy) {
            dragDetails.$dragProxy.remove();
        }

        if (dragDetails.dragData.dragEndHandler) {
            dragDetails.dragData.dragEndHandler(dragDetails, dropDetails);
        }

        if (options.cancelEnd) {
            this.cancelDragEnd = true;
        }
    },

    getPosition: function(e) {
        if (!e) {
            var currentX = this.currentCursorX,
                currentY = this.currentCursorY;
        }
        else {
            var currentX = e.pageX,
                currentY = e.pageY;

            if (e.center) {
                currentX = e.center.x;
                currentY = e.center.y;
            }
        }

        return {
            x: currentX,
            y: currentY
        }
    },

    clearDropHighlight: function() {
        if (this.lastDropTargetEl) {
            $(this.lastDropTargetEl).removeClass('drop-highlight');
        }
    },

    setDropHighlight: function(targetEl) {
        $(targetEl).addClass('drop-highlight');
        this.lastDropTargetEl = targetEl;
    },

    isDragSource: function(targetEl) {
        if (!targetEl) {
            return false;
        }

        if (targetEl.getAttribute('BDragSource') === '1') {
            return true;
        }
        else if (targetEl.getAttribute('DragDropDescendant') === '1') {
            var currentEl = targetEl;
            while (currentEl) {
                if (currentEl.getAttribute('BDragSource') === '1') {
                    return true;
                }
                currentEl = currentEl.parentNode;
            }
        }

        return false;
    },

    isDragHoldTarget: function(targetEl) {
        if (!targetEl) {
            return false;
        }
        return targetEl.getAttribute('BDragHoldTarget') === '1';
    },

    isDropTarget: function(targetEl) {
        if (!targetEl) {
            return false;
        }

        if (targetEl.getAttribute('BDropTarget') === '1') {
            return true;
        }
        else if (targetEl.getAttribute('DragDropDescendant') === '1') {
            var currentEl = targetEl;
            while (currentEl) {
                if (currentEl.getAttribute('BDropTarget') === '1') {
                    return true;
                }
                currentEl = currentEl.parentNode;
            }
        }

        return false;
    },

    isDropHighlight: function(targetEl) {
        return (targetEl && (targetEl.getAttribute('DragDropDescendant') === '1' || 
            targetEl.getAttribute('BDropTarget') === '1') && !targetEl.getAttribute('DropHighlightDisabled'));
    },

    getDragDropView: function(targetEl) {
        if (!targetEl) {
            return null;
        }

        if (targetEl.getAttribute('BDropTarget') === '1' || targetEl.getAttribute('BDragSource') === '1') {
            return $(targetEl).data('ViewRef');
        }
        else if (targetEl.getAttribute('DragDropDescendant') === '1') {
            var currentEl = targetEl;
            while (currentEl) {
                if (currentEl.getAttribute('BDropTarget') === '1' || currentEl.getAttribute('BDragSource') === '1') {
                    return $(currentEl).data('ViewRef');
                }
                currentEl = currentEl.parentNode;
            }
        }

        return false;
    }
});

module.exports = DragDrop;