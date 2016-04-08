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
import datetime
import math
import simplejson
import pytz
from copy import deepcopy

from container_exec import CommandNotFound

tz = pytz.timezone('GMT')

class DataExec(object):
    def __init__(self, CE):
        self.CE = CE
        self.data = self.CE.data
        self.methods = DataMethods(self)

        self.cmd_map = {
            'get-root-context-id': self.methods.get_root_context_id,
            'get-id-block': self.methods.get_id_block,
            'get-last-id': self.methods.get_last_id,

            'get-contexts': self.methods.get_contexts,
            'add-context': self.methods.add_context,
            'update-context': self.methods.update_context,
            'delete-context': self.methods.delete_context,

            'get-points': self.methods.get_points,
            'get-point': self.methods.get_point,
            'add-point': self.methods.add_point,
            'update-point': self.methods.update_point,
            'delete-point': self.methods.delete_point,

            'get-associations': self.methods.get_associations,
            'add-association': self.methods.add_association,
            'update-association': self.methods.update_association,
            'delete-association': self.methods.delete_association,

            'get-report': self.methods.get_report,
            'data-query': self.methods.data_query
        }

    def exec_cmd(self, cmd, args, kwargs):
        func = self.cmd_map.get(cmd)
        if func:
            return func(*args, **kwargs)
        else:
            raise CommandNotFound #(cmd)

    def get_root_context_id(self):
        return self.data.root_context_id


