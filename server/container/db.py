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
import random
import hashlib
import uuid
import simplejson
from copy import deepcopy

class Benome(object):
    def __init__(self, graph_db):
        self.g = graph_db
        self.g.controller = self

    def get_point(self, sid):
        return self.g.get_point(sid)

    def delete_point(self, sid):
        return self.g.delete_point(sid)

    def save(self):
        return self.g.save()

    def get_skeleton(self, root_point, ids_only=False, include_depth=False):
        result = []
        if include_depth:
            ids_only = True

        # Iterate down edges until there's nothing more
        def get_down_points(node, depth=1):
            for out_vert in self.g.outV(node, 'down', ids_only=True):
                if include_depth:
                    result.append((out_vert, depth))
                else:
                    result.append(out_vert)
                get_down_points(out_vert, depth=depth+1)

            return result

        root_point = self.g.get_point(root_point)
        result = get_down_points(root_point.sid)

        if not ids_only:
            result = self.g.to_vertex(result)

        return result

    def get_data(self, point, low=None, high=None, limit=0, attr='timeStamp', cmp_attr='timeStamp', points_only=False, ids_only=False):
        'Recursively retrieve all data points contained by the passed vertex'

        result = []

        def _get_data(node):
            exclude = []
            for out_vert in self.g.outV(node, 'down', ids_only=True):
                exclude.append(out_vert)
                _get_data(out_vert)

            for data_vert in self.g.inV(node, 'up', ids_only=True):
                if data_vert in exclude:
                    continue

                point = self.g.get_point(data_vert)

                if points_only and point.get('recordType') != 'Point':
                    continue

                if low or high:
                    cmp_val = point.get(attr, None)
                    if cmp_val is not None:
                        if low and cmp_val < low:
                            continue

                        if high and cmp_val > high:
                            continue

                result.append(data_vert)

        point = self.g.get_point(point)

        if point:
            _get_data(point.sid)

        if not ids_only:
            result = self.g.to_vertex(result)

        return result

    def delete_data(self, sid):
        'Recursively delete all data points referenced'
        to_delete = []

        def _get_delete(node):
            to_delete.append(node)

            for out_vert in self.g.outV(node, 'down', ids_only=True):
                _get_delete(out_vert)

            for data_vert in self.g.inV(node, 'up', ids_only=True):
                _get_delete(data_vert)

        _get_delete(sid)

        to_delete = list(set(to_delete))
        for sid in to_delete:
            self.g.delete_point(sid)

        return len(to_delete)

    def create_point(self, attributes):
        # relate to user ID

        up_assoc = attributes.get('upAssociations', [])
        down_assoc = attributes.get('downAssociations', [])
        detailTypes = attributes.get('detailTypes', [])
        detailValues = attributes.get('detailValues', [])

        # Whitelist attributes, with defaults
        # TODO: validate. and cleaner defaults.

        properties = deepcopy(attributes)
        try:
            del properties['upAssociations']
        except:
            pass

        try:
            del properties['downAssociations']
        except:
            pass

        updated_properties = {
            'symbol': attributes.get('symbol', 'default'),
            'recordType': attributes.get('recordType', 'Point'),
            'timeStamp': attributes.get('timeStamp', None), # round(time.time() * 1000)
            'label': attributes.get('label', ''),
            'detailTypes': detailTypes,
            'detailValues': detailValues
        }
        properties.update(updated_properties)

        # Create vertex
        point_id = self.g.add_point(properties=properties)

        # Create edges
        if up_assoc:
            for assoc_id in up_assoc:
                self.g.add_edge(point_id, 'up', assoc_id)

        if down_assoc:
            for assoc_id in down_assoc:
                self.g.add_edge(point_id, 'down', assoc_id)

        return self.g.get_point(point_id)

    def update_point(self, sid, attributes):
        point = self.g.get_point(sid)

        if not point:
            return

        whitelist = ['symbol', 'timeStamp', 'label', 'detailTypes', 'detailValues']

        updated_properties = {}
        for name in whitelist:
            if name in attributes:
                value = attributes[name]

                updated_properties[name] = value
                point[name] = value

        # TODO: Remove old up/down edges

        # Add new up/down edges
        down_assocs = attributes.get('downAssociations', [])
        if type(down_assocs) is list:
            current_down_vert_ids = point.outV('down', ids_only=True)
            for assoc_id in down_assocs:
                if assoc_id not in current_down_vert_ids:
                    self.g.add_edge(point, 'down', assoc_id)

        up_assocs = attributes.get('upAssociations', [])
        if type(up_assocs) is list:
            current_up_vert_ids = point.outV('up', ids_only=True)

            for assoc_id in up_assocs:
                if assoc_id not in current_up_vert_ids:
                    self.g.add_edge(point, 'up', assoc_id)

        return updated_properties

    def format_attributes(self, point):
        attributes = deepcopy(point.data())

        if 'Points' in attributes:
            del attributes['Points']
            
        attributes['sid'] = point.sid

        # Fill out upAssociation and downAssociation lists
        attributes['upAssociations'] = point.outV('up', ids_only=True)
        attributes['downAssociations'] = point.outV('down', ids_only=True)

        return attributes

    def get_recent_points(self, root_point, max_per=None):
        formatted_points = self.get_interval(root_point, points_only=True)

        context_map = {}
        point_map = {}

        # Map points to their contexts, limiting to max if any
        for point_attributes in formatted_points:
            for context_id in point_attributes.get('upAssociations'):
                if context_id not in context_map:
                    context_map[context_id] = []

                context_map[context_id].append(point_attributes)

        if max_per:
            # Sort by age and truncate as needed
            for context_id, context_points in context_map.items():
                context_points.sort(key=lambda x: -x['timeStamp'])
                if len(context_points) > max_per:
                    del context_points[max_per:]

                new_context_points = []
                for point_attributes in context_points:
                    point_id = point_attributes['sid']
                    point_map[point_id] = point_attributes
                    new_context_points.append(point_id)

                context_map[context_id] = new_context_points

        return point_map, context_map

    def get_structure(self, root_point, create=True, json=True):
        root_point = self.g.get_point(root_point)
        if not root_point and not create:
            raise Exception('Root not found, structure cannot be retrieved')

        skeleton = self.get_skeleton(root_point)
        return self.skeleton_to_structure(root_point, skeleton, json=json)

    def skeleton_to_structure(self, root_point, skeleton, json=True):
        points = {}

        point_attributes = self.format_attributes(root_point)
        points[point_attributes['sid']] = point_attributes

        for point in skeleton:
            point_attributes = self.format_attributes(point)
            points[point_attributes['sid']] = point_attributes

        if json:
            return simplejson.dumps(points)
        else:
            return points

    def get_interval(self, point, low=None, high=None, limit=0, attr='timeStamp', points_only=False):
        point = self.g.get_point(point)
        result = None

        if point:
            data = self.get_data(point, low=low, high=high, limit=limit, attr=attr, points_only=points_only)
            result = [self.format_attributes(point) for point in data]

        return result

    def get_encoded_point(self, point, json=True):
        point = self.g.get_point(point)
        if not point:
            return

        attributes = self.format_attributes(point)
        if json:
            return simplejson.dumps(attributes)
        else:
            return attributes

    def get_updated_encoded_point(self, sid, attributes, json=True):
        if not sid:
            sid = attributes.get('sid')

        if sid:
            updated_attributes = self.update_point(sid, attributes)

            if json:
                return simplejson.dumps(updated_attributes)
            else:
                return updated_attributes

    def init_user(self, user_id, password=None):
        properties = {
            'sid': hashlib.sha224(user_id).hexdigest(),
            'entrypoint': '', #hashlib.sha224(str(uuid.uuid4())).hexdigest(),
            'statedata': {}
        }
        user_vertex_sid = self.g.add_point(properties=properties)
        return user_vertex_sid

    def get_user(self, user_id):
        user_sid = hashlib.sha224(user_id).hexdigest()
        return self.g.get_point(user_sid)

    def get_user_data(self, user_id, password=None, autocreate=True):
        user_vertex = self.get_user(user_id)
        if not user_vertex:
            if not autocreate:
                raise Exception('User not found')

            user_vertex = self.init_user(user_id, password)

        if not user_vertex:
            raise Exception('Error retrieving user vertex')

        return user_vertex, user_vertex.get('statedata')

    def load_state_by_id(self, user_sid):
        user_state_data = None
        user_vertex = self.g.get_point(user_sid)

        if user_vertex:
            try:
                user_state_data = user_vertex.get('statedata')
            except:
                pass

        return user_sid, user_state_data, user_vertex

    def get_user_state(self, user_id):
        if not user_id:
            return None, None

        user_vertex = self.get_user(user_id)
        if not user_vertex:
            raise Exception('User vertex not found')

        return user_vertex.get('statedata'), user_vertex

    def get_user_doc_auth(self, user_id):
        doc_id = None
        worksheet_id = None
        email = None
        password = None

        data, vertex = self.get_user_state(user_id)
        if data:
            doc_id = data.get('gdocid')
            worksheet_id = data.get('gdocworksheetid') or 'od6'
            email = data.get('gdocuser')
            password = data.get('gdocpw')

        if not all((doc_id, worksheet_id, email, password)):
            raise Exception('GDoc credentials not available')

        return doc_id, worksheet_id, email, password

    def set_user_doc_auth(self, user_id, gdoc_user, gdoc_pw, doc_id=None, wks_id='od6'):
        user_state, user_vertex = self.get_user_state(user_id)

        if not doc_id:
            # TODO: Create the spreadsheet if it doesn't exist
            pass
        else:
            # TODO Verify the existing spreadsheet has the correct headers
            pass

        user_state.update({
            'gdocuser': gdoc_user,
            'gdocpw': gdoc_pw,
            'gdocid': doc_id,
            'gdocworksheetid': None
        })
        user_vertex.statedata = user_state

    def get_context_by_name(self, root, context_name, multiple=False):
        skeleton = self.get_skeleton(root)

        base_vertexes = []
        for point in skeleton:
            if point.label == context_name:
                base_vertexes.append(point)

                if not multiple:
                    break

        if not base_vertexes:
            raise Exception('Base context not found: %s' % context_name)

        if multiple:
            return base_vertexes
        else:
            return base_vertexes[0]

    def get_user_fito(self, user_id):
        fito_user = None
        fito_password = None

        data, vertex = self.get_user_state(user_id)
        if data:
            fito_user = data.get('fitouser')
            fito_password = data.get('fitopw')

        if not all((fito_user, fito_password)):
            raise Exception('Fitocracy credentials not available')

        return fito_user, fito_password

    def set_user_fito(self, user_id, fito_user, fito_pw):
        user_state, user_vertex = self.get_user_state(user_id)
        user_state.update({
            'fitouser': fito_user,
            'fitopw': fito_pw
        })
        user_vertex.statedata = user_state


if __name__ == '__main__':
    gdb = GraphDB()

    print gdb
