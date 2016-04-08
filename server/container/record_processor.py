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
from datetime import date, datetime
import math

class RecordProcessor(object):
    raw_record_interval = 122 * 86400 # 4 months
    duration_threshold = 20

    def __init__(self, data, root, base_context=None, period_begin=None, period_end=None):
        self.data = data
        self.root = root
        self.day_buckets = {}
        self.base_context = base_context or root

        try:
            self.raw_data = self.get_raw_records(self.base_context, period_begin=period_begin, period_end=period_end)
        except Exception, e:
            #import traceback ; traceback.print_exc()
            print 'Raw records could not be retrieved from %s: %s' % (self.base_context.get_id(), e)
            self.raw_data = []

        self.day_buckets = self.bucket_records(self.raw_data)
        self.fix_durations()

    def get_raw_records(self, base_context, period_begin=None, period_end=None):
        if not base_context:
            raise Exception('Missing base_context')

        if not period_begin:
            period_begin = time.time()

        if not period_end:
            period_end = period_begin - self.raw_record_interval

        # Pull relevant records
        points = self.data.get_points(contexts=[base_context.get_id()], anchor_time=period_begin, end_time=period_end)
        if not points:
            raise Exception('No results found in period %d to %d' % (period_begin, period_end))

        return points

    def bucket_records(self, points):
        # Run through these records, bucketing by day
        day_buckets = {}

        for point in points:
            common_details = {
                'BeginTime': point['1__Time'],
                'EndTime': point['1__EndTime'],
                'Duration': point['1__Duration'],
                'Text': point['1__Text']
            }

            attr = None

            # for val in detail_values:
            #     if val['detailType'] == 'BeginTime':
            #         common_details['BeginTime'] = val['value']
            #     elif val['detailType'] == 'EndTime':
            #         common_details['EndTime'] = val['value']

            # if not common_details.get('BeginTime'):
            #     continue

            # if not common_details.get('EndTime'):
            #     common_details['EndTime'] = common_details['BeginTime']
            # common_details['Duration'] = common_details['EndTime'] - common_details['BeginTime']

            # specific_details = self.get_record_details(detail_values, common_details, attr)
            # if specific_details is None:
            #     continue
            # common_details.update(specific_details)

            day = self.get_epoch_day(common_details['BeginTime'])
            if day not in day_buckets:
                day_buckets[day] = []

            # TODO: support multiple parent contexts
            context = self.data.get_context(point['1__ContextID'])
            if context:
                day_buckets[day].append({
                    'Point': point,
                    'Context': context,
                    'CommonDetails': common_details
                })

        return day_buckets

    @classmethod
    def get_epoch_day(cls, begin_time=None, begin_date=None):
        if not begin_time:
            begin_time = time.time()
        else:
            begin_time = float(begin_time)

        local_epoch = datetime.utcfromtimestamp(0)
        local_begin = datetime.fromtimestamp(begin_time)

        delta = local_begin - local_epoch
        day = delta.days

        return day

    @classmethod
    def get_epoch_week(cls, begin_time=None, shift=0, begin_date=None):
        if not begin_time:
            begin_time = time.time()

        # Normally, Monday is 0, Sunday is 6
        weekday = date.fromtimestamp(begin_time).weekday() + shift
        if weekday > 6:
            weekday -= 6

        epoch_day = cls.get_epoch_day(begin_time)
        week_begin = epoch_day - weekday
        week_end = week_begin + 7

        begin_epoch_day = None
        if begin_date:
            begin_epoch_day = cls.get_epoch_day(begin_date)

        epoch_week = []
        for i in range(week_begin, week_end):
            if begin_epoch_day and i < begin_epoch_day:
                continue
            epoch_week.append(i)

        return epoch_week

    @classmethod
    def get_epoch_month(cls, begin_time=None, begin_date=None):
        from calendar import monthrange

        if not begin_time:
            begin_time = time.time()

        d = date.fromtimestamp(begin_time)
        epoch_day = cls.get_epoch_day(begin_time)

        month_length = monthrange(d.year, d.month)[1]
        month_begin = epoch_day - (d.day - 1)
        epoch_month = range(month_begin, month_begin + month_length)
        return epoch_month

    def get_record_details(self, detail_values, common_details, attributes):
        if attributes.get('recordType') in ('ContextOpen', 'ContextClose'):
            return None

        return {}

    def fix_durations(self):
        pass

    # Create an activity-indexed structure
    def create_activity_structure(self):
        actions = {}
        for day in sorted(self.day_buckets.keys()):
            records = self.day_buckets[day]
            if len(records) < 3:
                continue

            for rec in records:
                context_id = rec['Context'].get_id()

                if context_id not in actions:
                    actions[context_id] = {}

                if not day in actions[context_id]:
                    actions[context_id][day] = []

                actions[context_id][day].append(rec['CommonDetails'])

        return actions

    def avg(self, records, field):
        num_records = len(records)
        total_val = 0.0
        for rec in records:
            total_val += rec[field]

        if num_records > 0:
            return int(round(total_val / float(num_records)))
        else:
            return 0

    def get_data(self, record_days, ordinal=None):
        data = []
        for day in sorted(record_days.keys()):
            # Sort the records by begin time
            records = sorted(record_days[day], key=lambda x: x['BeginTime'])

            if ordinal:
                try:
                    data.append(records[ordinal - 1])
                except:
                    pass
            else:
                data.extend(records)

        return data

    def get_projected_values(self, record_days, fields, num_recent=None, ordinal=None):
        if not ordinal:
            data = self.get_data(record_days)
        else:
            data = []
            while not data and ordinal:
                data = self.get_data(record_days, ordinal)
                ordinal -= 1
        
        result = {}
        if data:
            # Grab recent records and average them

            avg_set = []
            if num_recent:
                avg_set = data[-num_recent:]
            else:
                avg_set = data

            for field_name in fields:
                result[field_name] = self.avg(avg_set, field_name)

        return result

    def create_activity_metadata(self, include_contexts, fields, activities):
        '''
        '''
        activity_metadata = {}

        for context_id, context_data in include_contexts.items():
            # TODO Full outward traversal
            sub_contexts = context_data.get('sub')
            if not sub_contexts:
                continue

            for sub_context_id in sub_contexts:
                action_data = {
                    'Projected': {},
                    'Last': {}
                }

                # The days on which this particular action was done
                #   Each day contains all activity records

                record_days = activities.get(sub_context_id)
                if record_days:
                    for i in [1, 2, 3]:
                        vals = self.get_projected_values(record_days, fields.keys(), ordinal=i, num_recent=3)

                        projected = {}
                        for field, val in vals.items():
                            projected[fields[field]] = val

                        action_data['Projected'][i] = projected

                activity_metadata[sub_context_id] = action_data

        return activity_metadata

    def get_activity_metadata(self, include_contexts, fields):
        activity_structure = self.create_activity_structure()
        metadata = self.create_activity_metadata(include_contexts, fields, activity_structure)
        return metadata

    def get_days(self):
        return sorted(self.day_buckets.keys(), reverse=True)

    def simplify_day_records(self, day, activities=None):
        day_records = self.day_buckets[day]
        day_activities = {}

        for r in day_records:
            activity_name = r['Context'].label
            if activities and activity_name not in activities:
                continue

            details = r['CommonDetails']
            duration = details['Duration']

            # Skip uncorrected durations as they'll just mess up analytics
            if duration < self.duration_threshold:
                continue

            if activity_name not in day_activities:
                day_activities[activity_name] = []

            day_activities[activity_name].append(details)

        return day_activities

    def compute_day_intervals(self, days=None):
        if not days:
            days = self.get_days()

        intervals = []
        for i, day in enumerate(days[1:]):
            intervals.append(days[i] - day)

        return intervals

    def create_structure(self, day):
        structure = {}
        if day in self.day_buckets:
            for record in self.day_buckets[day]:
                context_id = record['Context'].get_id()
                if context_id not in structure:
                    structure[context_id] = []

                structure[context_id].append(record)

        return structure

    def compute_day_results(self, day=None, context=None, structure=None):
        if not structure:
            if not day:
                day = self.get_epoch_day()

            structure = self.create_structure(day)

        if not context:
            context = self.base_context

        return self._compute_day_results(day, context, structure)

    def _compute_day_results(self, epoch_day, context, structure, level=0):
        return {}