class DataMethods(object):
    def __init__(self, ext):
        self.ext = ext

    def get_root_context_id(self):
        if self.ext:
            return self.ext.get_root_context_id()

    def get_id_block(self, block_size):
        return self.ext.data.get_id_block(block_size)

    def get_last_id(self):
        return self.ext.data.get_last_id()

    def format_context(self, context, include_assoc=False):
        attributes = {
            'ID': context.get_id(),
            '1__Label': context.label
        }

        def set_attr(attr_name, attr_val, namespace_id=None):
            if namespace_id:
                key = '%d__%s' % (namespace_id, attr_name)
            else:
                key = attr_name

            attributes[key] = attr_val

        for namespace_id, namespace_attrs in context.attributes.items():
            for attr_name, attr_val in namespace_attrs.items():
                set_attr(attr_name, attr_val, namespace_id)

        if include_assoc:
            attributes['UpAssoc'] = context.outV('up', ids_only=True)
            attributes['DownAssoc'] = context.outV('down', ids_only=True)
            
            # TODO: Also all other associations, grouped by namespace

        attributes.update({
            'MetaData': context.metadata,
            'Properties': {}
        })

        return attributes

    def get_contexts(self, root_context_id, anchor_time=None, interval=None):
        if not anchor_time:
            anchor_time = int(time.time())

        if interval is None:
            interval = (86400 * 7 * 4)

        end_time = anchor_time - interval

        points = self.get_points(root_context_id, anchor_time=anchor_time, interval=interval)
        # Grouped by context
        context_points = {}
        for point in points:
            context_id = point['1__ContextID']
            if context_id not in context_points:
                context_points[context_id] = []
            context_points[context_id].append(point)

        # Sort each context
        for context_id, points in context_points.items():
            context_points[context_id] = sorted(points, key=lambda p: p['1__Time'], reverse=False)

        # Calculate the context scores
        result = []
        contexts = self.ext.data.contexts
        self.interior_aggregate(root_context_id, contexts)
        for context_id, context in contexts.items():
            score_details = {}
            if context.is_leaf() and context_id in context_points:
                score_details = self.calc_context_score(context_id, points=context_points[context_id], anchor_time=anchor_time)
            context.set_metadata(score_details)

            result.append(self.format_context(context))

        return result

    def interior_aggregate(self, current_context_id, contexts):
        context = contexts.get(current_context_id)
        if not context:
            return None

        child_ids = context.outV('down', ids_only=True)
        if not child_ids:
            return context.metadata.get('CurrentScore', None)

        total_score = 0
        num_scores = 0
        for child_id in child_ids:
            child_score = self.interior_aggregate(child_id, contexts)
            if child_score is None:
                continue

            total_score += child_score
            num_scores += 1

        current_score = 0
        if num_scores > 0:
            current_score = total_score / num_scores

        context.metadata['CurrentScore'] = current_score

        return current_score

    def calc_context_score(self, context_id, points=None, anchor_time=None, include_adjustment=True):
        data = self.ext.data

        if not anchor_time:
            anchor_time = int(time.time())

        def calc_avg_interval(pts, anchor_time):
            # pts sorted high to low
            intervals = []
            last_time = anchor_time
            for point_time in pts:
                intervals.append(last_time - point_time)
                last_time = point_time

            return float(sum(intervals)) / float(len(intervals))

        filtered_points = []
        time_since = None
        time_since_adjusted = None
        score = None
        recent_interval_5 = None
        recent_interval_10 = None

        if not points:
            interval = (86400 * 30)
            points = self.get_points(context_id, anchor_time=anchor_time, interval=interval)

        context = data.get_context(context_id)
        adjust_delta = float(context.get('AdjustDelta', 0) or 0)
        target_interval = float(context.get('TargetFrequency', 0) or 0)

        # Simplify structure
        for p in points:
            point_time = p['1__Time']

            # Remove points ahead of the anchor time (in case it is in the past)
            if not point_time or point_time > anchor_time:
               continue

            filtered_points.append({
                'PointID': p['ID'],
                'Time': point_time
            })

        pts = [p['Time'] for p in filtered_points]
        # Now largest (newest) to smallest (oldest)
        pts.sort(reverse=True)
        pts = pts[:10]

        if pts:
            time_since = anchor_time - pts[0]

        if len(pts) > 1:
            recent_interval_5 = calc_avg_interval(pts[:5], anchor_time)
            recent_interval_10 = calc_avg_interval(pts[:10], anchor_time)

            # Linear proportion between time since last action and recent average interval
            # Clamped to between 0.0 and 1.0 for now to keep it simple
            # 0 = just done
            # 0.5 = do soon
            # 1.0 = way overdue

            if target_interval:
                score_interval = target_interval
            else:
                score_interval = recent_interval_5

            time_since_adjusted = time_since
            if include_adjustment:
                time_since_adjusted += adjust_delta

            score = max(0, min(1.0, 0.5 * (time_since_adjusted / score_interval)))
        
        return {
            'TimeSince': time_since,
            'TimeSinceAdjusted': time_since_adjusted,
            'CurrentScore': score,
            'TargetInterval': target_interval,
            'RecentInterval_5': recent_interval_5,
            'RecentInterval_10': recent_interval_10,
            'Weight': 1.0,
        }

    def delete_context(self, context_id):
        data = self.ext.data
        return data.delete_context(context_id)

    def add_context(self, parent_id=None, label=None, new_context_id=None, timestamp=None, attributes=None, edges=None):
        data = self.ext.data
        parent_id = int(parent_id)

        parent_context = None
        if parent_id:
            parent_context = data.get_context(parent_id)

            if not parent_context:
                raise Exception('Parent context not found: %s' % parent_id)
        
        if new_context_id:
            new_context_id = int(new_context_id)

        namespaced_attrs = self.attrs_to_namespaced(attributes)

        try:
            context_id = data.add_context(parent_id, label=label, context_id=new_context_id, attributes=namespaced_attrs)

            # if edges and type(edges) in (tuple, list):
            #     for edge_def in edges:
            #         if type(edge_def) not in (tuple, list) or len(edge_def) != 3:
            #             continue

            #         direction, other_sid, edge_name = edge_def

            #         if not edge_name or type(edge_name) not in (str, unicode):
            #             continue

            #         if direction in ('To', 'to', 't'):
            #             benome.g.add_edge(new_context_sid, edge_name, other_sid)
            #         elif direction in ('From', 'from', 'f'):
            #             benome.g.add_edge(other_sid, edge_name, new_context_sid)

        except Exception, e:
            import traceback; traceback.print_exc()
            print 'create_context error: %s' % e
            return False, None
        else:
            return True, self.format_context(data.get_context(context_id))

    def update_context(self, context_id, attributes):
        assert type(context_id) is int

        data = self.ext.data
        context = data.get_context(context_id)

        if not context:
            raise Exception('Context %s not found when updating: %s' % (context_id, attributes))

        print 'Updating existing context %s: %s' % (context_id, attributes)

        filtered_attributes = {}
        for key, value in attributes.items():
            if type(value) in (list, dict):
                continue

            if key in ('recordType', 'ID', 'Properties', 'attributes'):
                continue

            if key == 'adjustDir':
                adjust_dir = value
                if str(adjust_dir) in ('forward', 'back'):
                    value = self.calc_context_adjust(context_id, str(adjust_dir))
                    filtered_attributes['AdjustDelta'] = value
            else:
                filtered_attributes[key] = value

        namespaced_attrs = self.attrs_to_namespaced(filtered_attributes)
        data.update_context(context_id, namespaced_attrs)
        return True, self.format_context(data.get_context(context_id))

    def calc_context_adjust(self, context_id, adjust_dir):
        data = self.ext.data
        context = data.get_context(context_id)

        # Get recent interval average and time since last point
        score_details = self.calc_context_score(context_id)
        
        recent_interval = score_details['RecentInterval_5']
        time_since = score_details['TimeSince']
        time_since_adjusted = score_details['TimeSinceAdjusted']

        current_delta = float(context.get('AdjustDelta', 0) or 0)

        if recent_interval is None or time_since is None:
            return current_delta

        # Compute an adjustment
        if adjust_dir == 'forward':
            # Bringing forward means effectively pushing the last action back in time
            adjust_delta = current_delta + (recent_interval * 0.66)

            #print current_delta, recent_interval, adjust_delta
            
            # # Double the interval means a score of 1.0
            # if current_delta >= recent_interval:
            #     adjust_delta += recent_interval_5
        else:
            # Pushing back means effectively pulling forward the last action
            adjust_delta = current_delta - (time_since_adjusted * 0.66)

        return adjust_delta

    def get_associations(self, root_context_id):
        associations = []
        contexts = self.ext.data.contexts

        # Get structure
        for context_id, context in contexts.items():
            downAssoc = context.outV('down', ids_only=True)
            for dest_id in downAssoc:
                associations.append({
                    'ID': '%s|down|%s' % (context_id, dest_id),
                    'Name': 'down',
                    'SourceID': context_id,
                    'DestID': dest_id
                    })

            upAssoc = context.outV('up', ids_only=True)
            if len(upAssoc) > 1:
                print 'Context has more than one parent: %s - %s' % (context_id, context)
                continue

            for dest_id in upAssoc:
                associations.append({
                    'ID': '%s|up|%s' % (context_id, dest_id),
                    'Name': 'up',
                    'SourceID': context_id,
                    'DestID': dest_id
                    })

        return associations

    def add_association(self, assoc_name, source_context_id, dest_context_id):
        data = self.ext.data
        data.add_assoc(source_context_id, assoc_name, dest_context_id)

        return {
            'ID': '%s|%s|%s' % (source_context_id, assoc_name, dest_context_id),
            'Name': assoc_name,
            'SourceID': source_context_id,
            'DestID': dest_context_id
        }

    def update_association(self, assoc_name, source_context_id, dest_context_id):
        return self.add_association(assoc_name, source_context_id, dest_context_id)

    def delete_association(self, assoc_id):
        src_id, assoc_name, dest_id = assoc_id.split('|')
        
        src_id = int(src_id)
        dest_id = int(dest_id)
        data = self.ext.data

        src_context = data.get_context(src_id)
        if not src_context:
            print 'Src %s not found' % src_id
            return

        dest_context = data.get_context(dest_id)
        if not dest_context:
            print 'Dest %s not found' % dest_id
            return

        src_context_id = src_context.get_id()
        dest_context_id = dest_context.get_id()

        try:        
            data.remove_assoc(src_context_id, dest_context_id, assoc_name)
        except:
            print 'Edge not found: %s' % assoc_id

        return True

    def get_points(self, root_context_id, anchor_time=None, interval=None):
        if not anchor_time:
            anchor_time = int(time.time())

        if interval is None:
            interval = (86400 * 30)

        end_time = anchor_time - interval

        points = self.ext.data.get_points(anchor_time=anchor_time, end_time=end_time, user_id=1)
        return [self.format_point(p) for p in points]

    def get_point(self, point_id):
        data = self.ext.data
        point = data.get_point(point_id)

        if point:
            return self.format_point(point)
        return None

    def delete_point(self, point_id):
        data = self.ext.data
        return data.delete_point(point_id)

    def add_point(self, point_data, point_id=None):
        data = self.ext.data

        parent_id = int(point_data.get('1__ContextID'))
        #create_parent = point_data.get('CreateContext')

        if point_id:
            existing_node = data.get_point(point_id)
            if existing_node:
                raise Exception('Node with ID %s already exists' % point_id)

        if not parent_id and not create_parent:
            raise Exception('Missing parent ID')

        #if create_parent and not parent_id:
        #    success, parent_id = self.create_context()

        for attr_name in ('ID', '1__ContextID', '1__TimeOffset'):
            if attr_name in point_data:
                del point_data[attr_name]

        parent_node = None
        success = False
        result = None

        try:
            parent_node = data.get_context(parent_id)
            if not parent_node:
                raise Exception('Parent not does not exist: %s' % parent_id)

        except Exception, e:
            print '[add_point error]: %s' % e
            raise
        else:
            point_id = self.insert_point(parent_node.get_id(), point_data, point_id=point_id)
            success = True
            result = self.format_point(data.get_point(point_id))

        return success, result

    def attrs_to_namespaced(self, attrs):
        namespaced_attrs = {}

        if attrs:
            for key, attr_val in attrs.items():
                namespace_id = None
                try:
                    namespace_id_str, attr_name = key.split('__')
                except ValueError:
                    attr_name = key
                    namespace_id = 1
                else:
                    namespace_id = int(namespace_id_str)

                if namespace_id not in namespaced_attrs:
                    namespaced_attrs[namespace_id] = {}

                if attr_name in ('Timestamp',):
                    attr_val = int(attr_val)

                if namespace_id == 1 and attr_name in ('Properties', 'MetaData'):
                    continue

                namespaced_attrs[namespace_id][attr_name] = attr_val

        return namespaced_attrs

    def insert_point(self, parent_id, point_data, point_id=None):
        data = self.ext.data

        parent_id = int(parent_id)
        if point_id:
            point_id = int(point_id)

        namespaced_attrs = self.attrs_to_namespaced(point_data)

        begin_time = namespaced_attrs[1]['Time']
        if not begin_time:
            begin_time = time.time()

        end_time = begin_time
        duration = namespaced_attrs[1].get('Duration') or 0
        if duration:
            end_time = begin_time + duration

        namespaced_attrs[1]['EndTime'] = int(end_time)
        namespaced_attrs[1]['Duration'] = int(duration)

        # Create the activity node
        point_id = data.add_point(parent_id, point_id=point_id, attributes=namespaced_attrs)
        return point_id

    def format_point(self, point):
        formatted_point = {}

        def set_attr(attr_name, attr_val, namespace_id=None):
            if namespace_id:
                key = '%d__%s' % (namespace_id, attr_name)
            else:
                key = attr_name

            formatted_point[key] = attr_val

        def to_int(val):
            try:
                val = int(float(val))
            except Exception as e:
                print e, val, type(val)

            return val

        for key, attr_val in point.items():
            if key in ('ID', ):
                formatted_point['ID'] = attr_val
                continue

            namespace_id, attr_name = key.split('__')
            namespace_id = int(namespace_id)

            if attr_name in ('ID', 'ContextID', 'Time', 'Duration', 'EndTime', 'TimeOffset'):
                attr_val = to_int(attr_val)

            set_attr(attr_name, attr_val, namespace_id=namespace_id)

        return formatted_point

    def update_point(self, point_id, attributes, create=False):
        data = self.ext.data

        try:
            del attributes['ID']
        except:
            pass

        point = data.get_point(point_id)
        if not point or not attributes:
            if not create:
                print 'Point %s doesn\'t exist, can\'t update it' % point_id
            else:
                print 'Creating new point: %s, %s' % (point_id, attributes)
                success, point = self.add_point(attributes, point_id=point_id)
                return point

        print 'Updating existing point %s: %s' % (point_id, attributes)

        namespaced_attrs = self.attrs_to_namespaced(attributes)
        context_id = int(namespaced_attrs[1].get('ContextID'))
        try:
            del namespaced_attrs[1]['ContextID']
        except:
            pass

        if context_id:
            tmp_point = self.format_point(point)
            if tmp_point and tmp_point['1__ContextID'] != context_id:
                print 'Can\'t update point %s, passed contextID %s doesn\'t match existing contextID %s' % (point_id, context_id, tmp_point['ContextID'])
                return None

        timestamp = namespaced_attrs[1].get('Time')
        try:
            del namespaced_attrs[1]['Time']
        except:
            pass

        if timestamp:
            new_begin_time = int(float(timestamp))
            end_time = new_begin_time

            duration = namespaced_attrs[1].get('Duration', point.get('Duration', 0))
            if duration:
                duration = int(float(duration))
                end_time = new_begin_time + duration

            namespaced_attrs[1]['Time'] = int(new_begin_time)
            namespaced_attrs[1]['EndTime'] = int(end_time)
            namespaced_attrs[1]['Duration'] = int(duration)

        data.update_point(point_id, namespaced_attrs)
        return self.format_point(data.get_point(point_id))

    def data_query(self):
        data = self.ext.data

        anchor_time = int(time.time())
        big_result = {}
        num_segments = 30 # days

        if 1:
            from benome.quality import all_frequencies
            window = 86400 * num_segments

            t = time.time()
            result = all_frequencies(data, anchor_time, window, num_segments)

            for context_id, context_result in result.items():
                if context_id not in big_result:
                    big_result[context_id] = {}
                big_result[context_id]['Frequency'] = context_result
            print 'Frequency', time.time() - t

        if 1:
            from benome.quality import all_quality

            t = time.time()
            result = all_quality(data, anchor_time, num_segments)

            for context_id, context_result in result.items():
                if context_id not in big_result:
                    big_result[context_id] = {}
                big_result[context_id]['Quality'] = context_result
            print 'Quality', time.time() - t

        if 1:
            from benome.quality import all_variance
            window = 86400 * num_segments
            segment_size = 86400 * 1
            rolling_window = 86400 * 5

            t = time.time()
            result = all_variance(data, anchor_time, window, rolling_window, segment_size)

            for context_id, context_result in result.items():
                if context_id not in big_result:
                    big_result[context_id] = {}
                big_result[context_id]['Variance'] = context_result
            print 'Variance', time.time() - t

        return big_result

    def get_report(self, context_id, interval, day=None, month=None, year=None, begin_date=None,
                        max_depth=None, leaf_notes=True, leaf_note_timing=False, public=False):
        data = self.ext.data

        from report import get_report as get_report_ext
        report = get_report_ext(data, context_id, interval, day=day, month=month, year=year, 
                    begin_date=begin_date, max_depth=max_depth, leaf_notes=leaf_notes,
                    leaf_note_timing=leaf_note_timing, public=public)

        return report
