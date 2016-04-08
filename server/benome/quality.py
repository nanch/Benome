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

import sys
import time
import math
import simplejson
import datetime


'''Depth and complexity of data points per day over time'''
def quality(graph, anchor_time=None, segment_length=86400, num_segments=30, points=None):
    window = segment_length * num_segments
    increment = segment_length

    if not anchor_time:
        anchor_time = int(time.time())
    begin = anchor_time - window

    structure = graph.contexts

    context_depths = {}
    def traverse(context, depth=1):
        if not context:
            return

        context_depths[context.get_id()] = depth
        for assoc in context.outAssoc.values():
            if assoc.key == 'down':
                traverse(assoc.dest, depth + 1)

    root_context = graph.get_root()
    traverse(root_context)

    # TODO: Limit to window
    if not points:
        points = graph.get_points()

    segments = {}
    for point in points:
        context_id = point['1__ContextID']
        depth = context_depths.get(context_id, 0)
        if not depth:
            continue

        # All points have at least 3 attributes which count as 1
        detail = len(point.keys()) - 2
        score = depth * detail

        # Calculate bucket index
        try:
            t = float(point['1__Time'])
        except:
            continue

        segment_idx = int(math.ceil((anchor_time - t) / increment))
        if segment_idx not in segments:
            segments[segment_idx] = [0, 0]

        segments[segment_idx][0] += score
        segments[segment_idx][1] += 1

    stream = []
    total_score = 0
    max_score = 0
    # Construct the continuous segment output
    for segment_idx, segment_begin in enumerate(range(anchor_time, begin, -increment)):
        segment_data = segments.get(segment_idx, (0, 0))
        segment_score, num_points = segment_data
        avg = 0
        if num_points:
            avg = float(segment_score) / float(num_points)
        stream.append((segment_begin + (increment / 2), segment_score, num_points, avg))

        # stream.append({
        #     '1__Time': segment_begin + (increment / 2),
        #     'Value': segment_score
        # })
        total_score += segment_score
        max_score = max(max_score, segment_score)

    result = {
        'Points': stream,
        'MaxScore': max_score,
        'AverageScore': total_score // len(stream),
        'NumSegments': num_segments
    }

    return result

