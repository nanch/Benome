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
import pytz

tz = pytz.timezone('GMT')

def generate_days(range_type, day=None, month=None, year=None, begin_date=None):
    from datetime import date, datetime
    import time

    today = date.today()
    if day is None:
        day = today.day # today
    else:
        day = int(day)

    if month is None:
        month = today.month # current month
    else:
        month = int(month)

    if year is None:
        year = today.year # current year
    else:
        year = int(year)

    if begin_date:
        begin_date = (datetime(begin_date[0], begin_date[1], begin_date[2], 0, 0) - datetime(1970,1,1)).total_seconds()
        begin_date += time.timezone

    # Now construct a timestamp
    t = (datetime(year, month, day, 0, 0) - datetime(1970,1,1)).total_seconds()
    t += time.timezone

    if range_type == 'day':
        day = get_epoch_day(t, begin_date=begin_date)
        days = [day]
    elif range_type == 'week':
        # Shift so Friday is last day of the week
        days = get_epoch_week(t, shift=2, begin_date=begin_date)
    elif range_type == 'month':
        days = get_epoch_month(t, begin_date=begin_date)

    print days

    return days

def get_epoch_day(begin_time=None, begin_date=None):
    from datetime import date, datetime

    if not begin_time:
        begin_time = time.time()
    else:
        begin_time = float(begin_time)

    local_epoch = datetime.utcfromtimestamp(0)
    local_begin = datetime.fromtimestamp(begin_time)

    delta = local_begin - local_epoch
    day = delta.days

    return day

def get_epoch_week(begin_time=None, shift=0, begin_date=None):
    from datetime import date

    if not begin_time:
        begin_time = time.time()

    # Normally, Monday is 0, Sunday is 6
    weekday = date.fromtimestamp(begin_time).weekday() + shift
    if weekday > 6:
        weekday -= 6

    epoch_day = get_epoch_day(begin_time)
    week_begin = epoch_day - weekday
    week_end = week_begin + 7

    begin_epoch_day = None
    if begin_date:
        begin_epoch_day = get_epoch_day(begin_date)

    epoch_week = []
    for i in range(week_begin, week_end):
        if begin_epoch_day and i < begin_epoch_day:
            continue
        epoch_week.append(i)

    return epoch_week

def get_epoch_month(begin_time=None, begin_date=None):
    from calendar import monthrange
    from datetime import date

    if not begin_time:
        begin_time = time.time()

    d = date.fromtimestamp(begin_time)
    epoch_day = get_epoch_day(begin_time)

    month_length = monthrange(d.year, d.month)[1]
    month_begin = epoch_day - (d.day - 1)
    epoch_month = range(month_begin, month_begin + month_length)
    return epoch_month

def gen_idx(g, period, num_periods, begin_time=None):
    if not begin_time:
        begin_time = time.time()
    end_time = begin_time - (period * num_periods)

    period_idx = {}
    points = g.get_points(anchor_time=begin_time, end_time=end_time)

    begin_epoch_day = get_epoch_day(begin_time)

    for point in points:
        ts = float(point['1__Time'])
        period_num = begin_epoch_day - int(math.floor((begin_time - ts) / period))

        if period_num not in period_idx:
            period_idx[period_num] = []

        common_details = {
            'BeginTime': point['1__Time'],
            'EndTime': point.get('1__EndTime', None),
            'Duration': int(float(point.get('1__Duration', 0))),
            'Text': point.get('1__Text', '')
        }

        period_idx[period_num].append({
            'ContextID': point['1__ContextID'],
            'CommonDetails': common_details
        })

    return period_idx

def create_structure(period_num, period_idx):
    structure = {}
    if period_num in period_idx:
        for point in period_idx[period_num]:
            context_id = point['ContextID']
            if context_id not in structure:
                structure[context_id] = []

            structure[context_id].append(point)

    return structure

def compute_day_results(point_idx, epoch_day, context, structure, level=0):
    context_id = context.get_id()
    context_details = {
        'Context': context,
        'ContextID': context_id,
        'TotalTime': 0,
        'SelfTotalTime': 0,
        'ChildTotalTime': 0,
        'ProportionalTime': 0.0,
        'RecordNotes': None,
        'Children': []
    }

    # Get all records for current context
    self_total = 0
    for child_rec in structure.get(context_id, []):
        self_total += child_rec['CommonDetails']['Duration']
    context_details['SelfTotalTime'] = self_total

    child_total = 0
    down_vertexes = context.outV('down')
    if down_vertexes:
        for child_vertex in down_vertexes:
            child_details = compute_day_results(point_idx, epoch_day, child_vertex, structure, level=level+1)
            context_details['Children'] += child_details
            child_total += sum([child_detail['TotalTime'] for child_detail in child_details])

    # Data points
    day_points = point_idx.get(epoch_day, [])
    record_notes = []

    for point in day_points:
        timestamp = point['CommonDetails'].get('BeginTime')
        if not timestamp:
            continue

        if point.get('ContextID') != context_id:
            continue

        description = point['CommonDetails'].get('Text', None)
        duration = point['CommonDetails'].get('Duration', 0)

        if description:
            record_notes.append((duration, map(str.strip, str(description.strip()).split('\n'))))

    context_details['ChildTotalTime'] = child_total
    context_details['TotalTime'] = child_total + self_total
    context_details['RecordNotes'] = record_notes

    if level == 0:
        return context_details
    else:
        return [context_details]

