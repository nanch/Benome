# Copyright 2016 Steve Hazel
#
# This file is part of Benome.
#
# Benome is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License version 3
# as published by the Free Software Foundation.
#
# Benome is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Benome. If not, see http://www.gnu.org/licenses/.

import time

from flask import request
from benome.utils import json_response
from history_log import log_change

class Routes(object):
    def __init__(self, app, container):
        self.app = app
        self.container = container

        self.routes = (
            ('/get_root_context_id', 'get_root_context_id', ('GET',)),
            ('/get_id_block/<block_size>', 'get_id_block', ('GET',)),
            ('/get_id_block', 'get_id_block', ('GET',)),
            ('/get_last_id', 'get_last_id', ('GET',)),

            # Points
            ('/data/points/<context_id>', 'data_points', ('GET',)),
            ('/data/point/<point_id>', 'data_point', ('GET', 'POST', 'PUT', 'DELETE')),

            # Contexts
            ('/data/contexts/<context_id>', 'data_contexts', ('GET', )),
            ('/data/context/<context_id>', 'data_context', ('GET', 'POST', 'PUT', 'DELETE')),

            # Associations
            ('/data/associations/<context_id>', 'data_associations', ('GET', )),
            ('/data/association/<association_id>', 'data_association', ('GET', 'POST', 'PUT', 'DELETE')),

            # Queries
            ('/data/query', 'data_query', ('GET', )),
            ('/data/query/<context_id>', 'data_query', ('GET', )),

            # Other
            ('/get_report', 'get_report', ('POST', )),
        )

        self.attach(self.routes)

    def attach(self, routes):
        for url, name, methods in routes:
            func = self.__getattribute__(name)
            self.app.add_url_rule(url, name, func, methods=methods)

    def get_id_block(self, block_size=None):
        if block_size:
            block_size = int(block_size)

        block_begin, block_end = self.container.exec_cmd('get-id-block', params=(block_size,))

        return json_response({
            'Begin': block_begin,
            'End': block_end
        }), 200

    def get_last_id(self):
        result = self.container.exec_cmd('get-last-id', params=())
        return json_response(result), 200

    def get_root_context_id(self):
        result = self.container.exec_cmd('get-root-context-id', params=())
        return json_response(result), 200

    def data_contexts(self, context_id, anchor_time=None, interval=None):
        self.container.validate_auth()

        result = self.container.exec_cmd('get-contexts', params=(context_id, anchor_time, interval))
        return json_response(result), 200

    @log_change
    def data_context(self, context_id):
        self.container.validate_auth()

        try:
            context_id = int(context_id)
        except:
            raise Exception('Invalid ContextID')

        attributes = request.json or {}

        context = None
        if request.method == 'GET':
            response = self.container.exec_cmd('get-context', params=(context_id,))
            return json_response(response)

        elif request.method == 'POST':
            parent_id = attributes.get('ParentID')
            label = attributes.get('1__Label')
            try:
                del attributes['1__Label']
            except:
                pass
                
            timestamp = None
            success, context = self.container.exec_cmd('add-context', params=(parent_id, label, context_id, timestamp, attributes))

            response = {}
            if not success:
                response_code = 501
            else:
                response_code = 200
                response = context
            return json_response(response), response_code

        elif request.method == 'PUT':
            success, context = self.container.exec_cmd('update-context', params=(context_id, attributes))
            return json_response(context)

        elif request.method == 'DELETE':
            self.container.exec_cmd('delete-context', params=(context_id,))
            return json_response(True)

        return json_response(True), 200
        
    def data_points(self, context_id):
        self.container.validate_auth()

        anchor_time = None
        try:
            anchor_time = int(request.args.get('AnchorTime'))
        except:
            pass

        interval = None
        try:
            interval = int(request.args.get('Interval'))
        except:
            pass

        result = self.container.exec_cmd('get-points', params=(context_id, anchor_time, interval))
        return json_response(result), 200

    @log_change
    def data_point(self, point_id=None):
        self.container.validate_auth()
        attributes = request.json or {}

        if not point_id:
            point_id = attributes.get('ID', None)

        try:
            point_id = int(point_id)
        except:
            raise Exception('Invalid PointID')

        if request.method == 'GET':
            response = self.container.exec_cmd('get-point', params=(point_id,))
            return json_response(response)

        elif request.method == 'POST':
            time_offset = 0
            try:
                time_offset = int(attributes.get('1__TimeOffset', 0))
            except:
                pass

            success, point = self.container.exec_cmd('add-point', params=(attributes, point_id))

            response = {}
            if not success:
                response_code = 501
            else:
                response_code = 200
                response = point

            return json_response(response), response_code

        elif request.method == 'PUT':
            create = True
            point = self.container.exec_cmd('update-point', params=(point_id, attributes, create))

            response = {}
            if not point:
                response_code = 501
            else:
                response_code = 200
                response = point

            return json_response(response)

        elif request.method == 'DELETE':
            self.container.exec_cmd('delete-point', params=(point_id,))
            return json_response(True)

    def data_associations(self, context_id):
        self.container.validate_auth()

        result = self.container.exec_cmd('get-associations', params=(context_id,))
        return json_response(result), 200

    @log_change
    def data_association(self, association_id=None):
        self.container.validate_auth()

        attributes = request.json or {}

        if request.method == 'POST':
            assoc_name = attributes.get('Name', None)
            source_context_id = attributes.get('SourceID', None)
            dest_context_id = attributes.get('DestID', None)

            success, association = self.container.exec_cmd('add-association', params=(assoc_name, source_context_id, dest_context_id))

            response = {}
            if not success:
                response_code = 501
            else:
                response_code = 200
                response = association

            return json_response(response), response_code

        elif request.method == 'PUT':
            assoc_name = attributes.get('Name', None)
            source_context_id = attributes.get('SourceID', None)
            dest_context_id = attributes.get('DestID', None)

            association = self.container.exec_cmd('update-association', params=(assoc_name, source_context_id, dest_context_id))
            return json_response(association)

        elif request.method == 'DELETE':
            self.container.exec_cmd('delete-association', params=(association_id,))
            return json_response(True)

    def get_report(self):
        self.container.validate_auth()

        attributes = request.json

        context_id = int(attributes.get('ContextID'))
        interval = attributes.get('Interval')
        day = attributes.get('Day', None)
        month = attributes.get('Month', None)
        year = attributes.get('Year', None)
        begin_date = attributes.get('BeginDate', None)

        # (Y, M, D)
        if begin_date:
            pass        

        max_depth = attributes.get('MaxDepth', None)
        leaf_notes = attributes.get('LeafNotes', True)
        leaf_note_timing = attributes.get('LeafNoteTiming', False)
        public = attributes.get('Public', False)

        params = (context_id, interval, day, month, year, begin_date, max_depth, leaf_notes, leaf_note_timing, public)
        report = self.container.exec_cmd('get-report', params=params)
        success = not not report

        if not success:
            response_code = 501
        else:
            response_code = 200

        return json_response({
            'Success': success,
            'Data': {
                'Report': report
            }
        }), response_code
        
    def data_query(self, context_id=None):
        result = self.container.exec_cmd('data-query')
        return json_response({
            'GraphData': result
        }), 200