def context_viz(graph, anchor_time=None, exclude_points=False, window=None, num_segments=None, adaptive_window=True, max_window=None):
    window_increments = [60, 300, 600, 1800, 3600, 7200, 14400, 43200, 86400, 86400 * 2, 86400 * 7, 86400 * 14, 86400 * 30, 86400 * 61, 86400 * 92, 86400 * 122, 86400 * 365]

    if not anchor_time:
        anchor_time = int(time.time())
    oldest_point = anchor_time

    filtered_contexts = {}
    for context_id, context in graph.contexts.items():
        target_interval = context.get('TargetInterval', None)

        # Filter out contexts without TargetInterval
        if target_interval is None:
            continue

        # Filter out conexts with too few points
        points = graph.get_points()
        if len(points) < 2:
            continue

        # Filter out points newer than the anchor
        points = filter(lambda p: p['1__Time'] <= anchor_time, points)

        if points:
            oldest_point = min(oldest_point, min([p['1__Time'] for p in points]))

        filtered_contexts[context_id] = {
            'Data': context,
            'TargetInterval': target_interval,
            'Points': points
        }

    print filtered_contexts

    if not window or adaptive_window:
        oldest_age = anchor_time - oldest_point
        for incr in window_increments:
            if oldest_age < incr:
                window = incr
                break

    if max_window:
        window = min(max_window, window)

    num_segments = num_segments or 150

    # Now do actual processing
    viz_points = {}
    viz_contexts = {}

    total_score = 0
    max_total_score = 0

    for context_id, context_details in filtered_contexts.items():
        viz_contexts[context_id] = {}

        points = context_details['Points']
        
        #target_interval = context_details['TargetInterval']
        target_interval = None #self.get_target_interval(context_id)

        result = viz_process_feedback(context_id, points, anchor_time, target_interval, window, num_segments)
        viz_points[context_id] = result

        # viz_contexts[context_id].update({
        #     'CurrentScore': result['CurrentScore'],
        #     'RecentInterval_5': result['RecentInterval_5'],
        #     'RecentInterval_10': result['RecentInterval_10'],
        #     'RecentInterval_20': result['RecentInterval_20'],
        #     'CurrentNegScore': result['CurrentNegScore'],
        #     'MaxScore': result['MaxScore'],
        #     'TargetInterval': target_interval
        #     })

    print viz_points

    # Get min and max intervals

    # target_intervals = [x['TargetInterval'] for x in viz_points.values()]

    # min_interval = 0
    # max_interval = 0
    # if target_intervals:
    #     min_interval = min(target_intervals)
    #     max_interval = max(target_intervals)
        
    # interval_range = max_interval - min_interval

    # for context_id, v in viz_points.items():
    #     current_interval = v['CurrentInterval']
    #     if interval_range:
    #         weight = max(0.25, 1 - ((current_interval - min_interval) / interval_range))
    #     else:
    #         weight = 1.0

    #     for p in v['Points']:
    #         p['Value'] *= weight

    #     out_points = []
    #     if not exclude_points:
    #         out_points += v['Points']
            
    #     total_score += v['CurrentScore'] * weight
    #     max_total_score += v['MaxScore'] * weight
        
    #     viz_contexts[context_id].update({
    #         'CurrentInterval': current_interval,
    #         'RecentInterval_5': v['RecentInterval_5'],
    #         'RecentInterval_10': v['RecentInterval_10'],
    #         'RecentInterval_20': v['RecentInterval_20'],
    #         'Points': out_points,
    #         'Weight': weight,
    #         'Label': benome.get_point(context_id).label
    #     })

    return {
        'Contexts': viz_contexts,
        'NumSegments': num_segments,
        'Window': window,
        'CurrentScore': total_score,
        'MaxScore': max_total_score
    }

def viz_process_feedback(context_id, points, anchor_time, target_interval, window, num_segments, decrease_immed=False):
    result = []
    state = {}

    increment = window / num_segments

    max_score = 100
    current_score = 0
    current_interval = 0
    weight = 1

    if target_interval is None or len(points) < 2:
        return {
            'Points': result,
            'NumSegments': num_segments,
            'CurrentScore': current_score,
            'CurrentNegScore': 0,
            'MaxScore': max_score,
            'TargetInterval': target_interval,
            'CurrentInterval': current_interval,
            'RecentInterval_5': 0,
            'RecentInterval_10': 0,
            'RecentInterval_20': 0,
            'Weight': weight
        }

    if not anchor_time:
        anchor_time = int(time.time())
    begin = anchor_time - window

    # The idea is to include the effects of points that occured outside the window
    # Then only the relevant segments are grabbed and returned.

    # Calculate the segment-bucket for each point, then iterate forward in time and set the 
    # segment's value to the computed score if it's higher than what's already there.

    # Oldest first
    points.sort(key=lambda p: p['1__Time'], reverse=False)

    segments = {}
    for point in points:
        # Now cascade the scores.
        # Scores from older points get overridden by scores from newer points.
        segment_idx = int(math.ceil((anchor_time - point['1__Time']) / increment))
        score = 100
        i = 0
        while segment_idx >= 0 and score > 0:
            segment_age = anchor_time - (segment_idx * increment) - point['1__Time']

            if not decrease_immed:
                segment_age -= target_interval

            score = max(0, float(target_interval - segment_age)) / float(target_interval)
            score = int(score * max_score)

            if score > 0:
                if segment_idx not in segments or score >= segments[segment_idx]:
                    segments[segment_idx] = score

            i += 1
            segment_idx -= 1

    # Construct the continuous segment output
    for segment_idx, segment_begin in enumerate(range(anchor_time, begin, -increment)):
        segment_score = segments.get(segment_idx, 0)
        result.append({
            'ContextID': context_id,
            'Time': segment_begin + (increment / 2),
            'Value': min(100, segment_score),
            'NegValue': max(0, segment_score - 100)
        })

    # Calculate the current interval value
    last_point = None
    intervals = []
    for point in points:
        if last_point:
            intervals.append(point['1__Time'] - last_point['1__Time'])
        last_point = point
    current_interval = float(sum(intervals)) / float(len(intervals))


    pts = [p['1__Time'] for p in points[-20:]]

    # Now largest (newest) to smallest (oldest)
    pts.sort(reverse=True)

    intervals = []
    last_time = anchor_time
    for point_time in pts:
        intervals.append(last_time - point_time)
        last_time = point_time
    recent_interval_20 = float(sum(intervals)) / float(len(intervals))

    pts = pts[:10]
    intervals = []
    last_time = anchor_time
    for point_time in pts:
        intervals.append(last_time - point_time)
        last_time = point_time
    recent_interval_10 = float(sum(intervals)) / float(len(intervals))

    pts = pts[:5]
    intervals = []
    last_time = anchor_time
    for point_time in pts:
        intervals.append(last_time - point_time)
        last_time = point_time
    recent_interval_5 = float(sum(intervals)) / float(len(intervals))

    # Set context's target interval
    # if target_interval:
    #     self.set_target_interval(context_id, target_interval)

    #print 'Current score is %d/%d' % (current_score, max_score)
    #print segments_with_points

    return {
        'Points': result,
        'NumSegments': num_segments,
        'CurrentScore': result[0]['Value'],
        'CurrentNegScore': result[0]['NegValue'],
        'MaxScore': max_score,
        'TargetInterval': target_interval,
        'CurrentInterval': current_interval,
        'RecentInterval_5': recent_interval_5,
        'RecentInterval_10': recent_interval_10,
        'RecentInterval_20': recent_interval_20,
        'Weight': weight
    }

