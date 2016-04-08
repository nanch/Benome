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

import string
import simplejson
import re
import os
import subprocess

uuid4hex = re.compile('[0-9a-f]{8}(\-[0-9a-f]{4}){3}\-[0-9a-f]{12}\Z', re.I)
BASE_LIST = string.digits + string.letters

class CompactID(object):
    'Adapted from http://stackoverflow.com/questions/1119722/base-62-conversion-in-python'

    BASE_LIST = BASE_LIST
    BASE_DICT = dict((c, i) for i, c in enumerate(BASE_LIST))

    def __init__(self, initial_id=None):
        if initial_id is None:
            self._id = 10000
        else:
            self._id = initial_id

    def __call__(self, *args, **kwargs):
        return self.next(*args, **kwargs)

    @classmethod
    def _base_decode(cls, string):
        reverse_base = cls.BASE_DICT
        length = len(reverse_base)
        ret = 0
        for i, c in enumerate(string[::-1]):
            ret += (length ** i) * reverse_base[c]

        return ret

    @classmethod
    def _base_encode(cls, integer):
        base = cls.BASE_LIST
        length = len(base)
        ret = ''
        while integer != 0:
            ret = base[integer % length] + ret
            integer /= length

        return ret

    def current(self, encoded=False):
        if encoded:
            return self._base_encode(self._id)
        else:
            return self._id

    def next(self, encoded=None, inc=1):
        if encoded:
            next_id = self._base_decode(encoded) + inc
        else:
            next_id = self._id + inc
            
        self._id = next_id
        return self._base_encode(next_id)

    def block(self, block_size=None):
        if not block_size or block_size < 0 or type(block_size) is not int:
            block_size = 1000

        block_begin = self._id + 1
        block_end = block_begin + block_size

        self._id = block_end
        return block_begin, block_end


def json_response(d):
    from flask import make_response

    response = make_response(simplejson.dumps(d))
    response.headers['Content-Type'] = 'application/json'
    response.headers['Cache-Control'] = 'no-cache, private'

    return response

def json_get(url, return_code=False, timeout=5):
    import requests

    headers = {
        'Content-type': 'application/json',
        'Accept': 'application/json'
    }

    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        if callable(r.json):
            json = r.json()
        else:
            json = r.json
        status_code = r.status_code
    except Exception, e:
        print 'JSON GET error to %s: %s' % (url, e)
        json = None
        status_code = 600

    if return_code:
        return json, status_code
    else:
        return json

def json_post(url, data, return_code=True, timeout=60):
    import requests
    headers = {
        'Content-type': 'application/json',
        'Accept': 'application/json'
    }

    try:
        json_data = simplejson.dumps(data)
        r = requests.post(url, data=json_data, headers=headers, timeout=timeout)
        if callable(r.json):
            json = r.json()
        else:
            json = r.json
        status_code = r.status_code
    except Exception, e:
        print 'JSON POST error to %s: %s' % (url, e)
        json = None
        status_code = 600

    if return_code:
        return json, status_code
    else:
        return json

def is_uuid(u):
    return uuid4hex.match(u)

def ext(cmd, params=None, wait=True, shell=True, raw=False, close_fds=False, debug=False):
    result = None
    stdout = None
    stderr = None

    if params is None:
        params = []

    to_exec = [os.path.normpath(cmd)]
    to_exec.extend(params)

    if wait:
        stdout = subprocess.PIPE
        stderr = subprocess.STDOUT

    if shell:
        cmd = ' '.join(to_exec)
    else:
        cmd = to_exec

    if debug:
        print cmd

    process_obj = subprocess.Popen(cmd, shell=shell, stdout=stdout, stderr=stderr, close_fds=close_fds)

    if wait:
        (result, x) = process_obj.communicate()
        if not raw:
            result = result.rstrip().split('\n')

    else:
        result = process_obj.pid

    return result

def connect_redis(host=None, db=0, silent=True, timeout=2.0):
    import redis as r

    if not host:
        host = '127.0.0.1'

    redis = r.StrictRedis(host=host, db=db, socket_timeout=timeout)
    try:
        result = redis.get('TESTKEY')
    except r.exceptions.ConnectionError, e:
        if not silent:
            print 'Redis connect error: %s' % e
        redis = None

    return redis

def disconnect_redis(redis):
    if redis:
        try:
            redis.connection_pool.disconnect()
        except Exception, e:
            print 'Redis disconnect exception: %s' % e
        redis = None
        del redis

def force_exit():
    import thread
    thread.interrupt_main()
