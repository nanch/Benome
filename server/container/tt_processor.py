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

import simplejson
import math
from record_processor import RecordProcessor

class TimeTrackingProcessor(RecordProcessor):
    def _compute_day_results(self, epoch_day, context, structure, level=0):
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
                child_details = self._compute_day_results(epoch_day, child_vertex, structure, level=level+1)
                context_details['Children'] += child_details
                child_total += sum([child_detail['TotalTime'] for child_detail in child_details])

        # Data points
        context_points = self.data.get_points(contexts=[context_id])
        record_notes = []
        if context_points:
            for point in context_points:
                timestamp = point.get('1__Time')
                if not timestamp:
                    continue

                point_epoch_day = self.get_epoch_day(timestamp)
                if point_epoch_day != epoch_day:
                    continue

                description = point.get('1__Text', None)
                duration = point.get('1__Duration', 0)

                if description:
                    record_notes.append((duration, map(str.strip, str(description.strip()).split('\n'))))

        context_details['ChildTotalTime'] = child_total
        context_details['TotalTime'] = child_total + self_total
        context_details['RecordNotes'] = record_notes

        if level == 0:
            return context_details
        else:
            return [context_details]

    def to_structure(self, context_list):
        'Include everything, with all available detail'
        return context_list

    @staticmethod
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

    @classmethod
    def generate_report(cls, context_details, print_empty=False, level=0, display_root=True, max_depth=None, time_unit='seconds', time_formatted=False, leaf_notes=False, leaf_note_timing=True):
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
            interval, unit = cls.format_time(total_time, time_unit)
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
                            interval, unit = cls.format_time(line_time, time_unit)
                            line = '%s%s%s %s%s' % (note_indent, interval, unit, dash, line)
                        else:
                            line = '%s %s%s' % (note_indent, dash, line)

                        result.append(line)

        # TODO: Sort children by timestamp
        for child_context_details in context_details['Children']:
            result += cls.generate_report(child_context_details, print_empty, 
                            level=level+1, display_root=display_root, max_depth=max_depth, 
                            time_unit=time_unit, leaf_notes=leaf_notes, leaf_note_timing=leaf_note_timing)

        return result