class PointsChunker(object):
    def __init__(self, points, begin_time=None):
        self.points = points

        self.last_time = begin_time
        self.begin_time = begin_time
        self.i = 0

    def next_chunk(self, size):
        if not self.points:
            return []

        if not self.last_time:
            self.last_time = self.points[0]['1__Time']
            self.begin_time = self.last_time
        end_time = self.last_time + size
        self.last_time = end_time

        result = []
        while self.i < len(self.points):
            point = self.points[self.i]
            t = point['1__Time']

            if t > end_time:

                break
            else:
                result.append(point)

            self.i += 1

        return result


class Bucket(object):
    def __init__(self, points, begin_time):
        self.points = points
        self.begin_time = begin_time

    def merge_new(self, new_points, interval):
        # Compute which of those points are new
        current_contexts = set([p['1__ContextID'] for p in self.points])
        new_contexts = set([p['1__ContextID'] for p in new_points])
        additions = new_contexts.difference(current_contexts)

        # Add the points to the bucket
        self.points += new_points
        self.begin_time += interval

        # Trim the bucket to the window
        self.points = filter(lambda x: x['1__Time'] >= self.begin_time, self.points)

        return tuple(additions)

    def num_points(self):
        return len(self.points)

    def num_unique_points(self):
        return len(set([p['1__ContextID'] for p in self.points]))

def point_variance(graph, anchor_time, window, rolling_window, segment_size):
    end_time = anchor_time - window
    far_end_time = end_time - rolling_window

    # Start the window off the far end
    points = graph.get_points(anchor_time=anchor_time, end_time=far_end_time)
    num_segments = window / segment_size
    if not points:
        return [0] * num_segments

    # Oldest to newest
    points.sort(key=lambda p: p['1__Time'], reverse=False)

    pc = PointsChunker(points, far_end_time)

    # Fill the bucket by grabbing a rolling_window-sized chunk from the end
    bucket = Bucket(pc.next_chunk(rolling_window), far_end_time)

    i = 0
    chunks_with_points = 0
    total_diff = 0
    num_nodiff = 0
    num_nopoints = 0
    result = []

    while i < num_segments:
        # Grab the points for the next segment
        chunk = pc.next_chunk(segment_size)
        if chunk:
            chunks_with_points += 1
        else:
            num_nopoints += 1

        bucket_size = bucket.num_unique_points()
        diff = bucket.merge_new(chunk, segment_size)
        num_diff = len(diff)
        if chunk and num_diff == 0:
            num_nodiff += 1
        #print len(chunk), num_diff, len(bucket.points), bucket_size

        # Update result
        total_diff += num_diff

        if not chunk:
            perc = 0
        else:
            perc = 0.0
            if bucket_size > 0:
                perc = min(100, (num_diff / float(bucket_size)) * 100)
        #print '%02d %.1f%%' % (i, perc)
        result.append(perc)
        i += 1

    # Newest to oldest
    result.reverse()

    # avg = 0
    # if chunks_with_points > 0:
    #     avg = sum(result) / float(chunks_with_points)

    #print avg, num_nodiff, num_nopoints, num_segments
    return result