def format_time(interval, time_unit):
    if time_unit == 'hours':
        result_interval = '%.2f' % (interval / 3600.0)
        unit = 'h'
    elif time_unit == 'minutes':
        result_interval = '%.2f' % (interval / 60.0)
        unit = 'm'
    else:
        result_interval = '%.0f' % interval
        unit = 's'

    return result_interval, unit

def generate_report(context_details, print_empty=False, level=0, display_root=True, max_depth=None, time_unit='seconds', time_formatted=False, leaf_notes=False, leaf_note_timing=True):
    result = []

    indent = ''
    if not display_root:
        if level > 0:
            indent = ' ' * 4 * (level - 1)
        elif max_depth is not None:
            max_depth += 1
    else:
        indent = ' ' * 4 * level

    if level == max_depth:
        return result

    total_time = context_details['TotalTime']
    if (total_time or print_empty) and not (level == 0 and not display_root):
        interval, unit = format_time(total_time, time_unit)
        line = '%s%s%s - %s' % (indent, interval, unit, context_details['Context'].label)
        result.append(line)

        if max_depth is None:
            not_limited = True
        else:
            not_limited = level < max_depth - 1

        if leaf_notes and not_limited:
            self_time = context_details['SelfTotalTime']
            notes = context_details.get('RecordNotes', [])
            note_indent = indent + (4 * ' ')

            pwr = 0.75

            for duration, note_lines in notes:
                length_total = sum(map(lambda x: math.pow(x, pwr), map(len, note_lines)))

                for line in note_lines:
                    dash = ''
                    if line[0] != '-':
                        dash = '- '

                    if leaf_note_timing:
                        line_length = math.pow(len(line), pwr)
                        line_time = duration * (line_length / length_total)
                        interval, unit = format_time(line_time, time_unit)
                        line = '%s%s%s %s%s' % (note_indent, interval, unit, dash, line)
                    else:
                        line = '%s %s%s' % (note_indent, dash, line)

                    result.append(line)

    # TODO: Sort children by timestamp
    for child_context_details in context_details['Children']:
        result += generate_report(child_context_details, print_empty, 
                        level=level+1, display_root=display_root, max_depth=max_depth, 
                        time_unit=time_unit, leaf_notes=leaf_notes, leaf_note_timing=leaf_note_timing)

    return result

def construct_report(report_data, days, context_name='Activity', public=False, days_desc=False):
    report_days, total_time = report_data

    if days_desc:
        report_days.reverse()

    total_hours = total_time / 3600.0

    report = '%s\n' % context_name
    report += ('=' * len(report)) + '\n\n'

    if len(days) > 1:
        day_range = '%s to %s' % (format_epoch_day(min(days)), format_epoch_day(max(days)))
        report += day_range
    else:
        report += format_epoch_day(min(days))
    report += '\n\n'

    report += 'Total time: %.2f\n' % total_hours
    report += '\n'

    report += '\n\n'.join(report_days) + '\n\n'
    return report

def generate_report_days(root, period_idx, days, max_depth, leaf_notes, leaf_note_timing):
    report_days = []
    total_time = 0.0

    for i, epoch_day in enumerate(days):
        structure = create_structure(epoch_day, period_idx)
        r = compute_day_results(period_idx, epoch_day, root, structure)
        total_time += r['TotalTime']

        lines = generate_report(r, print_empty=False, display_root=False, max_depth=max_depth, time_unit='hours', leaf_notes=leaf_notes, leaf_note_timing=leaf_note_timing)
        if lines:
            day_section = ''
            if len(days) > 1:
                day_section += format_epoch_weekday(epoch_day) + '\n'
                day_section += ('-' * len(day_section)) + '\n'

            day_section += '\n'.join(lines)
            report_days.append(day_section)

    return report_days, total_time

def format_epoch_day(epoch_day):
    timestamp = datetime.datetime.fromtimestamp(epoch_day * 86400, tz)
    return timestamp.strftime('%b %d, %Y')

def format_epoch_weekday(epoch_day):
    timestamp = datetime.datetime.fromtimestamp(epoch_day * 86400, tz)
    return timestamp.strftime('%A, %b %d')

def get_report(g, root_context_id, interval, day=None, month=None, year=None, begin_date=None,
                    max_depth=None, leaf_notes=True, leaf_note_timing=False, public=False):

    intervals = ('day', 'week', 'month')
    if interval not in intervals:
        interval = 'day'

    days = generate_days(interval, day, month, year, begin_date=begin_date)

    if interval == 'day':
        max_depth = None
        leaf_notes = True
    elif interval == 'week':
        if max_depth is None:
            max_depth = 4
    elif interval == 'month':
        if max_depth is None:
            max_depth = 4

    period_idx = gen_idx(g, 86400, len(days), (days[-1] + 1) * 86400)
    root = g.get_context(root_context_id)
    report_data = generate_report_days(root, period_idx, days, max_depth, leaf_notes, leaf_note_timing)
    report = construct_report(report_data, days, root.label, public=public)

    return report

if __name__ == '__main__':
    from benome.sql_db import Graph
    db_path = sys.argv[1]
    g = Graph(root_context_id=1000, db_path=db_path)
    g.load(1, ['1', '2001'])

    root_context = g.get_root()
    print get_report(root_context, 'month', month=11, year=2015)