'''Output a histogram of the creation times for each sub-context of each context
The idea was to see the rough pattern, with the theory that there'd be a per-context exponential decay.
Might be better off looking at the interval spread between new contexts
'''
def context_pattern(graph):
    import matplotlib.pyplot as plt
    context_ids = graph.contexts.keys()

    # Single x-axis
    context_times = [int(c.get('Timestamp')) for c in graph.contexts.values()]
    left = min(context_times)
    right = max(context_times)
    xbins = range(left, right, 86400)

    for context_id in context_ids:
        context_name = graph.contexts[context_id].label
        if not context_name.strip():
            context_name = 'Root'

        #if context_name not in ('Apps', 'Canned'): #('Root', 'Activities', 'Work', 'Personal', 'Household Chores', 'Food'):
        #    continue

        g = graph.prune_to_root(context_id)
        num_contexts = len(g.contexts.keys())
        if num_contexts <= 3:
            continue
        
        context_times = [int(c.get('Timestamp')) for c in g.contexts.values()]
        context_times.append(left)
        context_times.append(right)
        plt.clf()
        plt.hist(context_times, bins=xbins, range=(left, right))

        filename = '%s-%s.png' % (context_id, context_name)
        plt.savefig(filename)

        print 'Wrote %s' % filename

# minimum 1
def mean(data):
    return sum(data) / float(len(data))

def _ss(data):
    c = mean(data)
    return sum((x - c) ** 2 for x in data)

# minimum 2
def pstdev(data):
    return (_ss(data) / len(data)) ** 0.5

def get_intervals(pts, anchor_time):
    # pts sorted high to low
    intervals = []
    last_time = anchor_time

    for point_time in pts:
        intervals.append(last_time - point_time)
        last_time = point_time

    return intervals

def calc_target_interval(points, anchor_time):
    intervals = get_intervals(points[0:20], anchor_time)

    # Filter out intervals over 1 stdev from the mean
    avg = mean(intervals)
    stdev = int(pstdev(intervals))
    filtered_intervals = filter(lambda x: x < avg + stdev, intervals)
    avg_interval = sum(filtered_intervals) / len(filtered_intervals)
    return avg_interval

def frequency_decay(points, target_interval, anchor_time, window, num_segments, decrease_immed=False):
    increment = window / float(num_segments)
    max_score = 100
    segments = [0] * num_segments

    for point_time in points:
        # Now cascade the scores.
        # Scores from older points get overridden by scores from newer points.
        segment_idx = int(math.ceil((anchor_time - point_time) / increment))
        if segment_idx >= num_segments:
            print 'SegmentIdx too large: %s' % segment_idx
            continue

        score = max_score
        while segment_idx >= 0 and score > 0:
            segment_age = anchor_time - (segment_idx * increment) - point_time

            if not decrease_immed:
                segment_age -= target_interval

            score = max(0, float(target_interval - segment_age)) / float(target_interval)
            score = min(max_score, int(score * max_score))

            if score > 0 and score >= segments[segment_idx]:
                segments[segment_idx] = score

            segment_idx -= 1

    return segments

def frequency(graph, anchor_time, window, num_segments, decrease_immed=False):
    points = [int(float(p['1__Time'])) for p in graph.get_points(anchor_time, anchor_time - window)]
    if len(points) <= 1:
        return None

    # Sort newest to oldest
    points.sort(reverse=True)
    target_interval = calc_target_interval(points, anchor_time)

    # Sort oldest to newest
    points.sort(reverse=False)
    segments = frequency_decay(points, target_interval, anchor_time, window, num_segments, decrease_immed=decrease_immed)

    return {
        'Data': segments,
        'TargetInterval': target_interval
    }

def all_frequencies(graph, anchor_time, window, num_segments):
    leaf_contexts = graph.get_leaves()
    result = {}
    for context in leaf_contexts:
        context_id = context.get_id()
        g2 = graph.prune_to_root(context_id)
        context_result = frequency(g2, anchor_time, window, num_segments)
        if context_result:
            result[context_id] = context_result

    return result

def all_quality(graph, anchor_time, num_segments):
    interior_contexts = graph.get_interior()
    result = {}

    points = graph.get_points()
    for context in interior_contexts:
        context_id = context.get_id()
        g2 = graph.prune_to_root(context_id)

        quality_result = quality(g2, anchor_time=anchor_time, num_segments=num_segments, points=points)

        context_result = {
            'Data': None,
            'Target': None
        }

        max_val = max(1, quality_result['MaxScore'])
        p = [int(round((p[1] / float(max_val)) * 100)) for p in quality_result['Points']]
        context_result['Data'] = p
        result[context_id] = context_result

    return result

def all_variance(graph, anchor_time, window, rolling_window, segment_size):
    import random
    
    def target_transform(target, values):
        if not target:
            target = 1

        result = []
        for val in values:
            v = 0
            if type(val) is int:
                v = 0 #random.randint(20, 30)
            else:
                v = round((min(target, val) / target) * 100)

            result.append(v)
        return result

    interior_contexts = graph.get_interior()
    result = {}
    i = 1
    for context in interior_contexts:
        context_id = context.get_id()
        g2 = graph.prune_to_root(context_id)
        context_result = point_variance(g2, anchor_time, window, rolling_window, segment_size)

        target = None
        if any(context_result):
            tmp_result = filter(lambda x: x > 0, context_result)
            avg = mean(tmp_result)
            stdev = pstdev(tmp_result)
            filtered_outliers = filter(lambda x: x <= avg + stdev, context_result)
            target = mean(filtered_outliers)
            context_result = target_transform(target, context_result)

        result[context_id] = {
            'Data': context_result,
            'Target': target
        }

    return result

if __name__ == '__main__':
    root_context_id = int(sys.argv[1])
    db_path = sys.argv[2]
    num_segments = int(sys.argv[3])

    w = 5

    from sql_db import Graph
    g = Graph(root_context_id=1004, db_path=db_path)

    # Load the full structure
    user_id = 1
    attr_namespaces = map(str, [1])
    g.load(user_id, attr_namespaces)

    if w == 1:
        result = quality(g, num_segments=num_segments)
        for ts, score, num_points, avg in result['Points']:
            #date_format = '%A, %b %d' # 
            date_format = '%Y-%m-%d %H:%M:%S'
            print datetime.datetime.fromtimestamp(ts).strftime(date_format), score # num_points # round(avg) #, score #, num_points
        print 'Max: %s' % result['MaxScore']
    elif w == 2:
        result = context_viz(g, num_segments=num_segments)
        print result

    elif w == 3:
        anchor_time = time.time()
        window = 86400 * 60
        segment_size = 86400
        rolling_window = segment_size * 7

        g = g.prune_to_root(root_context_id)
        print point_variance(g, anchor_time, window, rolling_window, segment_size)

    elif w == 4:
        context_pattern(g)
    
    elif w == 5:
        anchor_time = int(time.time()) - (86400 * 68) - 30000
        window = 86400 * 30
        num_segments = 30

        result = all_frequencies(g, anchor_time, window, num_segments)
        with open('frequency.json', 'w') as f:
            f.write(simplejson.dumps(result, indent=2))

    # TODO
    #   - separate factors: quantity, depth, attributes (duration, text)
    #   